import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Integer, String, Text, func, text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.facility import VenueFacility
    from app.models.reservation import VenueReservation
    from app.models.venue_block import VenueBlock
    from app.models.venue_operating_hours import VenueOperatingHours


class VenueStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"


class Venue(Base):
    __tablename__ = "venues"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="capacity_positive"),
        CheckConstraint("booking_buffer_minutes >= 0", name="buffer_nonnegative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[VenueStatus] = mapped_column(
        SQLEnum(VenueStatus, name="venue_status"), nullable=False, server_default="ACTIVE"
    )
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default="Africa/Nairobi"
    )
    booking_buffer_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    facilities: Mapped[list["VenueFacility"]] = relationship(
        "VenueFacility", back_populates="venue", cascade="all, delete-orphan"
    )
    operating_hours: Mapped[list["VenueOperatingHours"]] = relationship(
        "VenueOperatingHours", back_populates="venue", cascade="all, delete-orphan"
    )
    reservations: Mapped[list["VenueReservation"]] = relationship(
        "VenueReservation", back_populates="venue"
    )
    blocks: Mapped[list["VenueBlock"]] = relationship("VenueBlock", back_populates="venue")
