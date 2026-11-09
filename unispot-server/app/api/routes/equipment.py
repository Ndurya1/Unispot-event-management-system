from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user, require_system_admin
from app.api.dependencies.database import get_db
from app.models.equipment import EquipmentReservation
from app.models.user import User
from app.schemas.equipment import (
    EquipmentAvailabilityResponse,
    EquipmentItemCreate,
    EquipmentItemResponse,
    EquipmentItemUpdate,
    EquipmentReservationCreate,
    EquipmentReservationResponse,
)
from app.services.equipment_service import (
    EquipmentConflictError,
    EquipmentError,
    EquipmentIdempotencyConflictError,
    create_equipment_item,
    create_equipment_reservation,
    list_all_equipment_reservations,
    list_equipment_availability,
    list_equipment,
    list_my_equipment_reservations,
    update_equipment_item,
)

router = APIRouter(prefix="/equipment", tags=["equipment"])


def _reservation_response(reservation: EquipmentReservation) -> EquipmentReservationResponse:
    return EquipmentReservationResponse(
        id=reservation.id,
        equipment_item_id=reservation.equipment_item_id,
        equipment_name=reservation.equipment_item.name,
        requester_id=reservation.requester_id,
        organization_id=reservation.organization_id,
        quantity=reservation.quantity,
        purpose=reservation.purpose,
        starts_at=reservation.starts_at,
        ends_at=reservation.ends_at,
        status=reservation.status,
        confirmation_code=reservation.confirmation_code,
        created_at=reservation.created_at,
        cancelled_at=reservation.cancelled_at,
        cancellation_reason=reservation.cancellation_reason,
    )


@router.get("/items", response_model=list[EquipmentItemResponse])
async def items(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)]) -> list[object]:
    return await list_equipment(session)


@router.post("/items", response_model=EquipmentItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(data: EquipmentItemCreate, session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)]) -> object:
    try:
        return await create_equipment_item(session, data=data)
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.patch("/items/{item_id}", response_model=EquipmentItemResponse)
async def patch_item(item_id: UUID, data: EquipmentItemUpdate, session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)]) -> object:
    try:
        return await update_equipment_item(session, item_id=item_id, data=data)
    except EquipmentError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/reservations", response_model=list[EquipmentReservationResponse])
async def all_reservations(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)], limit: int = 200, offset: int = 0) -> list[EquipmentReservationResponse]:
    return [_reservation_response(item) for item in await list_all_equipment_reservations(session, limit=min(limit, 500), offset=max(offset, 0))]


@router.get("/availability", response_model=list[EquipmentAvailabilityResponse])
async def availability(
    session: Annotated[AsyncSession, Depends(get_db)],
    starts_at: str = Query(...),
    ends_at: str = Query(...),
) -> list[dict[str, object]]:
    from datetime import datetime

    try:
        start = datetime.fromisoformat(starts_at.replace("Z", "+00:00"))
        end = datetime.fromisoformat(ends_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Invalid datetime format") from error
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise HTTPException(status_code=400, detail="Provide a valid timezone-aware time range")
    return await list_equipment_availability(session, starts_at=start, ends_at=end)


@router.post("/reservations", response_model=EquipmentReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    data: EquipmentReservationCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> EquipmentReservationResponse:
    if idempotency_key is None:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        reservation = await create_equipment_reservation(
            session, requester=current_user, data=data, idempotency_key=idempotency_key
        )
        return _reservation_response(reservation)
    except EquipmentConflictError as error:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "equipment_unavailable",
                "message": str(error),
                "details": [{"code": "available_quantity", "value": error.available_quantity}],
            },
        ) from error
    except EquipmentIdempotencyConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except EquipmentError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/reservations/me", response_model=list[EquipmentReservationResponse])
async def my_reservations(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[EquipmentReservationResponse]:
    reservations = await list_my_equipment_reservations(session, requester_id=current_user.id)
    return [_reservation_response(item) for item in reservations]
