from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.core.observability import actor_context
from app.core.security import verify_access_token
from app.models.audit_event import ActorType, AuditEvent, AuditOutcome
from app.models.booking import BookingSource
from app.models.role import Role
from app.models.user import User, UserStatus
from app.models.user_role import UserRoles

security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials,
        Depends(security),
    ],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    try:
        payload = verify_access_token(credentials.credentials)
        user_id = UUID(str(payload.get("user_id", "")))

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )

    except (jwt.InvalidTokenError, ValueError) as error:
        await _record_denied_auth(session, "AUTHENTICATION_FAILED")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) from error

    result = await session.execute(select(User).where(User.id == user_id))

    user = result.scalar_one_or_none()

    if user is None or user.status != UserStatus.ACTIVE:
        await _record_denied_auth(
            session,
            "AUTHENTICATION_FAILED",
            actor_user_id=user.id if user is not None else None,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    actor_context.set(str(user.id))
    return user


async def require_system_admin(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    result = await session.execute(
        select(Role)
        .join(UserRoles, UserRoles.role_id == Role.id)
        .where(
            UserRoles.user_id == current_user.id,
            Role.name == "SYSTEM_ADMIN",
        )
    )

    if result.scalars().first() is None:
        await _record_denied_auth(session, "AUTHORIZATION_DENIED", actor_user_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System administrator privileges required",
        )

    return current_user


async def _record_denied_auth(
    session: AsyncSession, action: str, actor_user_id: UUID | None = None
) -> None:
    try:
        session.add(
            AuditEvent(
                actor_user_id=actor_user_id,
                actor_type=ActorType.USER if actor_user_id else ActorType.SYSTEM,
                action=action,
                target_type="USER",
                target_id=actor_user_id,
                channel=BookingSource.WEB,
                outcome=AuditOutcome.DENIED,
            )
        )
        await session.commit()
    except Exception:
        await session.rollback()


async def require_venue_admin(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    result = await session.execute(
        select(Role.name)
        .join(UserRoles, UserRoles.role_id == Role.id)
        .where(
            UserRoles.user_id == current_user.id,
            Role.name.in_(["VENUE_ADMIN", "SYSTEM_ADMIN"]),
        )
    )
    if result.scalars().first() is None:
        await _record_denied_auth(session, "AUTHORIZATION_DENIED", actor_user_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Venue administrator privileges required",
        )
    return current_user
