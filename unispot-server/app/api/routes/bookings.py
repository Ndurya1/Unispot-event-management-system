from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.booking import Booking, BookingStatus
from app.models.user import User
from app.schemas.booking import BookingCancelRequest, BookingCreate, BookingResponse
from app.services.booking_lifecycle import (
    CancellationError,
    cancel_booking,
    get_owned_booking,
    list_my_bookings,
)
from app.services.booking_policy import BookingPolicyError
from app.services.booking_service import (
    BookingConflictError,
    IdempotencyConflictError,
    create_booking,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/me", response_model=list[BookingResponse])
async def list_mine(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status: BookingStatus | None = None,
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[Booking]:
    return await list_my_bookings(
        session,
        requester_id=current_user.id,
        status=status,
        starts_from=starts_from,
        starts_to=starts_to,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create(
    data: BookingCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Booking:
    if idempotency_key is None:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        return await create_booking(
            session,
            requester=current_user,
            data=data,
            idempotency_key=idempotency_key,
        )
    except BookingPolicyError as error:
        raise HTTPException(
            status_code=422,
            detail=[{"code": item.code, "message": item.message} for item in error.violations],
        ) from error
    except BookingConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except IdempotencyConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_one(
    booking_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Booking:
    booking = await get_owned_booking(session, booking_id, current_user.id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel(
    booking_id: UUID,
    data: BookingCancelRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Booking:
    if idempotency_key is None:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        return await cancel_booking(
            session,
            booking_id=booking_id,
            requester=current_user,
            data=data,
            idempotency_key=idempotency_key,
        )
    except CancellationError as error:
        detail = str(error)
        code = 404 if detail == "Booking not found" else 409
        raise HTTPException(status_code=code, detail=detail) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
