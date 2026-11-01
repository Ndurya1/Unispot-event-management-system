from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_system_admin
from app.api.dependencies.database import get_db
from app.models.user import User
from app.schemas.admin import AdminAnnouncementCreate, AdminAnnouncementResponse
from app.services.admin_notification_service import create_admin_announcement

router = APIRouter(prefix="/admin/notifications", tags=["admin notifications"])


@router.post(
    "",
    response_model=AdminAnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_announcement(
    data: AdminAnnouncementCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_system_admin)],
) -> AdminAnnouncementResponse:
    return await create_admin_announcement(session, actor_id=current_user.id, data=data)
