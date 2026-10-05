import uuid
from datetime import time
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.venue import Venue


class VenueOperatingHours(Base):
    __tablename__ = "venue_operating_hours"
    __table_args__ = (
        UniqueConstraint("venue_id", "day_of_week", name="venue_day_unique"),
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="day_of_week_valid"),
        CheckConstraint("closes_at > opens_at", name="hours_ordered"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    venue_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("venues.id", ondelete="RESTRICT"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    opens_at: Mapped[time] = mapped_column(Time, nullable=False)
    closes_at: Mapped[time] = mapped_column(Time, nullable=False)

    venue: Mapped["Venue"] = relationship("Venue", back_populates="operating_hours")
