from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.venue import VenueStatus


class VenueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    code: str | None = Field(default=None, min_length=1, max_length=40)
    location: str = Field(min_length=1, max_length=255)
    capacity: int = Field(gt=0)
    description: str | None = None
    status: VenueStatus = VenueStatus.ACTIVE
    timezone: str = "Africa/Nairobi"
    booking_buffer_minutes: int = Field(default=0, ge=0)


class VenueUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=180)
    code: str | None = Field(default=None, min_length=1, max_length=40)
    location: str | None = Field(default=None, min_length=1, max_length=255)
    capacity: int | None = Field(default=None, gt=0)
    description: str | None = None
    status: VenueStatus | None = None
    timezone: str | None = None
    booking_buffer_minutes: int | None = Field(default=None, ge=0)


class VenueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    location: str
    capacity: int
    description: str | None
    status: VenueStatus
    timezone: str
    booking_buffer_minutes: int


class FacilityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class FacilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class VenueFacilityCreate(BaseModel):
    facility_id: UUID
    notes: str | None = Field(default=None, max_length=255)


class VenueFacilityResponse(VenueFacilityCreate):
    model_config = ConfigDict(from_attributes=True)
    venue_id: UUID


class OperatingHoursCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    opens_at: time
    closes_at: time

    @model_validator(mode="after")
    def validate_order(self) -> "OperatingHoursCreate":
        if self.closes_at <= self.opens_at:
            raise ValueError("closes_at must be later than opens_at")
        return self


class OperatingHoursResponse(OperatingHoursCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class VenueBlockCreate(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: str = Field(min_length=1, max_length=255)

    @model_validator(mode="after")
    def validate_order(self) -> "VenueBlockCreate":
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("block times must include a timezone")
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be later than starts_at")
        return self


class VenueBlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    venue_id: UUID
    starts_at: datetime
    ends_at: datetime
    reason: str
    status: str
    created_by: UUID
    cancelled_at: datetime | None
