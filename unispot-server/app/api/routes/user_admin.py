from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_system_admin
from app.api.dependencies.database import get_db
from app.models.user import User
from app.schemas.user_admin import RoleAssignment, UserAdminResponse, UserStatusUpdate
from app.services.user_admin_service import (
    assign_user_role,
    remove_user_role,
    update_user_status,
)

router = APIRouter(prefix="/admin/users", tags=["user administration"])


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
