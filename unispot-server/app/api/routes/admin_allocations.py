from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_system_admin, require_venue_admin
from app.api.dependencies.database import get_db
from app.core.query_bounds import validate_date_filters
from app.models.booking import BookingStatus
from app.models.user import User
from app.schemas.booking import AllocationResponse, BookingCancelRequest, BookingResponse
from app.services.booking_lifecycle import CancellationError, admin_cancel_booking, list_all_bookings, list_allocations

router = APIRouter(prefix="/admin", tags=["admin allocations", "admin bookings"])


@router.get("/allocations", response_model=list[AllocationResponse])
async def allocations(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_venue_admin)],
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
    venue_id: UUID | None = None,
    limit: int = Query(default=100, ge=1, le=250),
    offset: int = Query(default=0, ge=0, le=10000),
) -> list[AllocationResponse]:
    validate_date_filters(starts_from, starts_to)
    bookings = await list_allocations(session, starts_from=starts_from, starts_to=starts_to, venue_id=venue_id, limit=limit, offset=offset)
    return [AllocationResponse(id=b.id, venue_id=b.venue_id, venue_name=b.venue.name, starts_at=b.starts_at, ends_at=b.ends_at, expected_attendance=b.expected_attendance, status=b.status, confirmation_code=b.confirmation_code) for b in bookings]


@router.get("/bookings", response_model=list[BookingResponse])
async def bookings(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_system_admin)],
    status: BookingStatus | None = None,
    venue_id: UUID | None = None,
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=250),
    offset: int = Query(default=0, ge=0, le=10000),
) -> list[BookingResponse]:
    validate_date_filters(starts_from, starts_to)
    return await list_all_bookings(session, status=status, venue_id=venue_id, starts_from=starts_from, starts_to=starts_to, limit=limit, offset=offset)


@router.post("/bookings/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking_admin(
    booking_id: UUID,
    data: BookingCancelRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> BookingResponse:
    try:
        return await admin_cancel_booking(session, booking_id=booking_id, admin=admin, reason=data.reason, idempotency_key=idempotency_key or f"admin-{booking_id}")
    except CancellationError as error:
        detail = str(error)
        code = 404 if detail == "Booking not found" else 409
        raise HTTPException(status_code=code, detail=detail) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
