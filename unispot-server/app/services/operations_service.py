import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operations import SystemSetting, PolicyRule, MaintenanceRecord
from app.models.user import User
from app.schemas.operations import (
    MaintenanceRecordCreate, MaintenanceRecordUpdate, PolicyRuleCreate, PolicyRuleUpdate, SystemSettingUpsert,
)


async def list_settings(session: AsyncSession) -> list[SystemSetting]:
    return list((await session.execute(select(SystemSetting).order_by(SystemSetting.key))).scalars().all())


async def upsert_setting(session: AsyncSession, *, data: SystemSettingUpsert, actor: User) -> SystemSetting:
    setting = await session.get(SystemSetting, data.key)
    if setting is None:
        setting = SystemSetting(key=data.key, value_json=data.value_json, description=data.description, updated_by_user_id=actor.id)
        session.add(setting)
    else:
        setting.value_json = data.value_json
        setting.description = data.description
        setting.updated_by_user_id = actor.id
        setting.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(setting)
    return setting


async def list_policies(session: AsyncSession, *, scope: str | None = None) -> list[PolicyRule]:
    stmt = select(PolicyRule).order_by(PolicyRule.scope, PolicyRule.name)
    if scope:
        stmt = stmt.where(PolicyRule.scope == scope)
    return list((await session.execute(stmt)).scalars().all())


async def create_policy(session: AsyncSession, *, data: PolicyRuleCreate, actor: User) -> PolicyRule:
    row = PolicyRule(**data.model_dump(), updated_by_user_id=actor.id)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def update_policy(session: AsyncSession, *, policy_id: UUID, data: PolicyRuleUpdate, actor: User) -> PolicyRule:
    row = await session.get(PolicyRule, policy_id)
    if row is None:
        raise ValueError("Policy rule not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    row.updated_by_user_id = actor.id
    row.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(row)
    return row


async def delete_policy(session: AsyncSession, *, policy_id: UUID) -> None:
    row = await session.get(PolicyRule, policy_id)
    if row is None:
        raise ValueError("Policy rule not found")
    await session.delete(row)
    await session.commit()


async def list_maintenance(session: AsyncSession, *, status: str | None = None, limit: int = 200) -> list[MaintenanceRecord]:
    stmt = select(MaintenanceRecord).order_by(MaintenanceRecord.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(MaintenanceRecord.status == status)
    return list((await session.execute(stmt)).scalars().all())


async def create_maintenance(session: AsyncSession, *, data: MaintenanceRecordCreate, actor: User) -> MaintenanceRecord:
    row = MaintenanceRecord(**data.model_dump(), created_by_user_id=actor.id)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def update_maintenance(session: AsyncSession, *, record_id: UUID, data: MaintenanceRecordUpdate, actor: User) -> MaintenanceRecord:
    row = await session.get(MaintenanceRecord, record_id)
    if row is None:
        raise ValueError("Maintenance record not found")
    values = data.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(row, field, value)
    if values.get("status") == "COMPLETED" and row.completed_at is None:
        row.completed_at = datetime.now(UTC)
    row.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(row)
    return row
