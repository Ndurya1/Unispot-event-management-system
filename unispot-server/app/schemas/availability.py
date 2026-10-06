from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.venue import VenueStatus


class AvailabilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    code: str
    location: str
    capacity: int
    description: str | None
    status: VenueStatus
