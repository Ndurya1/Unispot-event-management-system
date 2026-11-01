from uuid import UUID

from app.models.venue import VenueStatus
from app.schemas.venue import VenueMetadataResponse


class AvailabilityResponse(VenueMetadataResponse):
    id: UUID
    name: str
    code: str
    location: str
    capacity: int
    description: str | None
    status: VenueStatus
