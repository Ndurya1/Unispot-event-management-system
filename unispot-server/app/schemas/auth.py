from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserStatus


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=1024)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrganizationMembershipSummary(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    membership_role: str


class CurrentUserResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    status: UserStatus
    roles: list[str]
    organizations: list[OrganizationMembershipSummary]
