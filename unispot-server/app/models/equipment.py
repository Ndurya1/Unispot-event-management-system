import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import TSTZRANGE, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class EquipmentStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class EquipmentReservationStatus(StrEnum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class EquipmentItem(Base):
    __tablename__ = "equipment_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[EquipmentStatus] = mapped_column(
        SQLEnum(EquipmentStatus, name="equipment_status"),
        nullable=False,
        server_default="ACTIVE",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    reservations: Mapped[list["EquipmentReservation"]] = relationship(
        "EquipmentReservation", back_populates="equipment_item"
    )


class EquipmentReservation(Base):
    __tablename__ = "equipment_reservations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    equipment_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("equipment_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    purpose: Mapped[str | None] = mapped_column(String(255), nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reserved_range: Mapped[object] = mapped_column(TSTZRANGE, nullable=False)
    status: Mapped[EquipmentReservationStatus] = mapped_column(
        SQLEnum(EquipmentReservationStatus, name="equipment_reservation_status"),
        nullable=False,
        server_default="CONFIRMED",
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    confirmation_code: Mapped[str] = mapped_column(
        String(24), nullable=False, unique=True, server_default=text("upper(substr(md5(random()::text), 1, 12))")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    equipment_item: Mapped[EquipmentItem] = relationship(
        "EquipmentItem", back_populates="reservations"
    )
    requester: Mapped["User"] = relationship("User")
    organization: Mapped["Organization | None"] = relationship("Organization")
