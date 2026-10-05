import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.venue import Venue


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)

    venues: Mapped[list["VenueFacility"]] = relationship(
        "VenueFacility", back_populates="facility", cascade="all, delete-orphan"
    )


class VenueFacility(Base):
    __tablename__ = "venue_facilities"

    venue_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("venues.id", ondelete="RESTRICT"), primary_key=True
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("facilities.id", ondelete="RESTRICT"), primary_key=True
    )
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    venue: Mapped["Venue"] = relationship("Venue", back_populates="facilities")
    facility: Mapped[Facility] = relationship("Facility", back_populates="venues")
