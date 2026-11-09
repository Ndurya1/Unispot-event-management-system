from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CertificateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    verification_code: str
    user_id: UUID
    registration_id: UUID
    event_id: UUID
    recipient_name: str
    event_title: str
    template_name: str
    issued_at: datetime
    issued_by_user_id: UUID | None = None
    revoked_at: datetime | None = None
    revoke_reason: str | None = None
    is_valid: bool = True


class CertificateIssueRequest(BaseModel):
    registration_id: UUID
    template_name: str = Field(default="Campus Classic", min_length=1, max_length=80)


class CertificateVerifyResponse(BaseModel):
    valid: bool
    verification_code: str
    recipient_name: str | None = None
    event_title: str | None = None
    template_name: str | None = None
    issued_at: datetime | None = None
    revoked_at: datetime | None = None
    message: str
