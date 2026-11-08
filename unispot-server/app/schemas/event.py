from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.event import EventRegistrationStatus, EventStatus


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    title: str
    description: str | None
    category: str | None
    organizer: str | None
    location: str | None
    venue_id: UUID | None = None
    venue_name: str | None = None
    organization_id: UUID | None = None
    reservation_id: UUID | None = None
    expected_attendance: int | None = None
    starts_at: datetime
    ends_at: datetime
    capacity: int
    status: EventStatus
    confirmed_registrations: int
    remaining_capacity: int


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    category: str | None = Field(default=None, max_length=80)
    organizer: str | None = Field(default=None, max_length=160)
    location: str | None = Field(default=None, max_length=160)
    venue_id: UUID | None = None
    organization_id: UUID | None = None
    expected_attendance: int | None = Field(default=None, gt=0, le=100000)
    starts_at: datetime
    ends_at: datetime
    capacity: int = Field(gt=0, le=100000)
    status: EventStatus = EventStatus.PUBLISHED


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    category: str | None = Field(default=None, max_length=80)
    organizer: str | None = Field(default=None, max_length=160)
    location: str | None = Field(default=None, max_length=160)
    venue_id: UUID | None = None
    organization_id: UUID | None = None
    expected_attendance: int | None = Field(default=None, gt=0, le=100000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    capacity: int | None = Field(default=None, gt=0, le=100000)
    status: EventStatus | None = None


class EventRegistrationCreate(BaseModel):
    event_id: UUID
    full_name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=40)
    student_id: str | None = Field(default=None, max_length=80)


class EventRegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_id: UUID
    event_title: str
    user_id: UUID
    full_name: str
    email: str
    phone: str
    student_id: str | None
    status: EventRegistrationStatus
    confirmation_code: str
    checked_in_at: datetime | None
    created_at: datetime
    cancelled_at: datetime | None


class EventAttendanceResponse(BaseModel):
    event_id: UUID
    event_title: str
    total_registered: int
    checked_in: int
    not_checked_in: int
    attendance_rate: float
