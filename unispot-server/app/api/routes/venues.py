from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.models.venue import Venue
from app.schemas.venue import VenueCreate, VenueResponse


router = APIRouter(prefix="/venues", tags=["venues"])


@router.post(
    "",
    response_model=VenueResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_venue(
    venue_data: VenueCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Venue:
    venue = Venue(
        name=venue_data.name,
        description=venue_data.description,
        location=venue_data.location,
        capacity=venue_data.capacity,
        owner_id=current_user.id,
    )

    session.add(venue)
    await session.commit()
    await session.refresh(venue)

    return venue


@router.get(
    "",
    response_model=list[VenueResponse],
)
async def list_venues(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[Venue]:
    result = await session.execute(
        select(Venue).order_by(Venue.created_at.desc())
    )

    return list(result.scalars().all())


@router.get(
    "/{venue_id}",
    response_model=VenueResponse,
)
async def get_venue(
    venue_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Venue:
    result = await session.execute(
        select(Venue).where(Venue.id == venue_id)
    )

    venue = result.scalar_one_or_none()

    if venue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found",
        )

    return venue
