from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_event import ActorType, AuditEvent, AuditOutcome
from app.models.booking import BookingSource
from app.models.role import Role
from app.models.user import User, UserStatus
from app.models.user_role import UserRoles


async def update_user_status(
    session: AsyncSession, *, target_id: UUID, actor_id: UUID, status: UserStatus
) -> User:
    user = await session.get(User, target_id)
    if user is None:
        raise ValueError("User not found")
    if target_id == actor_id and status is not UserStatus.ACTIVE:
        raise ValueError("Administrators cannot suspend or disable themselves")
    old_status = user.status
    user.status = status
    session.add(
        AuditEvent(
            actor_user_id=actor_id,
            actor_type=ActorType.USER,
            action="USER_STATUS_CHANGED",
            target_type="USER",
            target_id=user.id,
            channel=BookingSource.WEB,
            outcome=AuditOutcome.SUCCEEDED,
            event_metadata={"from": old_status.value, "to": status.value},
        )
    )
    await session.commit()
    await session.refresh(user)
    return user


async def assign_user_role(
    session: AsyncSession, *, target_id: UUID, actor_id: UUID, role_name: str
) -> UserRoles:
    user = await session.get(User, target_id)
    role = await session.scalar(select(Role).where(Role.name == role_name))
    if user is None:
        raise ValueError("User not found")
    if role is None:
        raise ValueError("Role not found")
    existing = await session.get(UserRoles, {"user_id": target_id, "role_id": role.id})
    if existing is not None:
        raise ValueError("User already has this role")
    assignment = UserRoles(user_id=target_id, role_id=role.id)
    session.add(assignment)
    session.add(
        AuditEvent(
            actor_user_id=actor_id,
            actor_type=ActorType.USER,
            action="USER_ROLE_ASSIGNED",
            target_type="USER",
            target_id=target_id,
            channel=BookingSource.WEB,
            outcome=AuditOutcome.SUCCEEDED,
            event_metadata={"role": role_name},
        )
    )
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("User already has this role") from error
    await session.refresh(assignment)
    return assignment


async def remove_user_role(
    session: AsyncSession, *, target_id: UUID, actor_id: UUID, role_name: str
) -> None:
    role = await session.scalar(select(Role).where(Role.name == role_name))
    assignment = (
        None
        if role is None
        else await session.get(UserRoles, {"user_id": target_id, "role_id": role.id})
    )
    if role is None or assignment is None:
        raise ValueError("User role not found")
    if role_name == "SYSTEM_ADMIN":
        admins = await session.scalar(
            select(func.count())
            .select_from(UserRoles)
            .join(Role, Role.id == UserRoles.role_id)
            .join(User, User.id == UserRoles.user_id)
            .where(Role.name == "SYSTEM_ADMIN", User.status == UserStatus.ACTIVE)
        )
        if (admins or 0) <= 1:
            raise ValueError("The last active system administrator cannot be removed")
    await session.delete(assignment)
    session.add(
        AuditEvent(
            actor_user_id=actor_id,
            actor_type=ActorType.USER,
            action="USER_ROLE_REMOVED",
            target_type="USER",
            target_id=target_id,
            channel=BookingSource.WEB,
            outcome=AuditOutcome.SUCCEEDED,
            event_metadata={"role": role_name},
        )
    )
    await session.commit()
