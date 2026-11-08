from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.organization import Organization, OrganizationStatus
from app.models.organization_membership import MembershipStatus, OrganizationMembership
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRoles
from app.schemas.auth import (
    CurrentUserResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services.auth_service import (
    delete_my_account,
    login_user,
    refresh_access_token,
    register_user,
    request_password_reset,
    resend_verification,
    reset_password,
    verify_email,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/me", response_model=CurrentUserResponse)
async def current_user(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CurrentUserResponse:
    role_result = await session.execute(
        select(Role.name)
        .join(UserRoles, UserRoles.role_id == Role.id)
        .where(UserRoles.user_id == user.id)
    )
    membership_result = await session.execute(
        select(OrganizationMembership)
        .join(Organization, Organization.id == OrganizationMembership.organization_id)
        .options(selectinload(OrganizationMembership.organization))
        .where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
            Organization.status == OrganizationStatus.ACTIVE,
        )
    )
    return CurrentUserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        status=user.status,
        email_verified_at=user.email_verified_at,
        roles=list(role_result.scalars()),
        organizations=[
            {
                "id": membership.id,
                "organization_id": membership.organization_id,
                "name": membership.organization.name,
                "slug": membership.organization.slug,
                "membership_role": membership.membership_role,
            }
            for membership in membership_result.scalars().all()
        ],
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    try:
        return await login_user(session, str(data.email), data.password)
    except ValueError as error:
        raise HTTPException(401, "Invalid email or password") from error


@router.post("/token", response_model=TokenResponse)
async def issue_token(
    data: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """OAuth-style alias for clients that use a bearer-token endpoint."""
    try:
        return await login_user(session, str(data.email), data.password)
    except ValueError as error:
        raise HTTPException(401, "Invalid email or password") from error


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    data: RegisterRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    try:
        return await register_user(
            session,
            data.full_name,
            str(data.email),
            data.password,
            role=data.role,
            registration_code=data.registration_code,
        )
    except ValueError as error:
        if str(error) == "Email is already registered":
            raise HTTPException(409, "Email is already registered") from error
        raise HTTPException(422, str(error)) from error


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    data: ForgotPasswordRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    message = await request_password_reset(session, str(data.email))
    return MessageResponse(message=message)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_route(
    data: ResetPasswordRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    try:
        message = await reset_password(session, data.token, data.new_password)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    return MessageResponse(message=message)


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email_route(
    data: VerifyEmailRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    try:
        message = await verify_email(session, data.token)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    return MessageResponse(message=message)


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_route(
    data: ResendVerificationRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    message = await resend_verification(session, str(data.email))
    return MessageResponse(message=message)


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh(
    data: RefreshTokenRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RefreshTokenResponse:
    try:
        token = await refresh_access_token(session, data.refresh_token)
    except ValueError as error:
        raise HTTPException(401, "Invalid refresh token") from error
    return RefreshTokenResponse(access_token=token)


@router.delete("/me", status_code=204)
async def delete_current_user(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    try:
        await delete_my_account(session, user.id)
    except ValueError as error:
        raise HTTPException(404, "User not found") from error
