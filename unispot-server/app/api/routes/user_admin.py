from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_system_admin
from app.api.dependencies.database import get_db
from app.models.user import User, UserStatus
from app.schemas.user_admin import (
    RoleAssignment,
    UserAdminListResponse,
    UserAdminResponse,
    UserStatusUpdate,
)
from app.services.user_admin_service import (
    assign_user_role,
    list_users,
    remove_user_role,
    update_user_status,
)

router = APIRouter(prefix="/admin/users", tags=["user administration"])


@router.get("", response_model=list[UserAdminListResponse])
async def list_all(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_system_admin)],
    search: str | None = Query(default=None, max_length=160),
    user_status: UserStatus | None = Query(default=None, alias="status"),  # noqa: B008
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=10000),
) -> list[UserAdminListResponse]:
    users = await list_users(
        session,
        search=search,
        status=user_status,
        limit=limit,
        offset=offset,
    )
    return [
        UserAdminListResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            status=user.status,
            created_at=user.created_at,
            roles=[assignment.role.name for assignment in user.user_roles],
        )
        for user in users
    ]


@router.patch("/{user_id}/status", response_model=UserAdminResponse)
async def set_status(
    user_id: UUID,
    data: UserStatusUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> User:
    try:
        return await update_user_status(
            session, target_id=user_id, actor_id=admin.id, status=data.status
        )
    except ValueError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from error


@router.post("/{user_id}/roles", status_code=status.HTTP_204_NO_CONTENT)
async def add_role(
    user_id: UUID,
    data: RoleAssignment,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> None:
    try:
        await assign_user_role(
            session, target_id=user_id, actor_id=admin.id, role_name=data.role_name
        )
    except ValueError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from error


@router.delete("/{user_id}/roles/{role_name}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_role(
    user_id: UUID,
    role_name: str,
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_system_admin)],
) -> None:
    try:
        await remove_user_role(session, target_id=user_id, actor_id=admin.id, role_name=role_name)
    except ValueError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from error
