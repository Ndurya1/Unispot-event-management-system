from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserStatus


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=1024)
    role: str | None = Field(default=None, max_length=40)
    registration_code: str | None = Field(default=None, max_length=64)


class RegisterResponse(BaseModel):
    message: str
    email: EmailStr
    requires_email_verification: bool = True


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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    new_password: str = Field(min_length=8, max_length=1024)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str


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
    email_verified_at: datetime | None = None
    roles: list[str]
    organizations: list[OrganizationMembershipSummary]
