import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

logger = logging.getLogger("unispot.auth")

import jwt
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.observability import request_id_context
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.audit_event import ActorType, AuditEvent, AuditOutcome
from app.models.auth_action_token import AuthActionToken, AuthActionType
from app.models.booking import BookingSource
from app.models.booking_event import BookingEvent
from app.models.user import User, UserStatus
from app.services.email_service import (
    generate_action_token,
    send_password_reset_email,
    send_verification_email,
)

GENERIC_FORGOT_MESSAGE = (
    "If an account exists for that email, we sent password reset instructions."
)
GENERIC_VERIFY_SENT_MESSAGE = (
    "If an account exists for that email and it needs verification, we sent instructions."
)


async def register_user(
    session: AsyncSession,
    full_name: str,
    email: str,
    password: str,
    role: str | None = None,
    registration_code: str | None = None,
) -> dict[str, str]:
    """Create an account (Student-only) and send a verification email.

    The account can log in before verification for continuity, but
    email_verified_at is set only after the emailed token is confirmed.
    Elevated roles/memberships are never granted from public signup.
    """
    _ = role, registration_code  # accepted for API compatibility; ignored for security
    normalized_name = " ".join(full_name.split())
    normalized_email = email.strip().lower()
    if not normalized_name:
        raise ValueError("Full name is required")

    existing = await session.scalar(select(User.id).where(User.email == normalized_email))
    if existing is not None:
        raise ValueError("Email is already registered")

    settings = get_settings()
    password_hash = await run_in_threadpool(hash_password, password)
    user = User(
        full_name=normalized_name,
        email=normalized_email,
        password_hash=password_hash,
        status=UserStatus.ACTIVE,
        email_verified_at=None,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Email is already registered") from error

    from app.models.role import Role
    from app.models.user_role import UserRoles

    student_role = await session.scalar(select(Role).where(Role.name == "STUDENT"))
    if student_role is not None:
        session.add(UserRoles(user_id=user.id, role_id=student_role.id))

    raw_token, token_hash = generate_action_token()
    session.add(
        AuthActionToken(
            user_id=user.id,
            action_type=AuthActionType.VERIFY_EMAIL,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(minutes=settings.email_verify_ttl_minutes),
        )
    )

    session.add(
        AuditEvent(
            actor_user_id=user.id,
            actor_type=ActorType.USER,
            action="REGISTER_SUCCEEDED",
            target_type="USER",
            target_id=user.id,
            channel=BookingSource.WEB,
            outcome=AuditOutcome.SUCCEEDED,
            event_metadata={"granted_roles": ["STUDENT"], "email_verification": "pending"},
        )
    )
    await session.commit()

    try:
        sent = await send_verification_email(to=user.email, full_name=user.full_name, raw_token=raw_token)
        if not sent and get_settings().environment.value != "production":
            logger.info("email.verify_link_dev user=%s (check server logs for link)", user.id)
    except Exception:
        logger.exception("email.verify_send_failed user=%s", user.id)
        # Do not fail signup because the email provider is unavailable; user can resend.

    return {
        "message": "Account created. Check your email to verify your address. You can log in now.",
        "email": user.email,
    }


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


async def verify_email(session: AsyncSession, raw_token: str) -> str:
    token_hash = _hash_token(raw_token)
    now = datetime.now(UTC)
    async with session.begin():
        token = await session.scalar(
            select(AuthActionToken)
            .where(
                AuthActionToken.token_hash == token_hash,
                AuthActionToken.action_type == AuthActionType.VERIFY_EMAIL,
                AuthActionToken.used_at.is_(None),
                AuthActionToken.expires_at > now,
            )
            .with_for_update()
        )
        if token is None:
            raise ValueError("Invalid or expired verification link")
        user = await session.get(User, token.user_id)
        if user is None or user.status != UserStatus.ACTIVE:
            raise ValueError("Invalid or expired verification link")
        token.used_at = now
        user.email_verified_at = user.email_verified_at or now
        session.add(
            AuditEvent(
                actor_user_id=user.id,
                actor_type=ActorType.USER,
                action="EMAIL_VERIFIED",
                target_type="USER",
                target_id=user.id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
            )
        )
    return "Email verified. You can continue to your account."


async def resend_verification(session: AsyncSession, email: str) -> str:
    settings = get_settings()
    normalized_email = email.strip().lower()
    user = await session.scalar(select(User).where(User.email == normalized_email))
    if user is None or user.status != UserStatus.ACTIVE or user.email_verified_at is not None:
        return GENERIC_VERIFY_SENT_MESSAGE
    async with session.begin():
        await session.execute(
            update(AuthActionToken)
            .where(
                AuthActionToken.user_id == user.id,
                AuthActionToken.action_type == AuthActionType.VERIFY_EMAIL,
                AuthActionToken.used_at.is_(None),
            )
            .values(used_at=datetime.now(UTC))
        )
        raw_token, token_hash = generate_action_token()
        session.add(
            AuthActionToken(
                user_id=user.id,
                action_type=AuthActionType.VERIFY_EMAIL,
                token_hash=token_hash,
                expires_at=datetime.now(UTC) + timedelta(minutes=settings.email_verify_ttl_minutes),
            )
        )
    try:
        await send_verification_email(to=user.email, full_name=user.full_name, raw_token=raw_token)
    except Exception:
        logger.exception("email.verify_resend_failed user=%s", user.id)
    return GENERIC_VERIFY_SENT_MESSAGE


async def request_password_reset(session: AsyncSession, email: str) -> str:
    settings = get_settings()
    normalized_email = email.strip().lower()
    user = await session.scalar(select(User).where(User.email == normalized_email))
    if user is None or user.status != UserStatus.ACTIVE:
        return GENERIC_FORGOT_MESSAGE
    async with session.begin():
        await session.execute(
            update(AuthActionToken)
            .where(
                AuthActionToken.user_id == user.id,
                AuthActionType.RESET_PASSWORD == AuthActionToken.action_type,
                AuthActionToken.used_at.is_(None),
            )
            .values(used_at=datetime.now(UTC))
        )
        raw_token, token_hash = generate_action_token()
        session.add(
            AuthActionToken(
                user_id=user.id,
                action_type=AuthActionType.RESET_PASSWORD,
                token_hash=token_hash,
                expires_at=datetime.now(UTC) + timedelta(minutes=settings.password_reset_ttl_minutes),
            )
        )
        session.add(
            AuditEvent(
                actor_user_id=user.id,
                actor_type=ActorType.USER,
                action="PASSWORD_RESET_REQUESTED",
                target_type="USER",
                target_id=user.id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
            )
        )
    try:
        await send_password_reset_email(to=user.email, full_name=user.full_name, raw_token=raw_token)
    except Exception:
        logger.exception("email.reset_send_failed user=%s", user.id)
    return GENERIC_FORGOT_MESSAGE


async def reset_password(session: AsyncSession, raw_token: str, new_password: str) -> str:
    token_hash = _hash_token(raw_token)
    now = datetime.now(UTC)
    async with session.begin():
        token = await session.scalar(
            select(AuthActionToken)
            .where(
                AuthActionToken.token_hash == token_hash,
                AuthActionToken.action_type == AuthActionType.RESET_PASSWORD,
                AuthActionToken.used_at.is_(None),
                AuthActionToken.expires_at > now,
            )
            .with_for_update()
        )
        if token is None:
            raise ValueError("Invalid or expired reset link")
        user = await session.get(User, token.user_id)
        if user is None or user.status != UserStatus.ACTIVE:
            raise ValueError("Invalid or expired reset link")
        token.used_at = now
        user.password_hash = await run_in_threadpool(hash_password, new_password)
        session.add(
            AuditEvent(
                actor_user_id=user.id,
                actor_type=ActorType.USER,
                action="PASSWORD_RESET_SUCCEEDED",
                target_type="USER",
                target_id=user.id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
            )
        )
    return "Password updated. Please log in with your new password."


def _hash_token(raw_token: str) -> str:
    import hashlib

    return hashlib.sha256(raw_token.encode()).hexdigest()


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


async def delete_my_account(session: AsyncSession, user_id: UUID) -> None:
    """Delete the authenticated user's account and user-owned records.

    Audit events are append-only in the application model; actor references are
    detached (SET NULL / nullable update) so history remains without blocking
    deletion.
    """
    from app.models.booking import Booking, IdempotencyKey
    from app.models.equipment import EquipmentReservation
    from app.models.event import EventRegistration
    from app.models.notification import Notification
    from app.models.organization_membership import OrganizationMembership
    from app.models.provider import ServiceProvider, ServiceRequest
    from app.models.scheduling import RecurringSchedule, VenueWaitlist
    from app.models.user_role import UserRoles
    from app.models.venue import VenueBlock

    async with session.begin():
        user = await session.get(User, user_id)
        if user is None:
            raise ValueError("User not found")
        session.add(
            AuditEvent(
                actor_user_id=user_id,
                actor_type=ActorType.USER,
                action="ACCOUNT_DELETE_REQUESTED",
                target_type="USER",
                target_id=user_id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
                event_metadata={"request_id": str(request_id_context.get())},
            )
        )
        await session.flush()

        # Detach append-only/nullable actor references.
        await session.execute(update(AuditEvent).where(AuditEvent.actor_user_id == user_id).values(actor_user_id=None))
        await session.execute(update(BookingEvent).where(BookingEvent.actor_user_id == user_id).values(actor_user_id=None))
        await session.execute(update(ServiceProvider).where(ServiceProvider.owner_user_id == user_id).values(owner_user_id=None))
        await session.execute(update(ServiceRequest).where(ServiceRequest.assigned_by_user_id == user_id).values(assigned_by_user_id=None))

        # Remove user-owned/dependent records (FKs are mostly RESTRICT).
        await session.execute(delete(Notification).where(Notification.user_id == user_id))
        await session.execute(delete(IdempotencyKey).where(IdempotencyKey.user_id == user_id))
        await session.execute(delete(EventRegistration).where(EventRegistration.user_id == user_id))
        await session.execute(delete(EquipmentReservation).where(EquipmentReservation.requester_id == user_id))
        await session.execute(delete(VenueWaitlist).where(VenueWaitlist.user_id == user_id))
        await session.execute(delete(RecurringSchedule).where(RecurringSchedule.user_id == user_id))
        await session.execute(delete(VenueBlock).where(VenueBlock.created_by == user_id))
        await session.execute(delete(ServiceRequest).where(ServiceRequest.requester_id == user_id))
        await session.execute(delete(BookingEvent).where(BookingEvent.actor_user_id == user_id))
        await session.execute(delete(BookingEvent).where(BookingEvent.booking_id.in_(select(Booking.id).where(Booking.requester_id == user_id))))
        await session.execute(delete(Booking).where(Booking.requester_id == user_id))
        await session.execute(delete(OrganizationMembership).where(OrganizationMembership.user_id == user_id))
        await session.execute(delete(UserRoles).where(UserRoles.user_id == user_id))

        # Assistant conversations (table name may exist in deployed DB).
        try:
            from app.models.conversation import Conversation
            await session.execute(delete(Conversation).where(Conversation.user_id == user_id))
        except Exception:
            pass

        await session.execute(delete(User).where(User.id == user_id))
