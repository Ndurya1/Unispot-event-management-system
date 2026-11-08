import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import IdempotencyKey
from app.models.event import CampusEvent, EventRegistration, EventRegistrationStatus, EventStatus
from app.models.notification import DeliveryStatus, Notification, NotificationChannel, NotificationType
from app.models.reservation import ReservationType, VenueReservation
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRoles
from app.models.venue import Venue
from app.schemas.event import EventCreate, EventRegistrationCreate, EventUpdate
from app.services.booking_policy import BookingPolicyError, validate_booking_policy
from app.services.idempotency import lock_idempotency_key

IDEMPOTENCY_RETENTION = timedelta(hours=24)
DEFAULT_EVENTS = [
    {"slug": "innovation-tech-day", "title": "Innovation & Tech Day", "description": "Join students, industry experts, and innovators for a day of technology, networking, and hands-on learning.", "category": "Workshop", "organizer": "KSU Tech Club", "location": "Main Campus", "starts_at": datetime(2026, 4, 12, 7, 0, tzinfo=UTC), "ends_at": datetime(2026, 4, 12, 13, 0, tzinfo=UTC), "capacity": 200},
    {"slug": "culture-fest", "title": "Culture Fest", "description": "A joyful afternoon of music, food, performances, and traditions from across the campus community.", "category": "Cultural", "organizer": "Culture Collective", "location": "Campus Grounds", "starts_at": datetime(2026, 4, 18, 9, 0, tzinfo=UTC), "ends_at": datetime(2026, 4, 18, 16, 0, tzinfo=UTC), "capacity": 500},
    {"slug": "leadership-workshop", "title": "Leadership Workshop", "description": "Build practical leadership skills and connect with mentors from across your university community.", "category": "Seminar", "organizer": "Student Leadership Network", "location": "Lecture Hall A", "starts_at": datetime(2026, 4, 25, 11, 0, tzinfo=UTC), "ends_at": datetime(2026, 4, 25, 14, 0, tzinfo=UTC), "capacity": 150},
]



async def _is_admin(session: AsyncSession, user_id: UUID) -> bool:
    result = await session.execute(select(Role.name).join(UserRoles, UserRoles.role_id == Role.id).where(UserRoles.user_id == user_id, Role.name == "SYSTEM_ADMIN"))
    return result.scalars().first() is not None

async def _has_event_manage_access(session: AsyncSession, *, event: CampusEvent, user: User) -> bool:
    if await _is_admin(session, user.id):
        return True
    # Strict ownership: only the creator can manage an event.
    if event.created_by_user_id and event.created_by_user_id == user.id:
        return True
    # Legacy rows (pre created_by_user_id) are admin-manageable only to avoid cross-organizer access.
    return False

async def _require_event_manage_access(session: AsyncSession, *, event: CampusEvent, user: User) -> None:
    if not await _has_event_manage_access(session, event=event, user=user):
        raise EventError("You do not have permission to manage this event")

class EventError(ValueError):
    pass


class EventConflictError(EventError):
    def __init__(self, message: str, remaining_capacity: int) -> None:
        super().__init__(message)
        self.remaining_capacity = remaining_capacity


class EventIdempotencyConflictError(EventError):
    pass


def _slugify(value: str) -> str:
    base = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    while "--" in base:
        base = base.replace("--", "-")
    return base[:110] or "event"


async def _confirmed_counts(session: AsyncSession, event_ids: list[UUID]) -> dict[UUID, int]:
    if not event_ids:
        return {}
    rows = await session.execute(
        select(EventRegistration.event_id, func.count()).where(EventRegistration.event_id.in_(event_ids), EventRegistration.active.is_(True)).group_by(EventRegistration.event_id)
    )
    return {event_id: int(total) for event_id, total in rows.all()}


def _event_payload(event: CampusEvent, confirmed: int) -> dict[str, object]:
    venue_name = None
    try:
        venue_name = event.venue.name if event.venue else None
    except Exception:
        venue_name = None
    return {
        "id": event.id, "slug": event.slug, "title": event.title, "description": event.description,
        "category": event.category, "organizer": event.organizer, "location": event.location,
        "venue_id": event.venue_id, "venue_name": venue_name, "organization_id": event.organization_id,
        "reservation_id": event.reservation_id, "expected_attendance": event.expected_attendance,
        "starts_at": event.starts_at, "ends_at": event.ends_at, "capacity": event.capacity,
        "status": event.status, "confirmed_registrations": confirmed, "remaining_capacity": max(event.capacity - confirmed, 0),
    }


async def _sync_event_reservation(session: AsyncSession, *, event: CampusEvent, actor: User, venue_id: UUID | None, organization_id: UUID | None, expected_attendance: int | None, starts_at, ends_at) -> None:
    """Create/update/release the venue reservation linked to an event. Caller manages transaction/commit where appropriate."""
    wants_venue = venue_id is not None
    if wants_venue and organization_id is None:
        raise EventError("organization_id is required when booking a venue for an event")
    attendance = expected_attendance if expected_attendance is not None else event.capacity
    if attendance is None or attendance < 1:
        raise EventError("expected_attendance (or capacity) must be positive for a venue reservation")

    # If no venue requested and none linked, nothing to do.
    if not wants_venue and event.reservation_id is None:
        event.venue_id = None
        event.organization_id = organization_id
        event.expected_attendance = expected_attendance
        return

    # Releasing venue
    if not wants_venue and event.reservation_id is not None:
        res = await session.get(VenueReservation, event.reservation_id)
        if res is not None:
            res.active = False
        event.venue_id = None
        event.organization_id = organization_id
        event.expected_attendance = expected_attendance
        event.reservation_id = None
        return

    # Need venue: validate policy/conflicts
    venue = await session.scalar(select(Venue).where(Venue.id == venue_id).with_for_update())
    if venue is None:
        raise EventError("Venue not found")
    try:
        if await _is_admin(session, actor.id):
            # Admins can create/manage venue-linked events; still check venue capacity/hours via venue policy? Skip membership but validate basics by direct checks below.
            pass
        await validate_booking_policy(session, requester=actor, organization_id=organization_id, venue=venue, starts_at=starts_at, ends_at=ends_at, expected_attendance=attendance)
    except BookingPolicyError as e:
        msgs = [f"{v.code}: {v.message}" for v in e.violations]
        # Admin path above didn't return; if admin, drop membership-only violations
        if await _is_admin(session, actor.id):
            msgs = [m for m in [f"{v.code}: {v.message}" for v in e.violations] if not m.startswith("organization_membership_required") and not m.startswith("user_inactive")]
        if msgs:
            raise EventError("Venue booking policy failed: " + "; ".join(msgs)) from e

    # Check attendance against capacity regardless
    if attendance > venue.capacity:
        raise EventError(f"expected_attendance exceeds venue capacity ({venue.capacity})")

    # Reuse existing reservation when venue unchanged; update its range (conflict caught by exclusion constraint).
    if event.reservation_id is not None and event.venue_id == venue_id:
        res = await session.scalar(select(VenueReservation).where(VenueReservation.id == event.reservation_id).with_for_update())
        if res is not None and res.active:
            res.occupied_range = func.tstzrange(starts_at, ends_at, "[)")
            res.venue_id = venue_id
            event.expected_attendance = attendance
            event.organization_id = organization_id
            if not (event.location or "").strip():
                event.location = venue.name
            return
        event.reservation_id = None

    # Release old reservation if switching venues
    if event.reservation_id is not None:
        old = await session.get(VenueReservation, event.reservation_id)
        if old is not None:
            old.active = False
        event.reservation_id = None

    res = VenueReservation(venue_id=venue_id, reservation_type=ReservationType.EVENT, occupied_range=func.tstzrange(starts_at, ends_at, "[)"), active=True)
    session.add(res)
    await session.flush()
    event.venue_id = venue_id
    event.organization_id = organization_id
    event.reservation_id = res.id
    event.expected_attendance = attendance
    if not (event.location or "").strip():
        event.location = venue.name



async def create_event(session: AsyncSession, *, data: EventCreate, actor: User) -> dict[str, object]:
    if data.ends_at <= data.starts_at:
        raise EventError("ends_at must be after starts_at")
    slug = _slugify(data.title)
    existing = await session.scalar(select(CampusEvent.id).where(CampusEvent.slug == slug))
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    await session.rollback()
    try:
        async with session.begin():
            await session.refresh(actor)
            event = CampusEvent(
                slug=slug, title=data.title.strip(), description=(data.description or "").strip() or None,
                category=(data.category or "").strip() or None, organizer=(data.organizer or actor.full_name or "Organizer").strip() or None,
                location=(data.location or "").strip() or None, starts_at=data.starts_at, ends_at=data.ends_at,
                capacity=data.capacity, status=data.status, created_by_user_id=actor.id,
                expected_attendance=data.expected_attendance,
            )
            session.add(event)
            await session.flush()
            if data.venue_id is not None and data.status != EventStatus.CANCELLED:
                await _sync_event_reservation(session, event=event, actor=actor, venue_id=data.venue_id, organization_id=data.organization_id, expected_attendance=data.expected_attendance or data.capacity, starts_at=data.starts_at, ends_at=data.ends_at)
            await session.flush()
            # eager attrs
            await session.refresh(event)
    except IntegrityError as exc:
        await session.rollback()
        if "ex_venue_reservation_time" in str(getattr(exc, "orig", exc)):
            raise EventConflictError("The selected venue/time conflicts with an existing reservation or block", remaining_capacity=0) from exc
        raise EventError("Could not create event") from exc
    # reload with venue
    loaded = await session.scalar(select(CampusEvent).options(selectinload(CampusEvent.venue)).where(CampusEvent.id == event.id))
    counts = await _confirmed_counts(session, [event.id])
    return _event_payload(loaded or event, counts.get(event.id, 0))


async def list_events(session: AsyncSession) -> list[dict[str, object]]:
    await _ensure_default_events(session)
    events = list((await session.execute(select(CampusEvent).options(selectinload(CampusEvent.venue)).where(CampusEvent.status == EventStatus.PUBLISHED).order_by(CampusEvent.starts_at))).scalars().all())
    counts = await _confirmed_counts(session, [event.id for event in events])
    return [_event_payload(event, counts.get(event.id, 0)) for event in events]


async def list_all_events(session: AsyncSession, *, include_cancelled: bool = True, limit: int = 200, offset: int = 0) -> list[dict[str, object]]:
    stmt = select(CampusEvent).options(selectinload(CampusEvent.venue)).order_by(CampusEvent.starts_at.desc()).limit(limit).offset(offset)
    if not include_cancelled:
        stmt = stmt.where(CampusEvent.status != EventStatus.CANCELLED)
    events = list((await session.execute(stmt)).scalars().all())
    counts = await _confirmed_counts(session, [event.id for event in events])
    return [_event_payload(event, counts.get(event.id, 0)) for event in events]


async def get_event_by_id(session: AsyncSession, event_id: UUID) -> CampusEvent | None:
    return await session.scalar(select(CampusEvent).options(selectinload(CampusEvent.venue)).where(CampusEvent.id == event_id))


async def update_event(session: AsyncSession, *, event_id: UUID, data: EventUpdate, actor: User, notify_registrants: bool = True) -> dict[str, object]:
    await session.rollback()
    try:
        async with session.begin():
            await session.refresh(actor)
            event = await session.scalar(select(CampusEvent).options(selectinload(CampusEvent.venue)).where(CampusEvent.id == event_id).with_for_update())
            if event is None:
                raise EventError("Event not found")
            confirmed = int(await session.scalar(select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == event_id, EventRegistration.active.is_(True))) or 0)
            if data.capacity is not None and data.capacity < confirmed:
                raise EventError(f"capacity cannot be lower than confirmed registrations ({confirmed})")
            changed = []
            for field, value in [("title", data.title), ("description", data.description), ("category", data.category), ("organizer", data.organizer), ("location", data.location), ("starts_at", data.starts_at), ("ends_at", data.ends_at), ("capacity", data.capacity), ("status", data.status), ("expected_attendance", data.expected_attendance)]:
                if value is not None:
                    changed.append(field)
                    setattr(event, field, value.strip() if isinstance(value, str) else value)
            if event.ends_at <= event.starts_at:
                raise EventError("ends_at must be after starts_at")
            if data.starts_at is not None and event.starts_at < datetime.now(UTC) and event.status != EventStatus.CANCELLED:
                raise EventError("Cannot move an active event start time into the past")

            venue_fields_touched = any(v is not None for v in [data.venue_id, data.organization_id, data.starts_at, data.ends_at, data.capacity, data.expected_attendance, data.status])
            target_venue = data.venue_id if data.venue_id is not None else event.venue_id
            target_org = data.organization_id if data.organization_id is not None else event.organization_id
            target_att = data.expected_attendance if data.expected_attendance is not None else (event.expected_attendance or event.capacity)
            if event.status == EventStatus.CANCELLED and event.reservation_id is not None:
                res = await session.get(VenueReservation, event.reservation_id)
                if res is not None: res.active = False
                event.reservation_id = None
            elif venue_fields_touched or target_venue is not None:
                await _sync_event_reservation(session, event=event, actor=actor, venue_id=target_venue, organization_id=target_org, expected_attendance=target_att, starts_at=event.starts_at, ends_at=event.ends_at)

            if notify_registrants and changed and event.status != EventStatus.CANCELLED:
                rows = (await session.execute(select(EventRegistration.user_id).where(EventRegistration.event_id == event_id, EventRegistration.active.is_(True)))).all()
                for (user_id,) in rows:
                    session.add(Notification(user_id=user_id, type=NotificationType.EVENT_UPDATED, channel=NotificationChannel.IN_APP, title="Event updated", body=f"{event.title} was updated. Please review the latest details, time, and location.", delivery_status=DeliveryStatus.PENDING))
            if notify_registrants and data.status == EventStatus.CANCELLED:
                rows = (await session.execute(select(EventRegistration.user_id).where(EventRegistration.event_id == event_id, EventRegistration.active.is_(True)))).all()
                for (user_id,) in rows:
                    session.add(Notification(user_id=user_id, type=NotificationType.EVENT_CANCELLED, channel=NotificationChannel.IN_APP, title="Event cancelled", body=f"{event.title} has been cancelled.", delivery_status=DeliveryStatus.PENDING))
    except IntegrityError as exc:
        await session.rollback()
        if "ex_venue_reservation_time" in str(getattr(exc, "orig", exc)):
            raise EventConflictError("The updated event time/venue conflicts with an existing reservation or block", remaining_capacity=0) from exc
        raise EventError("Could not update event") from exc
    loaded = await session.scalar(select(CampusEvent).options(selectinload(CampusEvent.venue)).where(CampusEvent.id == event_id))
    counts = await _confirmed_counts(session, [event_id])
    return _event_payload(loaded, counts.get(event_id, 0)) if loaded else {"id": event_id}


async def cancel_event(session: AsyncSession, *, event_id: UUID, actor: User | None = None, notify_registrants: bool = True) -> dict[str, object]:
    await session.rollback()
    async with session.begin():
        event = await session.scalar(select(CampusEvent).options(selectinload(CampusEvent.venue)).where(CampusEvent.id == event_id).with_for_update())
        if event is None:
            raise EventError("Event not found")
        already_cancelled = event.status == EventStatus.CANCELLED
        event.status = EventStatus.CANCELLED
        if event.reservation_id is not None:
            res = await session.get(VenueReservation, event.reservation_id)
            if res is not None:
                res.active = False
            event.reservation_id = None
        if notify_registrants and not already_cancelled:
            rows = (await session.execute(select(EventRegistration.user_id).where(EventRegistration.event_id == event_id, EventRegistration.active.is_(True)))).all()
            for (user_id,) in rows:
                session.add(Notification(user_id=user_id, type=NotificationType.EVENT_CANCELLED, channel=NotificationChannel.IN_APP, title="Event cancelled", body=f"{event.title} has been cancelled. Any linked venue reservation was released.", delivery_status=DeliveryStatus.PENDING))
    loaded = await session.scalar(select(CampusEvent).options(selectinload(CampusEvent.venue)).where(CampusEvent.id == event_id))
    counts = await _confirmed_counts(session, [event_id])
    return _event_payload(loaded, counts.get(event_id, 0)) if loaded else {"id": event_id}


async def create_event_registration(session: AsyncSession, *, requester: User, data: EventRegistrationCreate, idempotency_key: str) -> EventRegistration:
    if not idempotency_key or len(idempotency_key) > 160:
        raise EventError("Idempotency-Key must contain between 1 and 160 characters")
    request_hash = _request_hash(data)
    await session.rollback()
    try:
        async with session.begin():
            await session.refresh(requester)
            await lock_idempotency_key(session, requester.id, "create_event_registration", idempotency_key)
            record = await session.scalar(select(IdempotencyKey).where(IdempotencyKey.user_id == requester.id, IdempotencyKey.operation == "create_event_registration", IdempotencyKey.key == idempotency_key).with_for_update())
            if record is not None:
                if record.request_hash != request_hash:
                    raise EventIdempotencyConflictError("The idempotency key was already used with a different request")
                registration_id = _registration_id_from_response(record.response_body)
                if registration_id is None:
                    raise EventIdempotencyConflictError("The idempotency key has no replayable result")
                registration = await session.scalar(select(EventRegistration).options(selectinload(EventRegistration.event)).where(EventRegistration.id == registration_id))
                if registration is None:
                    raise EventIdempotencyConflictError("The original registration no longer exists")
                return registration
            event = await session.scalar(select(CampusEvent).where(CampusEvent.id == data.event_id, CampusEvent.status == EventStatus.PUBLISHED).with_for_update())
            if event is None:
                raise EventError("Event not found")
            existing = await session.scalar(select(EventRegistration).options(selectinload(EventRegistration.event)).where(EventRegistration.event_id == event.id, EventRegistration.user_id == requester.id, EventRegistration.active.is_(True)))
            if existing is not None:
                return existing
            confirmed = int(await session.scalar(select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == event.id, EventRegistration.active.is_(True))) or 0)
            remaining = event.capacity - confirmed
            if remaining < 1:
                raise EventConflictError("This event is fully booked", remaining_capacity=0)
            registration = EventRegistration(event_id=event.id, event=event, user_id=requester.id, full_name=data.full_name, email=str(data.email), phone=data.phone, student_id=data.student_id, status=EventRegistrationStatus.CONFIRMED, active=True)
            session.add(registration)
            await session.flush()
            session.add(IdempotencyKey(user_id=requester.id, operation="create_event_registration", key=idempotency_key, request_hash=request_hash, response_code=201, response_body={"registration_id": str(registration.id)}, expires_at=datetime.now(UTC) + IDEMPOTENCY_RETENTION))
            await session.flush()
            return registration
    except IntegrityError:
        await session.rollback()
        replay = await session.scalar(select(EventRegistration).options(selectinload(EventRegistration.event)).where(EventRegistration.event_id == data.event_id, EventRegistration.user_id == requester.id, EventRegistration.active.is_(True)))
        if replay is not None:
            return replay
        raise


async def list_my_event_registrations(session: AsyncSession, *, requester_id: UUID) -> list[EventRegistration]:
    result = await session.execute(select(EventRegistration).options(selectinload(EventRegistration.event)).where(EventRegistration.user_id == requester_id).order_by(EventRegistration.created_at.desc()))
    return list(result.scalars().all())


async def list_all_event_registrations(session: AsyncSession, *, limit: int = 200, offset: int = 0) -> list[EventRegistration]:
    result = await session.execute(select(EventRegistration).options(selectinload(EventRegistration.event)).order_by(EventRegistration.created_at.desc()).limit(limit).offset(offset))
    return list(result.scalars().all())


async def list_event_registrations_for_manager(session: AsyncSession, *, event_id: UUID, actor: User) -> list[EventRegistration]:
    event = await get_event_by_id(session, event_id)
    if event is None:
        raise EventError("Event not found")
    await _require_event_manage_access(session, event=event, user=actor)
    result = await session.execute(select(EventRegistration).options(selectinload(EventRegistration.event)).where(EventRegistration.event_id == event_id).order_by(EventRegistration.created_at.desc()))
    return list(result.scalars().all())

async def get_event_attendance(session: AsyncSession, *, event_id: UUID, actor: User | None = None) -> dict[str, object]:
    event = await session.scalar(select(CampusEvent).options(selectinload(CampusEvent.venue)).where(CampusEvent.id == event_id))
    if event is None:
        raise EventError("Event not found")
    if actor is not None:
        await _require_event_manage_access(session, event=event, user=actor)
    total = int(await session.scalar(select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == event_id, EventRegistration.active.is_(True))) or 0)
    checked = int(await session.scalar(select(func.count()).select_from(EventRegistration).where(EventRegistration.event_id == event_id, EventRegistration.active.is_(True), EventRegistration.checked_in_at.is_not(None))) or 0)
    not_checked = max(total - checked, 0)
    rate = round((checked / total) * 100, 1) if total else 0.0
    return {"event_id": event.id, "event_title": event.title, "total_registered": total, "checked_in": checked, "not_checked_in": not_checked, "attendance_rate": rate}


async def check_in_registration(session: AsyncSession, *, registration_id: UUID, requester: User, allow_event_manager: bool = True) -> EventRegistration:
    registration = await session.scalar(select(EventRegistration).options(selectinload(EventRegistration.event)).where(EventRegistration.id == registration_id, EventRegistration.active.is_(True)))
    if registration is None:
        raise EventError("Registration not found")
    if registration.user_id != requester.id:
        if not allow_event_manager:
            raise EventError("You do not have access to this ticket")
        event = await get_event_by_id(session, registration.event_id)
        if event is None or not await _has_event_manage_access(session, event=event, user=requester):
            raise EventError("You do not have permission to check in this ticket")
    if registration.checked_in_at is None:
        registration.checked_in_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(registration)
    return registration


async def _ensure_default_events(session: AsyncSession) -> None:
    count = await session.scalar(select(func.count()).select_from(CampusEvent))
    if count:
        return
    for row in DEFAULT_EVENTS:
        session.add(CampusEvent(**row, status=EventStatus.PUBLISHED))
    await session.commit()


def _request_hash(data: EventRegistrationCreate) -> str:
    return hashlib.sha256(json.dumps(data.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _registration_id_from_response(response_body: dict[str, object] | None) -> UUID | None:
    value = response_body.get("registration_id") if response_body else None
    if not isinstance(value, str):
        return None
    try:
        return UUID(value)
    except ValueError:
        return None








async def list_manageable_events(session: AsyncSession, *, actor: User) -> list[dict[str, object]]:
    if await _is_admin(session, actor.id):
        return await list_all_events(session, include_cancelled=True, limit=500)
    # Creator-owned events only for organizers; admins see all via branch above. Legacy creatorless rows are admin-managed.
    stmt = select(CampusEvent).options(selectinload(CampusEvent.venue)).where(CampusEvent.created_by_user_id == actor.id).order_by(CampusEvent.starts_at.desc()).limit(500)
    events = list((await session.execute(stmt)).scalars().all())
    counts = await _confirmed_counts(session, [event.id for event in events])
    return [_event_payload(event, counts.get(event.id, 0)) for event in events]
