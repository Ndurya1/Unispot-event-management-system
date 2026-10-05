from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_venue_admin
from app.api.dependencies.database import get_db
from app.models.user import User
from app.schemas.booking import AllocationResponse
from app.services.booking_lifecycle import list_allocations

router = APIRouter(prefix="/admin", tags=["admin allocations"])


@router.get("/allocations", response_model=list[AllocationResponse])
async def allocations(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_venue_admin)],
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
    venue_id: UUID | None = None,
    limit: int = Query(default=100, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
) -> list[AllocationResponse]:
    bookings = await list_allocations(
        session,
        starts_from=starts_from,
        starts_to=starts_to,
        venue_id=venue_id,
        limit=limit,
        offset=offset,
    )
    return [
        AllocationResponse(
            id=booking.id,
            venue_id=booking.venue_id,
            venue_name=booking.venue.name,
            starts_at=booking.starts_at,
            ends_at=booking.ends_at,
            expected_attendance=booking.expected_attendance,
            status=booking.status,
            confirmation_code=booking.confirmation_code,
        )
        for booking in bookings
    ]
