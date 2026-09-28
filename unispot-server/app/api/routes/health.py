from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel

from app.api.dependencies.database import require_database_connection

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str


class ReadinessResponse(BaseModel):
    status: Literal["ready"] = "ready"
    database: Literal["available"] = "available"


@router.get("/health", response_model=HealthResponse, summary="Process liveness")
async def health(request: Request) -> HealthResponse:
    return HealthResponse(version=request.app.state.settings.app_version)


@router.get(
    "/health/readiness",
    response_model=ReadinessResponse,
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "PostgreSQL is unavailable",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {
                            "code": "database_unavailable",
                            "message": "Database is temporarily unavailable",
                        }
                    }
                }
            },
        }
    },
    summary="Database readiness",
)
async def readiness(
    database_check: Annotated[None, Depends(require_database_connection)],
) -> ReadinessResponse:
    del database_check
    return ReadinessResponse()
