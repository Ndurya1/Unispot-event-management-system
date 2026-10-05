from collections.abc import Mapping
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assistant import (
    AssistantToolCall,
    AssistantToolCallStatus,
    Conversation,
    ConversationMessage,
    ConversationMessageRole,
)
from app.models.audit_event import ActorType, AuditEvent, AuditOutcome
from app.models.booking import BookingSource
from app.models.user import User

CONVERSATION_TTL = timedelta(minutes=30)
CONVERSATION_RETENTION = timedelta(days=30)
_SENSITIVE_KEYS = {"password", "secret", "token", "authorization", "database_url", "sql"}


def redact_payload(value: Mapping[str, object]) -> dict[str, object]:
    """Return a JSON-safe tool payload without credentials or executable query text."""
    return {
        key: "[REDACTED]" if _is_sensitive_key(key) else _redact_value(item)
        for key, item in value.items()
    }


async def get_or_create_conversation(
    session: AsyncSession,
    *,
    requester: User,
    conversation_id: UUID | None = None,
) -> Conversation:
    if conversation_id is None:
        now = datetime.now(UTC)
        conversation = Conversation(
            user_id=requester.id,
            state={},
            expires_at=now + CONVERSATION_TTL,
            retention_until=now + CONVERSATION_RETENTION,
        )
        session.add(conversation)
        await session.flush()
        return conversation

    loaded = await session.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == requester.id,
        )
    )
    if loaded is None:
        raise ValueError("Conversation not found")
    conversation = loaded
    if conversation.expires_at <= datetime.now(UTC):
        raise ValueError("Conversation has expired")
    conversation.expires_at = datetime.now(UTC) + CONVERSATION_TTL
    conversation.updated_at = datetime.now(UTC)
    return conversation


async def append_message(
    session: AsyncSession,
    *,
    conversation: Conversation,
    role: ConversationMessageRole,
    content: str,
    structured_state: Mapping[str, object] | None = None,
) -> ConversationMessage:
    max_sequence = await session.scalar(
        select(func.max(ConversationMessage.sequence)).where(
            ConversationMessage.conversation_id == conversation.id
        )
    )
    message = ConversationMessage(
        conversation_id=conversation.id,
        sequence=(max_sequence or 0) + 1,
        role=role,
        content=content,
        structured_state=dict(structured_state) if structured_state is not None else None,
    )
    session.add(message)
    conversation.updated_at = datetime.now(UTC)
    await session.flush()
    return message


async def record_tool_call(
    session: AsyncSession,
    *,
    conversation: Conversation,
    tool_name: str,
    arguments: Mapping[str, object],
    status: AssistantToolCallStatus,
    result: Mapping[str, object] | None = None,
    confirmed: bool = False,
    booking_id: UUID | None = None,
    message_id: UUID | None = None,
) -> AssistantToolCall:
    tool_call = AssistantToolCall(
        conversation_id=conversation.id,
        message_id=message_id,
        tool_name=tool_name,
        arguments=redact_payload(arguments),
        result=redact_payload(result) if result is not None else None,
        status=status,
        confirmed=confirmed,
        booking_id=booking_id,
    )
    session.add(tool_call)
    await session.flush()
    outcome = {
        AssistantToolCallStatus.SUCCEEDED: AuditOutcome.SUCCEEDED,
        AssistantToolCallStatus.REQUESTED: AuditOutcome.DENIED,
        AssistantToolCallStatus.FAILED: AuditOutcome.FAILED,
        AssistantToolCallStatus.DENIED: AuditOutcome.DENIED,
    }[status]
    session.add(
        AuditEvent(
            actor_user_id=conversation.user_id,
            actor_type=ActorType.ASSISTANT,
            action=f"ASSISTANT_TOOL_{tool_name.upper()}",
            target_type="BOOKING" if booking_id is not None else "ASSISTANT_TOOL",
            target_id=booking_id,
            channel=BookingSource.ASSISTANT,
            outcome=outcome,
            event_metadata={"tool_call_id": str(tool_call.id), "status": status.value},
        )
    )
    await session.flush()
    return tool_call


async def purge_expired_conversations(
    session: AsyncSession, *, now: datetime | None = None
) -> int:
    """Delete conversations past retention without exposing their contents."""
    cutoff = now or datetime.now(UTC)
    count = await session.scalar(
        select(func.count())
        .select_from(Conversation)
        .where(
            Conversation.retention_until.is_not(None),
            Conversation.retention_until <= cutoff,
        )
    )
    await session.execute(
        delete(Conversation).where(
            Conversation.retention_until.is_not(None),
            Conversation.retention_until <= cutoff,
        )
    )
    await session.commit()
    return int(count or 0)


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower()
    return normalized in _SENSITIVE_KEYS or any(
        marker in normalized for marker in ("password", "secret", "token", "authorization", "sql")
    )


def _redact_value(value: object) -> object:
    if isinstance(value, Mapping):
        return redact_payload(value)
    if isinstance(value, list):
        return [_redact_value(item) for item in value]
    if isinstance(value, (date, time, UUID)):
        return value.isoformat() if hasattr(value, "isoformat") else str(value)
    return value
