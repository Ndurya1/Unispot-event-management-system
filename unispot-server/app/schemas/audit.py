from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_user_id: UUID | None
    actor_type: str
    action: str
    target_type: str
    target_id: UUID | None
    request_id: UUID
    channel: str
    outcome: str
    metadata: dict[str, object] = Field(validation_alias="event_metadata")
    created_at: datetime
