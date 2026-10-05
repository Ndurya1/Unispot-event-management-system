import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, func, text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import TSTZRANGE, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.venue import Venue
    from app.models.venue_block import VenueBlock


class ReservationType(StrEnum):
    BOOKING = "BOOKING"
    BLOCK = "BLOCK"


class VenueReservation(Base):
    __tablename__ = "venue_reservations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    venue_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("venues.id", ondelete="RESTRICT"), nullable=False
    )
    reservation_type: Mapped[ReservationType] = mapped_column(
        SQLEnum(ReservationType, name="reservation_type"), nullable=False
    )
    occupied_range: Mapped[object] = mapped_column(TSTZRANGE, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    venue: Mapped["Venue"] = relationship("Venue", back_populates="reservations")
    block: Mapped["VenueBlock | None"] = relationship(
        "VenueBlock", back_populates="reservation", uselist=False
    )
