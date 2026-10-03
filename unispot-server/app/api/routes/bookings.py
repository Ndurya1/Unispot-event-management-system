from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.booking import Booking
from app.models.user import User
from app.models.venue import Venue
from app.schemas.booking import BookingCreate, BookingResponse

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post(
    "",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    booking_data: BookingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Booking:
    if booking_data.start_time >= booking_data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time",
        )

    venue_result = await session.execute(
        select(Venue).where(Venue.id == booking_data.venue_id)
    )
    venue = venue_result.scalar_one_or_none()

    if venue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found",
        )

    overlap_result = await session.execute(
        select(Booking).where(
            Booking.venue_id == booking_data.venue_id,
            Booking.start_time < booking_data.end_time,
            Booking.end_time > booking_data.start_time,
        )
    )

    if overlap_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Venue is already booked for this time",
        )

    booking = Booking(
        venue_id=booking_data.venue_id,
        user_id=current_user.id,
        start_time=booking_data.start_time,
        end_time=booking_data.end_time,
    )

    session.add(booking)
    await session.commit()
    await session.refresh(booking)

    return booking


@router.get(
    "",
    response_model=list[BookingResponse],
)
async def list_bookings(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[Booking]:
    result = await session.execute(
        select(Booking)
        .where(Booking.user_id == current_user.id)
        .order_by(Booking.start_time)
    )

    return list(result.scalars().all())


@router.get(
    "/{booking_id}",
    response_model=BookingResponse,
)
async def get_booking(
    booking_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Booking:
    result = await session.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.user_id == current_user.id,
        )
    )

    booking = result.scalar_one_or_none()

    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    return booking
