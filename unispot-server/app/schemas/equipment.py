from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.equipment import EquipmentReservationStatus, EquipmentStatus


class EquipmentItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    description: str | None
    total_quantity: int
    status: EquipmentStatus


class EquipmentItemCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    total_quantity: int = Field(ge=0, le=100000)
    status: EquipmentStatus = EquipmentStatus.ACTIVE


class EquipmentItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    total_quantity: int | None = Field(default=None, ge=0, le=100000)
    status: EquipmentStatus | None = None
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def validate_interval(self) -> "EquipmentAvailabilityRequest":
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("reservation times must include a timezone")
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be later than starts_at")
        return self


class EquipmentAvailabilityResponse(EquipmentItemResponse):
    reserved_quantity: int
    available_quantity: int


class EquipmentReservationCreate(BaseModel):
    equipment_item_id: UUID
    quantity: int = Field(gt=0)
    starts_at: datetime
    ends_at: datetime
    purpose: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_interval(self) -> "EquipmentReservationCreate":
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("reservation times must include a timezone")
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be later than starts_at")
        return self


class EquipmentReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    equipment_item_id: UUID
    equipment_name: str
    requester_id: UUID
    organization_id: UUID | None
    quantity: int
    purpose: str | None
    starts_at: datetime
    ends_at: datetime
    status: EquipmentReservationStatus
    confirmation_code: str
    created_at: datetime
    cancelled_at: datetime | None
    cancellation_reason: str | None
