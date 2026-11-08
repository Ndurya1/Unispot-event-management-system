from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.scheduling import RecurringSchedule, VenueWaitlist
from app.models.user import User
from app.schemas.scheduling import RecurringCreate, RecurringResponse, RecurringUpdate, WaitlistCreate, WaitlistResponse
from app.services.scheduling_service import (
    SchedulingError,
    SchedulingIdempotencyConflictError,
    cancel_waitlist,
    create_recurring,
    create_waitlist,
    list_all_recurring,
    list_all_waitlists,
    list_my_recurring,
    list_my_waitlists,
    update_recurring_status,
)
from app.api.dependencies.auth import require_system_admin

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


def _waitlist(item: VenueWaitlist) -> WaitlistResponse:
    return WaitlistResponse(
        id=item.id, user_id=item.user_id, venue_id=item.venue_id, venue_name=item.venue.name,
        requested_date=item.requested_date, requested_start=item.requested_start, requested_end=item.requested_end,
        event_name=item.event_name, status=item.status, confirmation_code=item.confirmation_code,
        created_at=item.created_at, cancelled_at=item.cancelled_at,
    )


def _recurring(item: RecurringSchedule) -> RecurringResponse:
    return RecurringResponse(
        id=item.id, user_id=item.user_id, venue_id=item.venue_id, venue_name=item.venue.name,
        event_name=item.event_name, day_of_week=item.day_of_week, start_time=item.start_time, end_time=item.end_time,
        status=item.status, confirmation_code=item.confirmation_code, created_at=item.created_at, updated_at=item.updated_at,
    )


@router.get("/waitlists", response_model=list[WaitlistResponse])
async def all_waitlists(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)], limit: int = 200, offset: int = 0) -> list[WaitlistResponse]:
    return [_waitlist(item) for item in await list_all_waitlists(session, limit=min(limit, 500), offset=max(offset, 0))]


@router.get("/recurring", response_model=list[RecurringResponse])
async def all_recurring(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)], limit: int = 200, offset: int = 0) -> list[RecurringResponse]:
    return [_recurring(item) for item in await list_all_recurring(session, limit=min(limit, 500), offset=max(offset, 0))]
async def create_waitlist_entry(
    data: WaitlistCreate, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> WaitlistResponse:
    if idempotency_key is None:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        return _waitlist(await create_waitlist(session, requester=current_user, data=data, idempotency_key=idempotency_key))
    except SchedulingIdempotencyConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except SchedulingError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/waitlists/me", response_model=list[WaitlistResponse])
async def my_waitlists(session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> list[WaitlistResponse]:
    return [_waitlist(item) for item in await list_my_waitlists(session, requester_id=current_user.id)]


@router.post("/waitlists/{waitlist_id}/cancel", response_model=WaitlistResponse)
async def cancel_waitlist_entry(waitlist_id: UUID, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> WaitlistResponse:
    try:
        return _waitlist(await cancel_waitlist(session, requester_id=current_user.id, waitlist_id=waitlist_id))
    except SchedulingError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/recurring", response_model=RecurringResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring_entry(
    data: RecurringCreate, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> RecurringResponse:
    if idempotency_key is None:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        return _recurring(await create_recurring(session, requester=current_user, data=data, idempotency_key=idempotency_key))
    except SchedulingIdempotencyConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except SchedulingError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/recurring/me", response_model=list[RecurringResponse])
async def my_recurring(session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> list[RecurringResponse]:
    return [_recurring(item) for item in await list_my_recurring(session, requester_id=current_user.id)]


@router.patch("/recurring/{recurring_id}", response_model=RecurringResponse)
async def patch_recurring(recurring_id: UUID, data: RecurringUpdate, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> RecurringResponse:
    try:
        return _recurring(await update_recurring_status(session, requester_id=current_user.id, recurring_id=recurring_id, status=data.status))
    except SchedulingError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
