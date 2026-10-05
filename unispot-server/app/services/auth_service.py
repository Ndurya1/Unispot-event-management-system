from datetime import UTC, datetime

import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from app.models.user import User, UserStatus


async def login_user(
    session: AsyncSession,
    email: str,
    password: str,
) -> dict[str, str]:
    result = await session.execute(select(User).where(User.email == email))

    user = result.scalar_one_or_none()

    # Generic response for invalid credentials
    if user is None:
        raise ValueError("Invalid email or password")

    # Disabled users cannot authenticate
    if user.status != UserStatus.ACTIVE:
        raise ValueError("Invalid email or password")

    if user.password_hash is None:
        raise ValueError("Invalid email or password")

    if not await run_in_threadpool(verify_password, user.password_hash, password):
        raise ValueError("Invalid email or password")

    # Record successful login
    user.last_login_at = datetime.now(UTC)

    access_token = create_access_token(
        {
            "user_id": str(user.id),
        }
    )

    refresh_token = create_refresh_token(
        {
            "user_id": str(user.id),
        }
    )

    await session.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


async def refresh_access_token(
    refresh_token: str,
) -> str:
    from app.core.security import verify_refresh_token

    try:
        payload = verify_refresh_token(refresh_token)
    except jwt.InvalidTokenError as error:
        raise ValueError("Invalid refresh token") from error

    user_id = payload.get("user_id")

    if not user_id:
        raise ValueError("Invalid refresh token")

    return create_access_token(
        {
            "user_id": user_id,
        }
    )
