from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_venue_admin
from app.api.dependencies.database import get_db
from app.models.user import User
from app.models.venue import Venue, VenueStatus
from app.models.venue_block import VenueBlock
from app.models.venue_operating_hours import VenueOperatingHours
from app.schemas.venue import (
    OperatingHoursCreate,
    OperatingHoursResponse,
    VenueBlockCreate,
    VenueBlockResponse,
    VenueCreate,
    VenueFacilityCreate,
    VenueFacilityResponse,
    VenueResponse,
    VenueUpdate,
)
from app.services.venue_service import (
    add_operating_hours,
    cancel_block,
    create_block,
    create_venue,
    get_venue,
    link_facility,
    list_operating_hours,
    list_venues,
    update_venue,
)

router = APIRouter(prefix="/venues", tags=["venues"])


@router.post("", response_model=VenueResponse, status_code=status.HTTP_201_CREATED)
async def create(
    data: VenueCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_venue_admin)],
) -> Venue:
    try:
        return await create_venue(session, **data.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.get("", response_model=list[VenueResponse])
async def list_all(
    session: Annotated[AsyncSession, Depends(get_db)],
    capacity: int | None = Query(default=None, gt=0),
    location: str | None = None,
    facility_id: UUID | None = None,
    status: VenueStatus | None = None,
) -> list[Venue]:
    return await list_venues(
        session,
        capacity=capacity,
        location=location,
        facility_id=facility_id,
        status=status,
    )


@router.get("/{venue_id}", response_model=VenueResponse)
async def get_one(venue_id: UUID, session: Annotated[AsyncSession, Depends(get_db)]) -> Venue:
    venue = await get_venue(session, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


@router.patch("/{venue_id}", response_model=VenueResponse)
async def update(
    venue_id: UUID,
    data: VenueUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_venue_admin)],
) -> Venue:
    venue = await get_venue(session, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    try:
        return await update_venue(session, venue, **data.model_dump(exclude_unset=True))
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post(
    "/{venue_id}/facilities",
    response_model=VenueFacilityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_facility(
    venue_id: UUID,
    data: VenueFacilityCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_venue_admin)],
) -> object:
    try:
        return await link_facility(session, venue_id, data.facility_id, data.notes)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post(
    "/{venue_id}/operating-hours",
    response_model=OperatingHoursResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_hours(
    venue_id: UUID,
    data: OperatingHoursCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_venue_admin)],
) -> VenueOperatingHours:
    try:
        return await add_operating_hours(
            session, venue_id, data.day_of_week, data.opens_at, data.closes_at
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/{venue_id}/operating-hours", response_model=list[OperatingHoursResponse])
async def list_hours(
    venue_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[VenueOperatingHours]:
    try:
        return await list_operating_hours(session, venue_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{venue_id}/blocks",
    response_model=VenueBlockResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_block(
    venue_id: UUID,
    data: VenueBlockCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_venue_admin)],
) -> VenueBlock:
    try:
        return await create_block(
            session,
            venue_id,
            data.starts_at,
            data.ends_at,
            data.reason,
            current_user.id,
        )
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/blocks/{block_id}/cancel", response_model=VenueBlockResponse)
async def cancel(
    block_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_venue_admin)],
) -> VenueBlock:
    try:
        return await cancel_block(session, block_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
