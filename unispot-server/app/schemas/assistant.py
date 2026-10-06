from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.booking import BookingStatus


class ToolName(StrEnum):
    SEARCH_VENUES = "search_venues"
    CHECK_AVAILABILITY = "check_availability"
    GET_BOOKING_POLICY = "get_booking_policy"
    CREATE_BOOKING = "create_booking"
    LIST_MY_BOOKINGS = "list_my_bookings"
    CANCEL_MY_BOOKING = "cancel_my_booking"


class AssistantToolInvocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ToolName
    arguments: dict[str, object] = Field(default_factory=dict)


class SearchVenuesArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    capacity: int | None = Field(default=None, gt=0)
    location: str | None = Field(default=None, max_length=255)
    facility_id: UUID | None = None


class CheckAvailabilityArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: datetime
    ends_at: datetime
    capacity: int | None = Field(default=None, gt=0)
    location: str | None = Field(default=None, max_length=255)
    facility_id: UUID | None = None

    @model_validator(mode="after")
    def validate_interval(self) -> "CheckAvailabilityArguments":
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("date-times must include a timezone")
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be later than starts_at")
        if self.ends_at - self.starts_at > timedelta(days=31):
            raise ValueError("availability window cannot exceed 31 days")
        return self


class CreateBookingArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    venue_id: UUID
    organization_id: UUID
    event_name: str = Field(min_length=1, max_length=200)
    event_description: str | None = Field(default=None, max_length=4000)
    expected_attendance: int = Field(gt=0)
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def validate_interval(self) -> "CreateBookingArguments":
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("booking times must include a timezone")
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be later than starts_at")
        return self


class ListMyBookingsArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: BookingStatus | None = None
    starts_from: datetime | None = None
    starts_to: datetime | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=10000)

    @model_validator(mode="after")
    def validate_dates(self) -> "ListMyBookingsArguments":
        if any(v is not None and v.tzinfo is None for v in (self.starts_from, self.starts_to)):
            raise ValueError("Date filters must include a timezone")
        if self.starts_from is not None and self.starts_to is not None:
            interval = self.starts_to - self.starts_from
            if interval <= timedelta(0) or interval > timedelta(days=366):
                raise ValueError("Date filters must span at most 366 days")
        return self


class CancelMyBookingArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    booking_id: UUID
    reason: str | None = Field(default=None, max_length=255)


class AssistantMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conversation_id: UUID | None = None
    message: str = Field(min_length=1, max_length=4000)
    tool_calls: list[AssistantToolInvocation] = Field(default_factory=list, max_length=8)
    confirmed: bool = False
    confirmation_id: UUID | None = None


class AssistantToolResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ToolName
    status: str
    data: object | None = None
    error: str | None = None
    booking_id: UUID | None = None


class AssistantMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    conversation_id: UUID
    message_id: UUID
    response: str
    tool_results: list[AssistantToolResult] = Field(default_factory=list)
    pending_confirmation: bool = False
    state: dict[str, object] = Field(default_factory=dict)
