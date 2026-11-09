import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import IdempotencyKey
from app.models.equipment import (
    EquipmentItem,
    EquipmentReservation,
    EquipmentReservationStatus,
    EquipmentStatus,
)
from app.models.user import User
from app.schemas.equipment import EquipmentReservationCreate, EquipmentItemCreate, EquipmentItemUpdate
from app.services.idempotency import lock_idempotency_key

IDEMPOTENCY_RETENTION = timedelta(hours=24)
DEFAULT_EQUIPMENT = [
    {
        "slug": "projector",
        "name": "Projector",
        "description": "HD projector with HDMI connection and basic presentation remote.",
        "total_quantity": 4,
    },
    {
        "slug": "sound-system",
        "name": "Sound System",
        "description": "Portable speakers with mixer and event microphone inputs.",
        "total_quantity": 2,
    },
    {
        "slug": "laptop",
        "name": "Laptop",
        "description": "Campus laptop for event presentations and registration desks.",
        "total_quantity": 12,
    },
    {
        "slug": "chairs-tables",
        "name": "Chairs & Tables",
        "description": "Flexible seating and tables for campus workshops and gatherings.",
        "total_quantity": 8,
    },
    {
        "slug": "microphone",
        "name": "Microphone",
        "description": "Wireless microphone kit for speakers and audience Q&A.",
        "total_quantity": 6,
    },
    {
        "slug": "whiteboard",
        "name": "Whiteboard",
        "description": "Mobile whiteboard with markers for collaborative sessions.",
        "total_quantity": 3,
    },
]


class EquipmentError(ValueError):
    pass


class EquipmentConflictError(EquipmentError):
    def __init__(self, message: str, available_quantity: int) -> None:
        super().__init__(message)
        self.available_quantity = available_quantity


class EquipmentIdempotencyConflictError(EquipmentError):
    pass


async def list_equipment(session: AsyncSession) -> list[EquipmentItem]:
    await _ensure_default_equipment(session)
    result = await session.execute(
        select(EquipmentItem)
        .where(EquipmentItem.status == EquipmentStatus.ACTIVE)
        .order_by(EquipmentItem.name)
    )
    return list(result.scalars().all())


async def list_equipment_availability(
    session: AsyncSession, *, starts_at: datetime, ends_at: datetime
) -> list[dict[str, object]]:
    items = await list_equipment(session)
    if not items:
        return []
    reserved = await _reserved_quantities(session, [item.id for item in items], starts_at, ends_at)
    return [
        {
            "id": item.id,
            "slug": item.slug,
            "name": item.name,
            "description": item.description,
            "total_quantity": item.total_quantity,
            "status": item.status,
            "reserved_quantity": reserved.get(item.id, 0),
            "available_quantity": max(item.total_quantity - reserved.get(item.id, 0), 0),
        }
        for item in items
    ]


async def create_equipment_reservation(
    session: AsyncSession,
    *,
    requester: User,
    data: EquipmentReservationCreate,
    idempotency_key: str,
) -> EquipmentReservation:
    if not idempotency_key or len(idempotency_key) > 160:
        raise EquipmentError("Idempotency-Key must contain between 1 and 160 characters")
    request_hash = _request_hash(data)
    await session.rollback()
    async with session.begin():
        await session.refresh(requester)
        await lock_idempotency_key(session, requester.id, "create_equipment_reservation", idempotency_key)
        record = await session.scalar(
            select(IdempotencyKey)
            .where(
                IdempotencyKey.user_id == requester.id,
                IdempotencyKey.operation == "create_equipment_reservation",
                IdempotencyKey.key == idempotency_key,
            )
            .with_for_update()
        )
        if record is not None:
            if record.request_hash != request_hash:
                raise EquipmentIdempotencyConflictError(
                    "The idempotency key was already used with a different request"
                )
            reservation_id = _reservation_id_from_response(record.response_body)
            if reservation_id is None:
                raise EquipmentIdempotencyConflictError("The idempotency key has no replayable result")
            reservation = await session.scalar(
                select(EquipmentReservation)
                .options(selectinload(EquipmentReservation.equipment_item))
                .where(EquipmentReservation.id == reservation_id)
            )
            if reservation is None:
                raise EquipmentIdempotencyConflictError("The original reservation no longer exists")
            return reservation

        item = await session.scalar(
            select(EquipmentItem)
            .where(EquipmentItem.id == data.equipment_item_id, EquipmentItem.status == EquipmentStatus.ACTIVE)
            .with_for_update()
        )
        if item is None:
            raise EquipmentError("Equipment item not found")
        if data.quantity > item.total_quantity:
            raise EquipmentConflictError(
                f"Requested quantity exceeds total inventory ({item.total_quantity})",
                available_quantity=item.total_quantity,
            )

        reserved = await session.scalar(
            select(func.coalesce(func.sum(EquipmentReservation.quantity), 0))
            .where(
                EquipmentReservation.equipment_item_id == item.id,
                EquipmentReservation.active.is_(True),
                EquipmentReservation.reserved_range.op("&&")(func.tstzrange(data.starts_at, data.ends_at, "[)")),
            )
        )
        reserved_quantity = int(reserved or 0)
        available_quantity = item.total_quantity - reserved_quantity
        if data.quantity > available_quantity:
            raise EquipmentConflictError(
                f"Only {available_quantity} item(s) available for the selected time",
                available_quantity=max(available_quantity, 0),
            )

        reservation = EquipmentReservation(
            equipment_item_id=item.id,
            equipment_item=item,
            requester_id=requester.id,
            quantity=data.quantity,
            purpose=data.purpose,
            starts_at=data.starts_at,
            ends_at=data.ends_at,
            reserved_range=func.tstzrange(data.starts_at, data.ends_at, "[)"),
            status=EquipmentReservationStatus.CONFIRMED,
            active=True,
        )
        session.add(reservation)
        await session.flush()
        session.add(
            IdempotencyKey(
                user_id=requester.id,
                operation="create_equipment_reservation",
                key=idempotency_key,
                request_hash=request_hash,
                response_code=201,
                response_body={"reservation_id": str(reservation.id)},
                expires_at=datetime.now(UTC) + IDEMPOTENCY_RETENTION,
            )
        )
        await session.flush()
        return reservation


async def list_my_equipment_reservations(session: AsyncSession, *, requester_id: UUID) -> list[EquipmentReservation]:
    result = await session.execute(
        select(EquipmentReservation)
        .options(selectinload(EquipmentReservation.equipment_item))
        .where(EquipmentReservation.requester_id == requester_id)
        .order_by(EquipmentReservation.starts_at.desc())
    )
    return list(result.scalars().all())


async def _reserved_quantities(
    session: AsyncSession, item_ids: list[UUID], starts_at: datetime, ends_at: datetime
) -> dict[UUID, int]:
    rows = await session.execute(
        select(EquipmentReservation.equipment_item_id, func.coalesce(func.sum(EquipmentReservation.quantity), 0))
        .where(
            EquipmentReservation.equipment_item_id.in_(item_ids),
            EquipmentReservation.active.is_(True),
            EquipmentReservation.reserved_range.op("&&")(func.tstzrange(starts_at, ends_at, "[)")),
        )
        .group_by(EquipmentReservation.equipment_item_id)
    )
    return {item_id: int(total) for item_id, total in rows.all()}


async def _ensure_default_equipment(session: AsyncSession) -> None:
    count = await session.scalar(select(func.count()).select_from(EquipmentItem))
    if count:
        return
    for row in DEFAULT_EQUIPMENT:
        session.add(EquipmentItem(**row, status=EquipmentStatus.ACTIVE))
    await session.commit()


def _request_hash(data: EquipmentReservationCreate) -> str:
    serialized = json.dumps(data.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _reservation_id_from_response(response_body: dict[str, object] | None) -> UUID | None:
    if response_body is None:
        return None
    value = response_body.get("reservation_id")
    if not isinstance(value, str):
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


async def create_equipment_item(session: AsyncSession, *, data: EquipmentItemCreate) -> EquipmentItem:
    item = EquipmentItem(slug=data.slug, name=data.name, description=data.description, total_quantity=data.total_quantity, status=data.status)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item

async def update_equipment_item(session: AsyncSession, *, item_id: UUID, data: EquipmentItemUpdate) -> EquipmentItem:
    item = await session.scalar(select(EquipmentItem).where(EquipmentItem.id == item_id))
    if item is None:
        raise EquipmentError("Equipment item not found")
    if data.name is not None: item.name = data.name
    if data.description is not None: item.description = data.description
    if data.total_quantity is not None: item.total_quantity = data.total_quantity
    if data.status is not None: item.status = data.status
    await session.commit()
    await session.refresh(item)
    return item

async def list_all_equipment_reservations(session: AsyncSession, *, limit: int = 200, offset: int = 0) -> list[EquipmentReservation]:
    result = await session.execute(select(EquipmentReservation).options(selectinload(EquipmentReservation.equipment_item)).order_by(EquipmentReservation.created_at.desc()).limit(limit).offset(offset))
    return list(result.scalars().all())
