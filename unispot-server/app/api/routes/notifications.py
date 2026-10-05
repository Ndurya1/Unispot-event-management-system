from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.booking import NotificationResponse
from app.services.booking_lifecycle import list_my_notifications, mark_notification_read

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/me", response_model=list[NotificationResponse])
async def list_mine(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[Notification]:
    return await list_my_notifications(
        session, user_id=current_user.id, limit=limit, offset=offset
    )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Notification:
    try:
        return await mark_notification_read(
            session, notification_id=notification_id, user_id=current_user.id
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
