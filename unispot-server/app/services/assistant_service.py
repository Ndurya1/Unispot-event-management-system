# ruff: noqa: E501

import asyncio
import json
from typing import cast
from uuid import UUID, uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from app.core.config import get_settings
from app.models.assistant import AssistantToolCallStatus, ConversationMessageRole
from app.models.user import User
from app.schemas.assistant import (
    AssistantMessageRequest,
    AssistantMessageResponse,
    AssistantToolInvocation,
    AssistantToolResult,
    CancelMyBookingArguments,
    CreateBookingArguments,
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
    if request.conversation_id is None:
        return await _process_turn(
            session,
            requester=requester,
            request=request,
            provider=provider,
        )
    bind = session.bind
    if bind is None:
        raise RuntimeError("Assistant requires a bound session")
    engine = bind.engine if isinstance(bind, AsyncConnection) else bind
    # Dedicated transaction keeps the lock across domain-service commits/rollbacks.
    # A busy conversation fails immediately rather than consuming waiting connections.
    key = int.from_bytes(request.conversation_id.bytes[:8], "big", signed=True)
    async with engine.begin() as connection:
        acquired = await connection.scalar(
            text("SELECT pg_try_advisory_xact_lock(:key)"),
            {"key": key},
        )
        if not acquired:
            raise HTTPException(409, "Another turn is processing. Retry shortly")
        return await _process_turn(
            session,
            requester=requester,
            request=request,
            provider=provider,
        )


async def _process_turn(
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
    if request.confirmed:
        if (
            invocations
            or pending is None
            or request.confirmation_id is None
            or str(request.confirmation_id) != pending.get("confirmation_id")
        ):
            raise HTTPException(409, "Confirmation must match the current proposed action")
        invocations = [
            AssistantToolInvocation(
                name=ToolName(str(pending["tool"])),
                arguments=cast(dict[str, object], pending["arguments"]),
            )
        ]
    else:
        # A changed request invalidates the previous proposal.
        conversation.state = {
            key: value for key, value in conversation.state.items() if key != "pending_confirmation"
        }
        pending = None
        # Persist invalidation even if validation of the replacement action fails.
        await session.commit()

    if not invocations:
        active_provider = provider or RuleBasedAssistantProvider()
        try:
            async with asyncio.timeout(get_settings().assistant_timeout_seconds):
                plan = await active_provider.complete(
                    message=request.message,
                    state=dict(conversation.state),
                )
            if len(plan.tool_calls) > 8 or len(json.dumps(plan.state_patch)) > 8000:
                raise ValueError("Provider exceeded turn limits")
            invocations = plan.tool_calls
            provider_response = plan.response
            if plan.state_patch:
                conversation.state = {
                    **conversation.state,
                    **{k: v for k, v in plan.state_patch.items() if k in {"intent", "slots"}},
                }
        except Exception:
            provider_response = (
                "The assistant is temporarily unavailable. You can continue using "
                "the standard venue and booking screens."
            )

    if not invocations:
        response_text = (provider_response or "Please provide an assistant action to continue.")[
            :4000
        ]
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
    message_id = user_message.id
    if (
        sum(
            call.name in {ToolName.CREATE_BOOKING, ToolName.CANCEL_MY_BOOKING}
            for call in invocations
        )
        > 1
    ):
        raise HTTPException(422, "Propose one booking change per turn")
    for index, invocation in enumerate(invocations):
        arguments = dict(invocation.arguments)
        name = invocation.name
        write_tool = name in {ToolName.CREATE_BOOKING, ToolName.CANCEL_MY_BOOKING}
        confirmed = request.confirmed
        call_key = _idempotency_key(conversation.id, message_id, index, pending)
        try:
            if write_tool:
                schema = (
                    CreateBookingArguments
                    if name is ToolName.CREATE_BOOKING
                    else CancelMyBookingArguments
                )
                arguments = schema.model_validate(arguments).model_dump(mode="json")
            await session.commit()
            data, booking_id = await executor.execute(
                name,
                arguments,
                confirmed=confirmed,
                idempotency_key=call_key if write_tool else None,
            )
            await session.refresh(conversation)
            await session.refresh(requester)
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
                message_id=message_id,
            )
            # Retain the exact proposal/key for safe confirmation retries. Domain
            # services replay the original booking instead of creating another.
            if write_tool and pending is not None:
                conversation.state = {
                    "pending_confirmation": {**pending, "completed": True},
                }
        except AssistantConfirmationRequired:
            conversation.state = {
                "pending_confirmation": {
                    "tool": name.value,
                    "arguments": arguments,
                    "idempotency_key": call_key,
                    "confirmation_id": str(uuid4()),
                }
            }
            result = AssistantToolResult(
                name=name,
                status="confirmation_required",
                error="Explicit confirmation is required before this booking change.",
            )
            results.append(result)
            response_lines.append("Please confirm this booking change: " + json.dumps(arguments))
            await record_tool_call(
                session,
                conversation=conversation,
                tool_name=name.value,
                arguments=arguments,
                status=AssistantToolCallStatus.REQUESTED,
                confirmed=False,
                message_id=message_id,
            )
        except (ValidationError, ValueError, BookingPolicyError) as error:
            await session.rollback()
            await session.refresh(conversation)
            await session.refresh(requester)
            safe_error = _safe_error(error)
            result = AssistantToolResult(name=name, status="failed", error=safe_error)
            results.append(result)
            response_lines.append(safe_error)
            await record_tool_call(
                session,
                conversation=conversation,
                tool_name=name.value,
                arguments={} if isinstance(error, ValidationError) else arguments,
                status=AssistantToolCallStatus.FAILED,
                result={"error": safe_error},
                confirmed=confirmed,
                message_id=message_id,
            )
        await session.commit()

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
        pending_confirmation=bool(
            _pending_action(conversation.state)
            and not (_pending_action(conversation.state) or {}).get("completed")
        ),
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
        count = _count(data.get("available_venues"))
        if count == 0:
            return (
                "No venue is available for that interval. Try a nearby time or "
                "adjust the capacity or location filters."
            )
        return f"I found {count} available venue(s) for that interval."
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
    return "The action could not be completed. Check availability, ownership, and booking policy."


def _count(value: object) -> int:
    return len(value) if isinstance(value, list) else 0


__all__ = ["process_assistant_message"]
