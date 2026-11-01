from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_system_admin
from app.api.dependencies.database import get_db
from app.core.query_bounds import validate_date_filters
from app.models.user import User
from app.schemas.admin import BookingAnalyticsResponse
from app.services.admin_analytics_service import get_booking_analytics

router = APIRouter(prefix="/admin/analytics", tags=["admin analytics"])


@router.get("/bookings", response_model=BookingAnalyticsResponse)
async def booking_analytics(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_system_admin)],
    starts_from: datetime | None = Query(default=None),  # noqa: B008
    starts_to: datetime | None = Query(default=None),  # noqa: B008
) -> BookingAnalyticsResponse:
    validate_date_filters(starts_from, starts_to)
    return await get_booking_analytics(
        session,
        starts_from=starts_from,
        starts_to=starts_to,
    )
