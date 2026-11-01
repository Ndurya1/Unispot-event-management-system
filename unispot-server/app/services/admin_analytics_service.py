from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.venue import Venue
from app.schemas.admin import BookingAnalyticsResponse, VenueBookingUsage


async def get_booking_analytics(
    session: AsyncSession,
    *,
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
) -> BookingAnalyticsResponse:
    conditions = []
    if starts_from is not None:
        conditions.append(Booking.starts_at >= starts_from)
    if starts_to is not None:
        conditions.append(Booking.starts_at < starts_to)

    totals = await session.execute(
        select(
            func.count(Booking.id),
            func.count(Booking.id).filter(Booking.status == BookingStatus.CONFIRMED),
            func.count(Booking.id).filter(Booking.status == BookingStatus.CANCELLED),
            func.count(Booking.id).filter(Booking.status == BookingStatus.COMPLETED),
            func.coalesce(func.sum(Booking.expected_attendance), 0),
        ).where(*conditions)
    )
    total, confirmed, cancelled, completed, attendance = totals.one()

    usage_result = await session.execute(
        select(
            Venue.id,
            Venue.name,
            func.count(Booking.id),
            func.coalesce(func.sum(Booking.expected_attendance), 0),
        )
        .join(Booking, Booking.venue_id == Venue.id)
        .where(*conditions)
        .group_by(Venue.id, Venue.name)
        .order_by(func.count(Booking.id).desc(), Venue.name)
        .limit(10)
    )
    usage = [
        VenueBookingUsage(
            venue_id=venue_id,
            venue_name=venue_name,
            booking_count=booking_count,
            expected_attendance=expected_attendance,
        )
        for venue_id, venue_name, booking_count, expected_attendance in usage_result.all()
    ]
    return BookingAnalyticsResponse(
        total_bookings=total,
        confirmed_bookings=confirmed,
        cancelled_bookings=cancelled,
        completed_bookings=completed,
        total_expected_attendance=attendance,
        venue_usage=usage,
    )
