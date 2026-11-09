from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.provider import ProviderStatus, ServiceRequestStatus


class ServiceProviderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    category: str
    description: str | None
    location: str
    price_from_kes: int
    rating: str
    reviews: int
    availability: str
    image_url: str | None
    status: ProviderStatus
    owner_user_id: UUID | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ServiceProviderCreate(BaseModel):
    slug: str | None = Field(default=None, min_length=2, max_length=120)
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    location: str = Field(default="Main Campus", min_length=1, max_length=160)
    price_from_kes: int = Field(default=0, ge=0)
    availability: str = Field(default="week", min_length=1, max_length=40)
    image_url: str | None = Field(default=None, max_length=255)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=40)
    owner_user_id: UUID | None = None
    status: ProviderStatus | None = None


class ServiceProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    location: str | None = Field(default=None, min_length=1, max_length=160)
    price_from_kes: int | None = Field(default=None, ge=0)
    availability: str | None = Field(default=None, min_length=1, max_length=40)
    image_url: str | None = Field(default=None, max_length=255)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=40)
    owner_user_id: UUID | None = None
    status: ProviderStatus | None = None


class ServiceRequestCreate(BaseModel):
    provider_id: UUID
    event_name: str = Field(min_length=1, max_length=200)
    requested_date: datetime
    notes: str | None = Field(default=None, max_length=4000)


class ServiceRequestAssign(BaseModel):
    assigned_provider_id: UUID | None = None


class ServiceRequestStatusUpdate(BaseModel):
    status: ServiceRequestStatus


class ServiceRequestQuote(BaseModel):
    quote_amount_kes: int | None = Field(default=None, ge=0)
    quote_notes: str | None = Field(default=None, max_length=4000)


class ServiceRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider_id: UUID
    provider_name: str
    requester_id: UUID
    assigned_provider_id: UUID | None = None
    assigned_at: datetime | None = None
    event_name: str
    requested_date: datetime
    notes: str | None
    quote_amount_kes: int | None = None
    quote_notes: str | None = None
    quoted_at: datetime | None = None
    status: ServiceRequestStatus
    confirmation_code: str
    created_at: datetime
    cancelled_at: datetime | None
