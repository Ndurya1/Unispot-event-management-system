from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TokenResponse,
)
from app.services.auth_service import login_user, refresh_access_token

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    try:
        return await login_user(session, str(data.email), data.password)
    except ValueError as error:
        raise HTTPException(401, "Invalid email or password") from error


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
