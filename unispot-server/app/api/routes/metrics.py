from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies.auth import require_system_admin
from app.core.observability import metrics
from app.models.user import User

router = APIRouter(tags=["operations"])


@router.get("/admin/metrics")
async def read_metrics(_: Annotated[User, Depends(require_system_admin)]) -> dict[str, float]:
    return metrics.snapshot()
