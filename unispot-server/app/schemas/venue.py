from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VenueCreate(BaseModel):
    name: str
    description: str | None = None
    location: str
    capacity: int


class VenueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    location: str
    capacity: int
    owner_id: UUID
