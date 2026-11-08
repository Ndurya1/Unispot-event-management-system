import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import IdempotencyKey
from app.models.scheduling import RecurringSchedule, RecurringStatus, VenueWaitlist, WaitlistStatus
from app.models.user import User
from app.models.venue import Venue
from app.schemas.scheduling import RecurringCreate, WaitlistCreate
from app.services.idempotency import lock_idempotency_key

IDEMPOTENCY_RETENTION = timedelta(hours=24)
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class SchedulingError(ValueError):
    pass


class SchedulingIdempotencyConflictError(SchedulingError):
    pass


def _time_to_minutes(value: str) -> int:
    h, m = value.split(":")
    return int(h) * 60 + int(m)


async def create_waitlist(session: AsyncSession, *, requester: User, data: WaitlistCreate, idempotency_key: str) -> VenueWaitlist:
    if not idempotency_key or len(idempotency_key) > 160:
        raise SchedulingError("Idempotency-Key must contain between 1 and 160 characters")
    if _time_to_minutes(data.requested_end) <= _time_to_minutes(data.requested_start):
        raise SchedulingError("requested_end must be later than requested_start")
    request_hash = _request_hash(data.model_dump(mode="json"))
    await session.rollback()
    async with session.begin():
        await session.refresh(requester)
        await lock_idempotency_key(session, requester.id, "create_waitlist", idempotency_key)
        record = await session.scalar(select(IdempotencyKey).where(IdempotencyKey.user_id == requester.id, IdempotencyKey.operation == "create_waitlist", IdempotencyKey.key == idempotency_key).with_for_update())
        if record is not None:
            if record.request_hash != request_hash:
                raise SchedulingIdempotencyConflictError("The idempotency key was already used with a different request")
            rid = _id_from_response(record.response_body, "waitlist_id")
            item = await session.scalar(select(VenueWaitlist).options(selectinload(VenueWaitlist.venue)).where(VenueWaitlist.id == rid)) if rid else None
            if item is None:
                raise SchedulingIdempotencyConflictError("The original waitlist entry no longer exists")
            return item
        venue = await session.scalar(select(Venue).where(Venue.id == data.venue_id))
        if venue is None:
            raise SchedulingError("Venue not found")
        item = VenueWaitlist(user_id=requester.id, venue_id=venue.id, venue=venue, requested_date=data.requested_date, requested_start=data.requested_start, requested_end=data.requested_end, event_name=data.event_name, status=WaitlistStatus.ACTIVE, active=True)
        session.add(item)
        await session.flush()
        session.add(IdempotencyKey(user_id=requester.id, operation="create_waitlist", key=idempotency_key, request_hash=request_hash, response_code=201, response_body={"waitlist_id": str(item.id)}, expires_at=datetime.now(UTC) + IDEMPOTENCY_RETENTION))
        await session.flush()
        return item


async def list_my_waitlists(session: AsyncSession, *, requester_id: UUID) -> list[VenueWaitlist]:
    result = await session.execute(select(VenueWaitlist).options(selectinload(VenueWaitlist.venue)).where(VenueWaitlist.user_id == requester_id).order_by(VenueWaitlist.created_at.desc()))
    return list(result.scalars().all())


async def cancel_waitlist(session: AsyncSession, *, requester_id: UUID, waitlist_id: UUID) -> VenueWaitlist:
    item = await session.scalar(select(VenueWaitlist).options(selectinload(VenueWaitlist.venue)).where(VenueWaitlist.id == waitlist_id, VenueWaitlist.user_id == requester_id))
    if item is None:
        raise SchedulingError("Waitlist entry not found")
    item.status = WaitlistStatus.CANCELLED
    item.active = False
    item.cancelled_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(item)
    return item


async def create_recurring(session: AsyncSession, *, requester: User, data: RecurringCreate, idempotency_key: str) -> RecurringSchedule:
    if not idempotency_key or len(idempotency_key) > 160:
        raise SchedulingError("Idempotency-Key must contain between 1 and 160 characters")
    if _time_to_minutes(data.end_time) <= _time_to_minutes(data.start_time):
        raise SchedulingError("end_time must be later than start_time")
    request_hash = _request_hash(data.model_dump(mode="json"))
    await session.rollback()
    async with session.begin():
        await session.refresh(requester)
        await lock_idempotency_key(session, requester.id, "create_recurring", idempotency_key)
        record = await session.scalar(select(IdempotencyKey).where(IdempotencyKey.user_id == requester.id, IdempotencyKey.operation == "create_recurring", IdempotencyKey.key == idempotency_key).with_for_update())
        if record is not None:
            if record.request_hash != request_hash:
                raise SchedulingIdempotencyConflictError("The idempotency key was already used with a different request")
            rid = _id_from_response(record.response_body, "recurring_id")
            item = await session.scalar(select(RecurringSchedule).options(selectinload(RecurringSchedule.venue)).where(RecurringSchedule.id == rid)) if rid else None
            if item is None:
                raise SchedulingIdempotencyConflictError("The original recurring schedule no longer exists")
            return item
        venue = await session.scalar(select(Venue).where(Venue.id == data.venue_id))
        if venue is None:
            raise SchedulingError("Venue not found")
        item = RecurringSchedule(user_id=requester.id, venue_id=venue.id, venue=venue, event_name=data.event_name, day_of_week=data.day_of_week, start_time=data.start_time, end_time=data.end_time, status=RecurringStatus.ACTIVE)
        session.add(item)
        await session.flush()
        session.add(IdempotencyKey(user_id=requester.id, operation="create_recurring", key=idempotency_key, request_hash=request_hash, response_code=201, response_body={"recurring_id": str(item.id)}, expires_at=datetime.now(UTC) + IDEMPOTENCY_RETENTION))
        await session.flush()
        return item


async def list_my_recurring(session: AsyncSession, *, requester_id: UUID) -> list[RecurringSchedule]:
    result = await session.execute(select(RecurringSchedule).options(selectinload(RecurringSchedule.venue)).where(RecurringSchedule.user_id == requester_id).order_by(RecurringSchedule.created_at.desc()))
    return list(result.scalars().all())


async def update_recurring_status(session: AsyncSession, *, requester_id: UUID, recurring_id: UUID, status: RecurringStatus) -> RecurringSchedule:
    item = await session.scalar(select(RecurringSchedule).options(selectinload(RecurringSchedule.venue)).where(RecurringSchedule.id == recurring_id, RecurringSchedule.user_id == requester_id))
    if item is None:
        raise SchedulingError("Recurring schedule not found")
    item.status = status
    item.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(item)
    return item


def _request_hash(payload: dict[str, object]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


async def list_all_waitlists(session: AsyncSession, *, limit: int = 200, offset: int = 0) -> list[VenueWaitlist]:
    result = await session.execute(select(VenueWaitlist).options(selectinload(VenueWaitlist.venue)).order_by(VenueWaitlist.created_at.desc()).limit(limit).offset(offset))
    return list(result.scalars().all())


async def list_all_recurring(session: AsyncSession, *, limit: int = 200, offset: int = 0) -> list[RecurringSchedule]:
    result = await session.execute(select(RecurringSchedule).options(selectinload(RecurringSchedule.venue)).order_by(RecurringSchedule.created_at.desc()).limit(limit).offset(offset))
    return list(result.scalars().all())


def _id_from_response(response_body: dict[str, object] | None, key: str) -> UUID | None:
    value = response_body.get(key) if response_body else None
    if not isinstance(value, str):
        return None
    try:
        return UUID(value)
    except ValueError:
        return None
