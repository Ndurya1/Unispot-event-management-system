from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.scheduling import RecurringStatus, WaitlistStatus


class WaitlistCreate(BaseModel):
    venue_id: UUID
    requested_date: date
    requested_start: str = Field(pattern=r"^\d{2}:\d{2}$")
    requested_end: str = Field(pattern=r"^\d{2}:\d{2}$")
    event_name: str = Field(min_length=1, max_length=200)


class WaitlistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    venue_id: UUID
    venue_name: str
    requested_date: date
    requested_start: str
    requested_end: str
    event_name: str
    status: WaitlistStatus
    confirmation_code: str
    created_at: datetime
    cancelled_at: datetime | None


class RecurringCreate(BaseModel):
    venue_id: UUID
    event_name: str = Field(min_length=1, max_length=200)
    day_of_week: int = Field(ge=0, le=6)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")


class RecurringUpdate(BaseModel):
    status: RecurringStatus


class RecurringResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    venue_id: UUID
    venue_name: str
    event_name: str
    day_of_week: int
    start_time: str
    end_time: str
    status: RecurringStatus
    confirmation_code: str
    created_at: datetime
    updated_at: datetime
