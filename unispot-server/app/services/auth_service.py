from datetime import UTC, datetime

import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.observability import request_id_context
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from app.models.audit_event import ActorType, AuditEvent, AuditOutcome
from app.models.booking import BookingSource
from app.models.user import User, UserStatus


async def login_user(
    session: AsyncSession,
    email: str,
    password: str,
) -> dict[str, str]:
    result = await session.execute(select(User).where(User.email == email))

    user = result.scalar_one_or_none()

    # Generic response for invalid credentials
    if user is None:
        await _record_auth_audit(session, action="LOGIN_FAILED", actor_user_id=None)
        raise ValueError("Invalid email or password")

    # Disabled users cannot authenticate
    if user.status != UserStatus.ACTIVE:
        await _record_auth_audit(session, action="LOGIN_FAILED", actor_user_id=user.id)
        raise ValueError("Invalid email or password")

    if user.password_hash is None:
        await _record_auth_audit(session, action="LOGIN_FAILED", actor_user_id=user.id)
        raise ValueError("Invalid email or password")

    if not await run_in_threadpool(verify_password, user.password_hash, password):
        await _record_auth_audit(session, action="LOGIN_FAILED", actor_user_id=user.id)
        raise ValueError("Invalid email or password")

    # Record successful login
    user.last_login_at = datetime.now(UTC)
    session.add(
        AuditEvent(
            actor_user_id=user.id,
            actor_type=ActorType.USER,
            action="LOGIN_SUCCEEDED",
            target_type="USER",
            target_id=user.id,
            channel=BookingSource.WEB,
            outcome=AuditOutcome.SUCCEEDED,
        )
    )

    access_token = create_access_token(
        {
            "user_id": str(user.id),
        }
    )

    refresh_token = create_refresh_token(
        {
            "user_id": str(user.id),
        }
    )

    await session.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


async def refresh_access_token(session: AsyncSession, refresh_token: str) -> str:
    from app.core.security import verify_refresh_token

    try:
        payload = verify_refresh_token(refresh_token)
    except jwt.InvalidTokenError as error:
        raise ValueError("Invalid refresh token") from error

    try:
        from uuid import UUID

        user_id = UUID(str(payload.get("user_id", "")))
    except ValueError as error:
        raise ValueError("Invalid refresh token") from error

    user = await session.get(User, user_id)
    if user is None or user.status is not UserStatus.ACTIVE:
        raise ValueError("Invalid refresh token")

    return create_access_token(
        {
            "user_id": str(user.id),
        }
    )


async def _record_auth_audit(
    session: AsyncSession,
    *,
    action: str,
    actor_user_id: object,
) -> None:
    try:
        session.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                actor_type=ActorType.USER if actor_user_id else ActorType.SYSTEM,
                action=action,
                target_type="USER",
                target_id=actor_user_id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.DENIED,
                event_metadata={"request_id": str(request_id_context.get())},
            )
        )
        await session.commit()
    except Exception:
        await session.rollback()
