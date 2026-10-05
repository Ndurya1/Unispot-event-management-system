# ruff: noqa: E501

import json
from typing import cast
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assistant import AssistantToolCallStatus, ConversationMessageRole
from app.models.user import User
from app.schemas.assistant import (
    AssistantMessageRequest,
    AssistantMessageResponse,
    AssistantToolInvocation,
    AssistantToolResult,
    ToolName,
)
from app.services.assistant_conversation import (
    append_message,
    get_or_create_conversation,
    record_tool_call,
)
from app.services.assistant_provider import AssistantProvider, RuleBasedAssistantProvider
from app.services.assistant_tools import AssistantConfirmationRequired, AssistantToolExecutor
from app.services.booking_policy import BookingPolicyError


async def process_assistant_message(
    session: AsyncSession,
    *,
    requester: User,
    request: AssistantMessageRequest,
    idempotency_key: str | None = None,
    provider: AssistantProvider | None = None,
) -> AssistantMessageResponse:
    conversation = await get_or_create_conversation(
        session,
        requester=requester,
        conversation_id=request.conversation_id,
    )
    user_message = await append_message(
        session,
        conversation=conversation,
        role=ConversationMessageRole.USER,
        content=request.message,
    )
    # Persist the user turn before invoking a booking service. Booking writes
    # intentionally manage their own transaction and may roll back the session.
    await session.commit()
    await session.refresh(conversation)
    # Dependency overrides and some test sessions use expire_on_commit=True;
    # reload the authenticated identity before a domain write accesses it.
    await session.refresh(requester)

    invocations: list[AssistantToolInvocation] = list(request.tool_calls)
    provider_response: str | None = None
    pending = _pending_action(conversation.state)
    if request.confirmed and not invocations and pending is not None:
        invocations = [
            AssistantToolInvocation(
                name=ToolName(str(pending["tool"])),
                arguments=cast(dict[str, object], pending["arguments"]),
            )
        ]

    if not invocations:
        active_provider = provider or RuleBasedAssistantProvider()
        try:
            plan = await active_provider.complete(
                message=request.message,
                state=conversation.state,
            )
            invocations = plan.tool_calls
            provider_response = plan.response
        except Exception:
            provider_response = (
                "The assistant is temporarily unavailable. You can continue using "
                "the standard venue and booking screens."
            )

    if not invocations:
        response_text = provider_response or "Please provide an assistant action to continue."
        assistant_message = await append_message(
            session,
            conversation=conversation,
            role=ConversationMessageRole.ASSISTANT,
            content=response_text,
            structured_state=conversation.state,
        )
        await session.commit()
        return AssistantMessageResponse(
            conversation_id=conversation.id,
            message_id=assistant_message.id,
            response=response_text,
            state=conversation.state,
        )

    executor = AssistantToolExecutor(session, requester)
    results: list[AssistantToolResult] = []
    response_lines: list[str] = []
    for index, invocation in enumerate(invocations):
        arguments = dict(invocation.arguments)
        name = invocation.name
        write_tool = name in {ToolName.CREATE_BOOKING, ToolName.CANCEL_MY_BOOKING}
        confirmed = request.confirmed
        call_key = idempotency_key or _idempotency_key(
            conversation.id, user_message.id, index, pending
        )
        try:
            data, booking_id = await executor.execute(
                name,
                arguments,
                confirmed=confirmed,
                idempotency_key=call_key if write_tool else None,
            )
            result = AssistantToolResult(
                name=name,
                status="succeeded",
                data=data,
                booking_id=booking_id,
            )
            results.append(result)
            response_lines.append(_success_message(name, data))
            await record_tool_call(
                session,
                conversation=conversation,
                tool_name=name.value,
                arguments=arguments,
                status=AssistantToolCallStatus.SUCCEEDED,
                result=data,
                confirmed=confirmed,
                booking_id=booking_id,
                message_id=user_message.id,
            )
            if write_tool:
                conversation.state = {}
        except AssistantConfirmationRequired:
            conversation.state = {
                "pending_confirmation": {
                    "tool": name.value,
                    "arguments": arguments,
                    "idempotency_key": call_key,
                }
            }
            result = AssistantToolResult(
                name=name,
                status="confirmation_required",
                error="Explicit confirmation is required before this booking change.",
            )
            results.append(result)
            response_lines.append(_confirmation_message(name, arguments))
            await record_tool_call(
                session,
                conversation=conversation,
                tool_name=name.value,
                arguments=arguments,
                status=AssistantToolCallStatus.REQUESTED,
                confirmed=False,
                message_id=user_message.id,
            )
        except (ValidationError, ValueError, BookingPolicyError) as error:
            safe_error = _safe_error(error)
            result = AssistantToolResult(name=name, status="failed", error=safe_error)
            results.append(result)
            response_lines.append(safe_error)
            await record_tool_call(
                session,
                conversation=conversation,
                tool_name=name.value,
                arguments=arguments,
                status=AssistantToolCallStatus.FAILED,
                result={"error": safe_error},
                confirmed=confirmed,
                message_id=user_message.id,
            )

    response_text = "\n".join(response_lines)
    assistant_message = await append_message(
        session,
        conversation=conversation,
        role=ConversationMessageRole.ASSISTANT,
        content=response_text,
        structured_state=conversation.state,
    )
    await session.commit()
    return AssistantMessageResponse(
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        response=response_text,
        tool_results=results,
        pending_confirmation="pending_confirmation" in conversation.state,
        state=conversation.state,
    )


def _pending_action(state: dict[str, object]) -> dict[str, object] | None:
    value = state.get("pending_confirmation")
    if not isinstance(value, dict):
        return None
    tool = value.get("tool")
    arguments = value.get("arguments")
    if not isinstance(tool, str) or not isinstance(arguments, dict):
        return None
    return value


def _idempotency_key(
    conversation_id: UUID,
    message_id: UUID,
    index: int,
    pending: dict[str, object] | None,
) -> str:
    if pending is not None:
        value = pending.get("idempotency_key")
        if isinstance(value, str):
            return value
    return f"assistant:{conversation_id}:{message_id}:{index}"


def _success_message(name: ToolName, data: dict[str, object]) -> str:
    if name is ToolName.CREATE_BOOKING:
        booking = data.get("booking", {})
        if isinstance(booking, dict):
            return (
                "Booking confirmed. Your confirmation code is "
                f"{booking.get('confirmation_code', 'available in My Bookings')}."
            )
    if name is ToolName.CANCEL_MY_BOOKING:
        return "Booking cancelled successfully."
    if name is ToolName.SEARCH_VENUES:
        return f"I found {_count(data.get('venues'))} matching venue(s)."
    if name is ToolName.CHECK_AVAILABILITY:
        return (
            "I found "
            f"{_count(data.get('available_venues'))} available venue(s) for that interval."
        )
    if name is ToolName.LIST_MY_BOOKINGS:
        return f"I found {_count(data.get('bookings'))} booking(s) belonging to you."
    return json.dumps(data, default=str)


def _confirmation_message(name: ToolName, arguments: dict[str, object]) -> str:
    action = "create" if name is ToolName.CREATE_BOOKING else "cancel"
    return f"I’m ready to {action} this booking. Please review the details and send an explicit confirmation."


def _safe_error(error: Exception) -> str:
    if isinstance(error, BookingPolicyError):
        return "; ".join(item.message for item in error.violations)
    if isinstance(error, ValidationError):
        return "The tool arguments are invalid. Please provide the missing or correctly formatted fields."
    text = str(error)
    return text[:500] if text else "The assistant action could not be completed."


def _count(value: object) -> int:
    return len(value) if isinstance(value, list) else 0


__all__ = ["process_assistant_message"]
