import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingSource, IdempotencyKey
from app.models.booking_event import BookingEvent, BookingEventType
from app.models.reservation import ReservationType, VenueReservation
from app.models.user import User
from app.models.venue import Venue
from app.schemas.booking import BookingCreate
from app.services.booking_policy import BookingPolicyError, validate_booking_policy

IDEMPOTENCY_RETENTION = timedelta(hours=24)


class BookingConflictError(ValueError):
    """Raised when PostgreSQL rejects an overlapping occupied interval."""


class IdempotencyConflictError(ValueError):
    """Raised when a key is reused with a different request payload."""


async def create_booking(
    session: AsyncSession,
    *,
    requester: User,
    data: BookingCreate,
    idempotency_key: str,
    source: BookingSource = BookingSource.WEB,
) -> Booking:
    if not idempotency_key or len(idempotency_key) > 160:
        raise ValueError("Idempotency-Key must contain between 1 and 160 characters")

    request_hash = _request_hash(data)
    # get_current_user has already read from this session.  End that read-only
    # transaction before starting the atomic booking transaction.
    await session.rollback()

    try:
        async with session.begin():
            existing = await session.scalar(
                select(IdempotencyKey)
                .where(
                    IdempotencyKey.user_id == requester.id,
                    IdempotencyKey.operation == "create_booking",
                    IdempotencyKey.key == idempotency_key,
                )
                .with_for_update()
            )
            if existing is not None:
                if existing.request_hash != request_hash:
                    raise IdempotencyConflictError(
                        "The idempotency key was already used with a different request"
                    )
                booking_id = _booking_id_from_response(existing.response_body)
                if booking_id is None:
                    raise IdempotencyConflictError("The idempotency key has no replayable result")
                booking = await session.get(Booking, booking_id)
                if booking is None:
                    raise IdempotencyConflictError("The original booking no longer exists")
                return booking

            venue = await session.scalar(
                select(Venue).where(Venue.id == data.venue_id).with_for_update()
            )
            if venue is None:
                raise ValueError("Venue not found")

            await validate_booking_policy(
                session,
                requester=requester,
                organization_id=data.organization_id,
                venue=venue,
                starts_at=data.starts_at,
                ends_at=data.ends_at,
                expected_attendance=data.expected_attendance,
            )

            reservation = VenueReservation(
                venue_id=venue.id,
                reservation_type=ReservationType.BOOKING,
                occupied_range=func.tstzrange(data.starts_at, data.ends_at, "[)"),
                active=True,
            )
            session.add(reservation)
            await session.flush()

            booking = Booking(
                venue_id=venue.id,
                requester_id=requester.id,
                organization_id=data.organization_id,
                reservation_id=reservation.id,
                event_name=data.event_name,
                event_description=data.event_description,
                expected_attendance=data.expected_attendance,
                starts_at=data.starts_at,
                ends_at=data.ends_at,
                source=source,
            )
            session.add(booking)
            await session.flush()
            session.add(
                BookingEvent(
                    booking_id=booking.id,
                    event_type=BookingEventType.CREATED,
                    actor_user_id=requester.id,
                    source=source,
                    event_metadata={"confirmation_code": booking.confirmation_code},
                )
            )
            session.add(
                BookingEvent(
                    booking_id=booking.id,
                    event_type=BookingEventType.CONFIRMED,
                    actor_user_id=requester.id,
                    source=source,
                )
            )
            session.add(
                IdempotencyKey(
                    user_id=requester.id,
                    operation="create_booking",
                    key=idempotency_key,
                    request_hash=request_hash,
                    response_code=201,
                    response_body={"booking_id": str(booking.id)},
                    expires_at=datetime.now(UTC) + IDEMPOTENCY_RETENTION,
                )
            )
            await session.flush()
            return booking
    except IntegrityError as error:
        await session.rollback()
        if "ex_venue_reservation_time" in str(error.orig):
            raise BookingConflictError(
                "The requested venue interval is no longer available"
            ) from error
        if "idempotency" in str(error.orig).lower():
            raise IdempotencyConflictError("The idempotency key is already being used") from error
        raise


def _request_hash(data: BookingCreate) -> str:
    serialized = json.dumps(data.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
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


__all__ = [
    "BookingConflictError",
    "BookingPolicyError",
    "IdempotencyConflictError",
    "create_booking",
]
