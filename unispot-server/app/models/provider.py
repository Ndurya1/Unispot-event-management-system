import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class ProviderStatus(StrEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class ServiceRequestStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ServiceProvider(Base):
    __tablename__ = "service_providers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str] = mapped_column(String(160), nullable=False, server_default="Main Campus")
    price_from_kes: Mapped[int] = mapped_column(Integer, nullable=False)
    rating: Mapped[str] = mapped_column(String(10), nullable=False, server_default="4.5")
    reviews: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    availability: Mapped[str] = mapped_column(String(40), nullable=False, server_default="week")
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[ProviderStatus] = mapped_column(SQLEnum(ProviderStatus, name="provider_status"), nullable=False, server_default="ACTIVE")
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    requests: Mapped[list["ServiceRequest"]] = relationship(
        "ServiceRequest",
        back_populates="provider",
        foreign_keys="ServiceRequest.provider_id",
    )
    owner: Mapped["User | None"] = relationship("User", foreign_keys=[owner_user_id])


class ServiceRequest(Base):
    __tablename__ = "service_requests"
    __table_args__ = (UniqueConstraint("id", "assigned_provider_id", name="uq_service_requests_id_assigned_provider_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    provider_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("service_providers.id", ondelete="RESTRICT"), nullable=False)
    requester_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    assigned_provider_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("service_providers.id", ondelete="SET NULL"), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_name: Mapped[str] = mapped_column(String(200), nullable=False)
    requested_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    quote_amount_kes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quote_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    quoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    quoted_by_provider_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("service_providers.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[ServiceRequestStatus] = mapped_column(SQLEnum(ServiceRequestStatus, name="service_request_status"), nullable=False, server_default="PENDING")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    confirmation_code: Mapped[str] = mapped_column(String(24), nullable=False, unique=True, server_default=text("upper(substr(md5(random()::text), 1, 12))"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    provider: Mapped[ServiceProvider] = relationship("ServiceProvider", foreign_keys=[provider_id], back_populates="requests")
    assigned_provider: Mapped[ServiceProvider | None] = relationship("ServiceProvider", foreign_keys=[assigned_provider_id])
    requester: Mapped["User"] = relationship("User", foreign_keys=[requester_id])
    assigned_by: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_by_user_id])
    quoted_by_provider: Mapped[ServiceProvider | None] = relationship("ServiceProvider", foreign_keys="[ServiceRequest.quoted_by_provider_id]")
