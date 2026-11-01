from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.notification import DeliveryStatus

NotificationRecipientGroup = Literal[
    "ALL_ACTIVE",
    "ORGANIZERS",
    "VENUE_ADMINS",
    "SYSTEM_ADMINS",
]


class AdminAnnouncementCreate(BaseModel):
    recipient_group: NotificationRecipientGroup
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=4000)


class AdminAnnouncementResponse(BaseModel):
    recipient_group: NotificationRecipientGroup
    recipient_count: int
    title: str
    delivery_status: DeliveryStatus
    created_at: datetime


class VenueBookingUsage(BaseModel):
    venue_id: UUID
    venue_name: str
    booking_count: int
    expected_attendance: int


class BookingAnalyticsResponse(BaseModel):
    total_bookings: int
    confirmed_bookings: int
    cancelled_bookings: int
    completed_bookings: int
    total_expected_attendance: int
    venue_usage: list[VenueBookingUsage]
