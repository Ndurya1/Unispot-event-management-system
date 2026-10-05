from datetime import timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingSource
from app.models.user import User
from app.models.venue import Venue, VenueStatus
from app.schemas.assistant import (
    CancelMyBookingArguments,
    CheckAvailabilityArguments,
    CreateBookingArguments,
    ListMyBookingsArguments,
    SearchVenuesArguments,
    ToolName,
)
from app.schemas.booking import BookingCancelRequest, BookingCreate
from app.services.booking_lifecycle import cancel_booking, list_my_bookings
from app.services.booking_policy import (
    BOOKING_MAX_ADVANCE_WINDOW,
    BOOKING_MAX_DURATION,
    BOOKING_MIN_LEAD_TIME,
    BookingPolicyError,
)
from app.services.booking_service import (
    BookingConflictError,
    IdempotencyConflictError,
    create_booking,
)
from app.services.venue_service import find_available_venues, list_venues


class AssistantConfirmationRequired(ValueError):
    """A write tool was requested without an explicit confirmation."""


class UnknownAssistantTool(ValueError):
    """A model attempted to invoke a tool outside the fixed allow-list."""


class AssistantToolExecutor:
    """Typed, allow-listed adapter from assistant tool calls to domain services."""

    def __init__(self, session: AsyncSession, requester: User) -> None:
        self.session = session
        self.requester = requester

    async def execute(
        self,
        name: ToolName,
        arguments: dict[str, object],
        *,
        confirmed: bool = False,
        idempotency_key: str | None = None,
    ) -> tuple[dict[str, object], UUID | None]:
        if name is ToolName.SEARCH_VENUES:
            return await self.search_venues(arguments), None
        if name is ToolName.CHECK_AVAILABILITY:
            return await self.check_availability(arguments), None
        if name is ToolName.GET_BOOKING_POLICY:
            return self.get_booking_policy(arguments), None
        if name is ToolName.LIST_MY_BOOKINGS:
            return await self.list_bookings(arguments), None
        if name is ToolName.CREATE_BOOKING:
            return await self.create_booking(
                arguments, confirmed=confirmed, idempotency_key=idempotency_key
            )
        if name is ToolName.CANCEL_MY_BOOKING:
            return await self.cancel_booking(
                arguments, confirmed=confirmed, idempotency_key=idempotency_key
            )
        raise UnknownAssistantTool(f"Unsupported assistant tool: {name}")

    async def search_venues(self, arguments: dict[str, object]) -> dict[str, object]:
        data = SearchVenuesArguments.model_validate(arguments)
        venues = await list_venues(
            self.session,
            capacity=data.capacity,
            location=data.location,
            facility_id=data.facility_id,
            status=VenueStatus.ACTIVE,
        )
        return {"venues": [_venue_summary(venue) for venue in venues]}

    async def check_availability(self, arguments: dict[str, object]) -> dict[str, object]:
        data = CheckAvailabilityArguments.model_validate(arguments)
        if data.ends_at - data.starts_at > timedelta(days=31):
            raise ValueError("availability window cannot exceed 31 days")
        venues = await find_available_venues(
            self.session,
            data.starts_at,
            data.ends_at,
            capacity=data.capacity,
            location=data.location,
            facility_id=data.facility_id,
        )
        return {
            "starts_at": data.starts_at.isoformat(),
            "ends_at": data.ends_at.isoformat(),
            "available_venues": [_venue_summary(venue) for venue in venues],
        }

    def get_booking_policy(self, arguments: dict[str, object]) -> dict[str, object]:
        # This tool deliberately accepts no arguments. Pydantic's extra=forbid
        # prevents the model from smuggling query text or role assertions.
        if arguments:
            raise ValueError("get_booking_policy does not accept arguments")
        return {
            "minimum_lead_time_hours": int(BOOKING_MIN_LEAD_TIME.total_seconds() // 3600),
            "maximum_duration_hours": int(BOOKING_MAX_DURATION.total_seconds() // 3600),
            "maximum_advance_days": BOOKING_MAX_ADVANCE_WINDOW.days,
            "cancellation_notice_hours": 24,
            "timezone": "Africa/Nairobi",
        }

    async def list_bookings(self, arguments: dict[str, object]) -> dict[str, object]:
        data = ListMyBookingsArguments.model_validate(arguments)
        bookings = await list_my_bookings(
            self.session,
            requester_id=self.requester.id,
            status=data.status,
            starts_from=data.starts_from,
            starts_to=data.starts_to,
            limit=data.limit,
            offset=data.offset,
        )
        return {"bookings": [_booking_summary(booking) for booking in bookings]}

    async def create_booking(
        self,
        arguments: dict[str, object],
        *,
        confirmed: bool,
        idempotency_key: str | None,
    ) -> tuple[dict[str, object], UUID | None]:
        if not confirmed:
            raise AssistantConfirmationRequired(
                "Explicit confirmation is required to create a booking"
            )
        if not idempotency_key:
            raise ValueError("An idempotency key is required for assistant booking writes")
        data = CreateBookingArguments.model_validate(arguments)
        try:
            booking = await create_booking(
                self.session,
                requester=self.requester,
                data=BookingCreate.model_validate(data.model_dump()),
                idempotency_key=idempotency_key,
                source=BookingSource.ASSISTANT,
            )
        except (BookingPolicyError, BookingConflictError, IdempotencyConflictError, ValueError):
            raise
        return {"booking": _booking_summary(booking)}, booking.id

    async def cancel_booking(
        self,
        arguments: dict[str, object],
        *,
        confirmed: bool,
        idempotency_key: str | None,
    ) -> tuple[dict[str, object], UUID | None]:
        if not confirmed:
            raise AssistantConfirmationRequired(
                "Explicit confirmation is required to cancel a booking"
            )
        if not idempotency_key:
            raise ValueError("An idempotency key is required for assistant booking writes")
        data = CancelMyBookingArguments.model_validate(arguments)
        booking = await cancel_booking(
            self.session,
            booking_id=data.booking_id,
            requester=self.requester,
            data=BookingCancelRequest(reason=data.reason),
            idempotency_key=idempotency_key,
            source=BookingSource.ASSISTANT,
        )
        return {"booking": _booking_summary(booking)}, booking.id


def _venue_summary(venue: Venue) -> dict[str, object]:
    return {
        "id": str(venue.id),
        "name": venue.name,
        "code": venue.code,
        "location": venue.location,
        "capacity": venue.capacity,
        "description": venue.description,
        "timezone": venue.timezone,
    }


def _booking_summary(booking: Booking) -> dict[str, object]:
    return {
        "id": str(booking.id),
        "venue_id": str(booking.venue_id),
        "organization_id": str(booking.organization_id),
        "event_name": booking.event_name,
        "expected_attendance": booking.expected_attendance,
        "starts_at": booking.starts_at.isoformat(),
        "ends_at": booking.ends_at.isoformat(),
        "status": booking.status.value,
        "confirmation_code": booking.confirmation_code,
        "cancelled_at": booking.cancelled_at.isoformat() if booking.cancelled_at else None,
    }


__all__ = [
    "AssistantConfirmationRequired",
    "AssistantToolExecutor",
    "UnknownAssistantTool",
]
