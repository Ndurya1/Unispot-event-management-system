from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID as UUIDType

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Index, Text, func, text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.booking import BookingSource

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.user import User


class BookingEventType(StrEnum):
    CREATED = "CREATED"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class BookingEvent(Base):
    __tablename__ = "booking_events"
    __table_args__ = (Index("ix_booking_events_booking_created_at", "booking_id", "created_at"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    booking_id: Mapped[UUIDType] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="RESTRICT"), nullable=False
    )
    event_type: Mapped[BookingEventType] = mapped_column(
        SQLEnum(BookingEventType, name="booking_event_type"), nullable=False
    )
    actor_user_id: Mapped[UUIDType | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    source: Mapped[BookingSource] = mapped_column(
        SQLEnum(BookingSource, name="booking_source"), nullable=False
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_metadata: Mapped[dict[str, object]] = mapped_column(
        "metadata",
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    booking: Mapped["Booking"] = relationship("Booking", back_populates="events")
    actor: Mapped["User | None"] = relationship("User")
