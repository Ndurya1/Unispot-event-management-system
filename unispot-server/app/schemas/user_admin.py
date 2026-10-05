from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserStatus


class UserStatusUpdate(BaseModel):
    status: UserStatus


class RoleAssignment(BaseModel):
    role_name: str = Field(min_length=1, max_length=80, pattern=r"^[A-Z][A-Z0-9_]*$")


class UserAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    status: UserStatus
