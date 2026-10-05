import re
from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_event import ActorType, AuditEvent, AuditOutcome
from app.models.booking import BookingSource
from app.models.facility import Facility, VenueFacility
from app.models.reservation import ReservationType, VenueReservation
from app.models.venue import Venue, VenueStatus
from app.models.venue_block import BlockStatus, VenueBlock
from app.models.venue_operating_hours import VenueOperatingHours


def _venue_code(name: str) -> str:
    code = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").upper()
    return (code or "VENUE")[:40]


async def create_venue(
    session: AsyncSession, *, actor_id: UUID | None = None, **values: object
) -> Venue:
    if not values.get("code"):
        values["code"] = _venue_code(str(values["name"]))
    venue = Venue(**values)
    session.add(venue)
    try:
        await session.flush()
        session.add(
            AuditEvent(
                actor_user_id=actor_id,
                actor_type=ActorType.USER if actor_id else ActorType.SYSTEM,
                action="VENUE_CREATED",
                target_type="VENUE",
                target_id=venue.id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
            )
        )
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Venue name or code already exists") from error
    await session.refresh(venue)
    return venue


async def list_venues(
    session: AsyncSession,
    *,
    capacity: int | None = None,
    location: str | None = None,
    facility_id: UUID | None = None,
    status: VenueStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Venue]:
    conditions = [] if status is not None else [Venue.status != VenueStatus.INACTIVE]
    if capacity is not None:
        conditions.append(Venue.capacity >= capacity)
    if location:
        conditions.append(Venue.location.ilike(f"%{location}%"))
    if status is not None:
        conditions.append(Venue.status == status)
    statement = (
        select(Venue).where(and_(*conditions)).order_by(Venue.name).limit(limit).offset(offset)
    )
    if facility_id is not None:
        statement = statement.join(VenueFacility).where(VenueFacility.facility_id == facility_id)
    result = await session.execute(statement)
    return list(result.scalars().unique().all())


async def get_venue(session: AsyncSession, venue_id: UUID) -> Venue | None:
    return await session.get(Venue, venue_id)


async def update_venue(
    session: AsyncSession, venue: Venue, *, actor_id: UUID | None = None, **values: object
) -> Venue:
    for key, value in values.items():
        if value is not None:
            setattr(venue, key, value)
    try:
        venue.updated_at = datetime.now().astimezone()
        session.add(
            AuditEvent(
                actor_user_id=actor_id,
                actor_type=ActorType.USER if actor_id else ActorType.SYSTEM,
                action="VENUE_UPDATED",
                target_type="VENUE",
                target_id=venue.id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
            )
        )
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Venue name or code already exists") from error
    await session.refresh(venue)
    return venue


async def create_facility(
    session: AsyncSession, name: str, *, actor_id: UUID | None = None
) -> Facility:
    facility = Facility(name=name)
    session.add(facility)
    try:
        await session.flush()
        session.add(
            AuditEvent(
                actor_user_id=actor_id,
                actor_type=ActorType.USER if actor_id else ActorType.SYSTEM,
                action="FACILITY_CREATED",
                target_type="FACILITY",
                target_id=facility.id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
            )
        )
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Facility already exists") from error
    await session.refresh(facility)
    return facility


async def list_facilities(
    session: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[Facility]:
    result = await session.execute(
        select(Facility).order_by(Facility.name).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def update_facility(
    session: AsyncSession, facility_id: UUID, name: str, *, actor_id: UUID | None = None
) -> Facility:
    facility = await session.get(Facility, facility_id)
    if facility is None:
        raise ValueError("Facility not found")
    facility.name = name
    try:
        session.add(
            AuditEvent(
                actor_user_id=actor_id,
                actor_type=ActorType.USER if actor_id else ActorType.SYSTEM,
                action="FACILITY_UPDATED",
                target_type="FACILITY",
                target_id=facility.id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
            )
        )
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Facility already exists") from error
    await session.refresh(facility)
    return facility


async def delete_facility(
    session: AsyncSession, facility_id: UUID, *, actor_id: UUID | None = None
) -> None:
    facility = await session.get(Facility, facility_id)
    if facility is None:
        raise ValueError("Facility not found")
    try:
        session.add(
            AuditEvent(
                actor_user_id=actor_id,
                actor_type=ActorType.USER if actor_id else ActorType.SYSTEM,
                action="FACILITY_DELETED",
                target_type="FACILITY",
                target_id=facility.id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
            )
        )
        await session.delete(facility)
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Facility is still linked to a venue") from error


async def link_facility(
    session: AsyncSession,
    venue_id: UUID,
    facility_id: UUID,
    notes: str | None,
    *,
    actor_id: UUID | None = None,
) -> VenueFacility:
    if await session.get(Venue, venue_id) is None:
        raise ValueError("Venue not found")
    if await session.get(Facility, facility_id) is None:
        raise ValueError("Facility not found")
    link = VenueFacility(venue_id=venue_id, facility_id=facility_id, notes=notes)
    session.add(link)
    try:
        await session.flush()
        session.add(
            AuditEvent(
                actor_user_id=actor_id,
                actor_type=ActorType.USER if actor_id else ActorType.SYSTEM,
                action="FACILITY_LINKED",
                target_type="VENUE",
                target_id=venue_id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
                event_metadata={"facility_id": str(facility_id)},
            )
        )
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Venue already has this facility") from error
    await session.refresh(link)
    return link


async def add_operating_hours(
    session: AsyncSession,
    venue_id: UUID,
    day_of_week: int,
    opens_at: object,
    closes_at: object,
    *,
    actor_id: UUID | None = None,
) -> VenueOperatingHours:
    if await session.get(Venue, venue_id) is None:
        raise ValueError("Venue not found")
    hours = VenueOperatingHours(
        venue_id=venue_id,
        day_of_week=day_of_week,
        opens_at=opens_at,
        closes_at=closes_at,
    )
    session.add(hours)
    try:
        await session.flush()
        session.add(
            AuditEvent(
                actor_user_id=actor_id,
                actor_type=ActorType.USER if actor_id else ActorType.SYSTEM,
                action="OPERATING_HOURS_CREATED",
                target_type="VENUE",
                target_id=venue_id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
                event_metadata={"day_of_week": day_of_week},
            )
        )
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Invalid or duplicate operating-hours rule") from error
    await session.refresh(hours)
    return hours


async def list_operating_hours(session: AsyncSession, venue_id: UUID) -> list[VenueOperatingHours]:
    if await session.get(Venue, venue_id) is None:
        raise ValueError("Venue not found")
    result = await session.execute(
        select(VenueOperatingHours)
        .where(VenueOperatingHours.venue_id == venue_id)
        .order_by(VenueOperatingHours.day_of_week)
    )
    return list(result.scalars().all())


async def create_block(
    session: AsyncSession,
    venue_id: UUID,
    starts_at: datetime,
    ends_at: datetime,
    reason: str,
    created_by: UUID,
) -> VenueBlock:
    venue = (
        await session.execute(select(Venue).where(Venue.id == venue_id).with_for_update())
    ).scalar_one_or_none()
    if venue is None:
        raise ValueError("Venue not found")
    reservation = VenueReservation(
        venue_id=venue_id,
        reservation_type=ReservationType.BLOCK,
        occupied_range=func.tstzrange(starts_at, ends_at, "[)"),
        active=True,
    )
    session.add(reservation)
    await session.flush()
    block = VenueBlock(
        reservation_id=reservation.id,
        venue_id=venue_id,
        starts_at=starts_at,
        ends_at=ends_at,
        reason=reason,
        status=BlockStatus.ACTIVE,
        created_by=created_by,
    )
    session.add(block)
    try:
        await session.flush()
        session.add(
            AuditEvent(
                actor_user_id=created_by,
                actor_type=ActorType.USER,
                action="BLOCK_CREATED",
                target_type="BLOCK",
                target_id=block.id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.SUCCEEDED,
                event_metadata={"reason": reason},
            )
        )
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Block overlaps an active reservation or is invalid") from error
    await session.refresh(block)
    return block


async def cancel_block(
    session: AsyncSession, block_id: UUID, *, actor_id: UUID | None = None
) -> VenueBlock:
    block = await session.get(VenueBlock, block_id)
    if block is None:
        raise ValueError("Block not found")
    if block.status == BlockStatus.CANCELLED:
        return block
    block.status = BlockStatus.CANCELLED
    block.cancelled_at = datetime.now().astimezone()
    reservation = await session.get(VenueReservation, block.reservation_id)
    if reservation is not None:
        reservation.active = False
    session.add(
        AuditEvent(
            actor_user_id=actor_id,
            actor_type=ActorType.USER if actor_id else ActorType.SYSTEM,
            action="BLOCK_CANCELLED",
            target_type="BLOCK",
            target_id=block.id,
            channel=BookingSource.WEB,
            outcome=AuditOutcome.SUCCEEDED,
        )
    )
    await session.commit()
    await session.refresh(block)
    return block


async def find_available_venues(
    session: AsyncSession,
    starts_at: datetime,
    ends_at: datetime,
    *,
    capacity: int | None = None,
    location: str | None = None,
    facility_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Venue]:
    overlap = exists(
        select(VenueReservation.id).where(
            VenueReservation.venue_id == Venue.id,
            VenueReservation.active.is_(True),
            VenueReservation.occupied_range.op("&&")(func.tstzrange(starts_at, ends_at, "[)")),
        )
    )
    conditions = [Venue.status == VenueStatus.ACTIVE, ~overlap]
    if capacity is not None:
        conditions.append(Venue.capacity >= capacity)
    if location:
        conditions.append(Venue.location.ilike(f"%{location}%"))
    statement = (
        select(Venue).where(and_(*conditions)).order_by(Venue.name).offset(offset).limit(limit)
    )
    if facility_id is not None:
        statement = statement.join(VenueFacility).where(VenueFacility.facility_id == facility_id)
    result = await session.execute(statement)
    return list(result.scalars().unique().all())
