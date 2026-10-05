from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_system_admin
from app.api.dependencies.database import get_db
from app.models.audit_event import AuditEvent
from app.models.user import User
from app.schemas.audit import AuditEventResponse

router = APIRouter(prefix="/admin/audit", tags=["audit"])


@router.get("", response_model=list[AuditEventResponse])
async def list_events(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_system_admin)],
    target_type: str | None = None,
    action: str | None = None,
    limit: int = Query(default=100, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
) -> list[AuditEvent]:
    conditions = []
    if target_type is not None:
        conditions.append(AuditEvent.target_type == target_type)
    if action is not None:
        conditions.append(AuditEvent.action == action)
    result = await session.execute(
        select(AuditEvent)
        .where(*conditions)
        .order_by(AuditEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())
