from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.core.security import create_access_token, password_hash, verify_password
from app.models.user import User
from app.schemas.user import (
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)


router = APIRouter(prefix="/users", tags=["users"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_user(
    user_data: UserCreate,
    session: AsyncSession = Depends(get_db),
) -> User:
    result = await session.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        password_hash=password_hash.hash(user_data.password),
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login_user(
    user_data: UserLogin,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await session.execute(
        select(User).where(User.email == user_data.email)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(
        user_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(str(user.id))

    return TokenResponse(access_token=access_token)


@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_my_profile(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user
