from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.organization import OrganizationStatus, OrganizationType
from app.models.organization_membership import MembershipRole, MembershipStatus


class OrganizationCreate(BaseModel):
    name: str
    slug: str
    organization_type: OrganizationType


class OrganizationUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    organization_type: OrganizationType | None = None
    status: OrganizationStatus | None = None


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    organization_type: OrganizationType
    status: OrganizationStatus


class MembershipCreate(BaseModel):
    user_id: UUID
    membership_role: MembershipRole


class MembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    organization_id: UUID
    membership_role: MembershipRole
    status: MembershipStatus
