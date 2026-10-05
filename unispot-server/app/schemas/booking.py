from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.booking import BookingSource, BookingStatus


class BookingCreate(BaseModel):
    venue_id: UUID
    organization_id: UUID
    event_name: str = Field(min_length=1, max_length=200)
    event_description: str | None = None
    expected_attendance: int = Field(gt=0)
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def validate_interval(self) -> "BookingCreate":
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("booking times must include a timezone")
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be later than starts_at")
        return self


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    venue_id: UUID
    requester_id: UUID
    organization_id: UUID
    event_name: str
    event_description: str | None
    expected_attendance: int
    starts_at: datetime
    ends_at: datetime
    status: BookingStatus
    source: BookingSource
    confirmation_code: str
    created_at: datetime
    updated_at: datetime
    cancelled_at: datetime | None
    cancellation_reason: str | None


class PolicyViolationResponse(BaseModel):
    code: str
    message: str
