import uuid
from datetime import date, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.venue import Venue


class WaitlistStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"


class RecurringStatus(StrEnum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"


class VenueWaitlist(Base):
    __tablename__ = "venue_waitlists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    venue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("venues.id", ondelete="RESTRICT"), nullable=False)
    requested_date: Mapped[date] = mapped_column(Date, nullable=False)
    requested_start: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    requested_end: Mapped[str] = mapped_column(String(5), nullable=False)
    event_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[WaitlistStatus] = mapped_column(SQLEnum(WaitlistStatus, name="waitlist_status"), nullable=False, server_default="ACTIVE")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    confirmation_code: Mapped[str] = mapped_column(String(24), nullable=False, unique=True, server_default=text("upper(substr(md5(random()::text), 1, 12))"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User")
    venue: Mapped["Venue"] = relationship("Venue")


class RecurringSchedule(Base):
    __tablename__ = "recurring_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    venue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("venues.id", ondelete="RESTRICT"), nullable=False)
    event_name: Mapped[str] = mapped_column(String(200), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon..6=Sun
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    status: Mapped[RecurringStatus] = mapped_column(SQLEnum(RecurringStatus, name="recurring_status"), nullable=False, server_default="ACTIVE")
    confirmation_code: Mapped[str] = mapped_column(String(24), nullable=False, unique=True, server_default=text("upper(substr(md5(random()::text), 1, 12))"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship("User")
    venue: Mapped["Venue"] = relationship("Venue")

