from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_event import ActorType, AuditEvent, AuditOutcome
from app.models.booking import BookingSource
from app.models.notification import (
    DeliveryStatus,
    Notification,
    NotificationChannel,
    NotificationType,
)
from app.models.role import Role
from app.models.user import User, UserStatus
from app.models.user_role import UserRoles
from app.schemas.admin import AdminAnnouncementCreate, AdminAnnouncementResponse

ROLE_GROUPS = {
    "ORGANIZERS": "ORGANIZER",
    "VENUE_ADMINS": "VENUE_ADMIN",
    "SYSTEM_ADMINS": "SYSTEM_ADMIN",
}


async def create_admin_announcement(
    session: AsyncSession,
    *,
    actor_id: UUID,
    data: AdminAnnouncementCreate,
) -> AdminAnnouncementResponse:
    statement = select(User).where(User.status == UserStatus.ACTIVE)
    role_name = ROLE_GROUPS.get(data.recipient_group)
    if role_name is not None:
        statement = (
            statement.join(UserRoles, UserRoles.user_id == User.id)
            .join(Role, Role.id == UserRoles.role_id)
            .where(Role.name == role_name)
        )
    users = list((await session.scalars(statement)).unique().all())
    created_at = datetime.now(UTC)
    notifications = [
        Notification(
            user_id=user.id,
            type=NotificationType.ANNOUNCEMENT,
            channel=NotificationChannel.IN_APP,
            title=data.title,
            body=data.body,
            delivery_status=DeliveryStatus.PENDING,
        )
        for user in users
    ]
    session.add_all(notifications)
    session.add(
        AuditEvent(
            actor_user_id=actor_id,
            actor_type=ActorType.USER,
            action="ADMIN_ANNOUNCEMENT_CREATED",
            target_type="NOTIFICATION_BROADCAST",
            channel=BookingSource.WEB,
            outcome=AuditOutcome.SUCCEEDED,
            event_metadata={
                "recipient_group": data.recipient_group,
                "recipient_count": len(users),
                "title": data.title,
            },
        )
    )
    await session.commit()
    return AdminAnnouncementResponse(
        recipient_group=data.recipient_group,
        recipient_count=len(users),
        title=data.title,
        delivery_status=DeliveryStatus.PENDING,
        created_at=created_at,
    )
