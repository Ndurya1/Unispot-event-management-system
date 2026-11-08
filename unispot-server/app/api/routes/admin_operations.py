from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user, require_system_admin
from app.api.dependencies.database import get_db
from app.models.user import User
from app.schemas.operations import (
    MaintenanceRecordCreate, MaintenanceRecordResponse, MaintenanceRecordUpdate,
    PolicyRuleCreate, PolicyRuleResponse, PolicyRuleUpdate, SystemSettingResponse, SystemSettingUpsert,
)
from app.services import operations_service

router = APIRouter(prefix="/admin", tags=["admin-operations"])


@router.get("/settings", response_model=list[SystemSettingResponse])
async def list_settings(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)]):
    return await operations_service.list_settings(session)


@router.put("/settings", response_model=SystemSettingResponse)
async def upsert_setting(data: SystemSettingUpsert, session: Annotated[AsyncSession, Depends(get_db)], admin: Annotated[User, Depends(require_system_admin)]):
    return await operations_service.upsert_setting(session, data=data, actor=admin)


@router.get("/policies", response_model=list[PolicyRuleResponse])
async def list_policies(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)], scope: str | None = Query(default=None)):
    return await operations_service.list_policies(session, scope=scope)


@router.post("/policies", response_model=PolicyRuleResponse, status_code=201)
async def create_policy(data: PolicyRuleCreate, session: Annotated[AsyncSession, Depends(get_db)], admin: Annotated[User, Depends(require_system_admin)]):
    return await operations_service.create_policy(session, data=data, actor=admin)


@router.patch("/policies/{policy_id}", response_model=PolicyRuleResponse)
async def update_policy(policy_id: UUID, data: PolicyRuleUpdate, session: Annotated[AsyncSession, Depends(get_db)], admin: Annotated[User, Depends(require_system_admin)]):
    try:
        return await operations_service.update_policy(session, policy_id=policy_id, data=data, actor=admin)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/policies/{policy_id}", status_code=204)
async def delete_policy(policy_id: UUID, session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)]):
    try:
        await operations_service.delete_policy(session, policy_id=policy_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/maintenance", response_model=list[MaintenanceRecordResponse])
async def list_maintenance(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)], status: str | None = Query(default=None), limit: int = Query(default=200, ge=1, le=500)):
    return await operations_service.list_maintenance(session, status=status, limit=limit)


@router.post("/maintenance", response_model=MaintenanceRecordResponse, status_code=201)
async def create_maintenance(data: MaintenanceRecordCreate, session: Annotated[AsyncSession, Depends(get_db)], admin: Annotated[User, Depends(require_system_admin)]):
    return await operations_service.create_maintenance(session, data=data, actor=admin)


@router.patch("/maintenance/{record_id}", response_model=MaintenanceRecordResponse)
async def update_maintenance(record_id: UUID, data: MaintenanceRecordUpdate, session: Annotated[AsyncSession, Depends(get_db)], admin: Annotated[User, Depends(require_system_admin)]):
    try:
        return await operations_service.update_maintenance(session, record_id=record_id, data=data, actor=admin)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
