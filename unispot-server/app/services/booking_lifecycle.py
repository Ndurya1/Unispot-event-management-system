import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_event import ActorType, AuditEvent, AuditOutcome
from app.models.booking import Booking, BookingSource, BookingStatus, IdempotencyKey
from app.models.booking_event import BookingEvent, BookingEventType
from app.models.notification import (
    DeliveryStatus,
    Notification,
    NotificationChannel,
    NotificationType,
)
from app.models.reservation import VenueReservation
from app.models.user import User
from app.schemas.booking import BookingCancelRequest

CANCELLATION_MIN_NOTICE = timedelta(hours=24)
IDEMPOTENCY_RETENTION = timedelta(hours=24)


class CancellationError(ValueError):
    pass


async def list_my_bookings(
    session: AsyncSession,
    *,
    requester_id: UUID,
    status: BookingStatus | None = None,
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Booking]:
    conditions = [Booking.requester_id == requester_id]
    if status is not None:
        conditions.append(Booking.status == status)
    if starts_from is not None:
        conditions.append(Booking.starts_at >= starts_from)
    if starts_to is not None:
        conditions.append(Booking.starts_at < starts_to)
    result = await session.execute(
        select(Booking)
        .where(*conditions)
        .order_by(Booking.starts_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_owned_booking(
    session: AsyncSession, booking_id: UUID, requester_id: UUID
) -> Booking | None:
    return await session.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.requester_id == requester_id,
        )
    )


async def list_allocations(
    session: AsyncSession,
    *,
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
    venue_id: UUID | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Booking]:
    conditions = [Booking.status != BookingStatus.CANCELLED]
    if starts_from is not None:
        conditions.append(Booking.starts_at >= starts_from)
    if starts_to is not None:
        conditions.append(Booking.starts_at < starts_to)
    if venue_id is not None:
        conditions.append(Booking.venue_id == venue_id)
    result = await session.execute(
        select(Booking)
        .options(selectinload(Booking.venue))
        .where(*conditions)
        .order_by(Booking.starts_at)
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def cancel_booking(
    session: AsyncSession,
    *,
    booking_id: UUID,
    requester: User,
    data: BookingCancelRequest,
    idempotency_key: str,
) -> Booking:
    if not idempotency_key or len(idempotency_key) > 160:
        raise ValueError("Idempotency-Key must contain between 1 and 160 characters")
    request_hash = _cancel_request_hash(booking_id, data)
    await session.rollback()
    try:
        async with session.begin():
            existing = await session.scalar(
                select(IdempotencyKey)
                .where(
                    IdempotencyKey.user_id == requester.id,
                    IdempotencyKey.operation == "cancel_booking",
                    IdempotencyKey.key == idempotency_key,
                )
                .with_for_update()
            )
            if existing is not None:
                if existing.request_hash != request_hash:
                    raise CancellationError(
                        "The idempotency key was already used with a different request"
                    )
                replay_id = _booking_id_from_response(existing.response_body)
                if replay_id is None:
                    raise CancellationError("The idempotency key has no replayable result")
                replay = await session.get(Booking, replay_id)
                if replay is None:
                    raise CancellationError("The original booking no longer exists")
                return replay

            booking = await session.scalar(
                select(Booking)
                .where(Booking.id == booking_id, Booking.requester_id == requester.id)
                .with_for_update()
            )
            if booking is None:
                raise CancellationError("Booking not found")
            if booking.status is not BookingStatus.CONFIRMED:
                raise CancellationError("Only confirmed bookings can be cancelled")
            if booking.starts_at <= datetime.now(UTC) + CANCELLATION_MIN_NOTICE:
                raise CancellationError(
                    "Bookings can only be cancelled at least 24 hours before they start"
                )

            reservation = await session.scalar(
                select(VenueReservation)
                .where(VenueReservation.id == booking.reservation_id)
                .with_for_update()
            )
            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = datetime.now(UTC)
            booking.updated_at = booking.cancelled_at
            booking.cancellation_reason = data.reason
            if reservation is not None:
                reservation.active = False
            session.add(
                BookingEvent(
                    booking_id=booking.id,
                    event_type=BookingEventType.CANCELLED,
                    actor_user_id=requester.id,
                    source=BookingSource.WEB,
                    reason=data.reason,
                )
            )
            session.add(
                Notification(
                    user_id=requester.id,
                    booking_id=booking.id,
                    type=NotificationType.CANCELLED,
                    channel=NotificationChannel.IN_APP,
                    title="Booking cancelled",
                    body=f"Booking {booking.confirmation_code} has been cancelled.",
                    delivery_status=DeliveryStatus.PENDING,
                )
            )
            session.add(
                AuditEvent(
                    actor_user_id=requester.id,
                    actor_type=ActorType.USER,
                    action="BOOKING_CANCELLED",
                    target_type="BOOKING",
                    target_id=booking.id,
                    channel=BookingSource.WEB,
                    outcome=AuditOutcome.SUCCEEDED,
                    event_metadata={"reason": data.reason} if data.reason else {},
                )
            )
            session.add(
                IdempotencyKey(
                    user_id=requester.id,
                    operation="cancel_booking",
                    key=idempotency_key,
                    request_hash=request_hash,
                    response_code=200,
                    response_body={"booking_id": str(booking.id)},
                    expires_at=datetime.now(UTC) + IDEMPOTENCY_RETENTION,
                )
            )
            await session.flush()
            return booking
    except IntegrityError as error:
        await session.rollback()
        raise CancellationError("The booking could not be cancelled") from error


async def list_my_notifications(
    session: AsyncSession, *, user_id: UUID, limit: int = 50, offset: int = 0
) -> list[Notification]:
    result = await session.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def mark_notification_read(
    session: AsyncSession, *, notification_id: UUID, user_id: UUID
) -> Notification:
    notification = await session.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    if notification is None:
        raise ValueError("Notification not found")
    notification.delivery_status = DeliveryStatus.READ
    notification.read_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(notification)
    return notification


def _cancel_request_hash(booking_id: UUID, data: BookingCancelRequest) -> str:
    payload = {"booking_id": str(booking_id), "reason": data.reason}
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _booking_id_from_response(response_body: dict[str, object] | None) -> UUID | None:
    if response_body is None:
        return None
    value = response_body.get("booking_id")
    if not isinstance(value, str):
        return None
    try:
        return UUID(value)
    except ValueError:
        return None
