from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BookingCreate(BaseModel):
    venue_id: UUID
    start_time: datetime
    end_time: datetime


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    venue_id: UUID
    user_id: UUID
    start_time: datetime
    end_time: datetime
