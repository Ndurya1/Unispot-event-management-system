from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.schemas.assistant import AssistantMessageRequest, AssistantMessageResponse
from app.services.assistant_service import process_assistant_message

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/messages", response_model=AssistantMessageResponse)
async def send_message(
    request: AssistantMessageRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> AssistantMessageResponse:
    try:
        return await process_assistant_message(
            session,
            requester=current_user,
            request=request,
            idempotency_key=idempotency_key,
        )
    except ValueError as error:
        detail = str(error)
        status_code = (
            404 if detail in {"Conversation not found", "Conversation has expired"} else 422
        )
        raise HTTPException(status_code=status_code, detail=detail) from error
