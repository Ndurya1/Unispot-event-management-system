from datetime import datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.models.venue import Venue
from app.schemas.availability import AvailabilityResponse
from app.services.venue_service import find_available_venues

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", response_model=list[AvailabilityResponse])
async def search(
    starts_at: datetime,
    ends_at: datetime,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    capacity: int | None = Query(default=None, gt=0),
    location: str | None = None,
    facility_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=10000),
) -> list[Venue]:
    if starts_at.tzinfo is None or ends_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="date-times must include a timezone")
    if ends_at <= starts_at:
        raise HTTPException(status_code=422, detail="ends_at must be later than starts_at")
    if ends_at - starts_at > timedelta(days=31):
        raise HTTPException(status_code=422, detail="availability window cannot exceed 31 days")
    return await find_available_venues(
        session,
        starts_at,
        ends_at,
        capacity=capacity,
        location=location,
        facility_id=facility_id,
        limit=limit,
        offset=offset,
    )
