from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user, require_organizer_or_admin, require_system_admin
from app.api.dependencies.database import get_db
from app.models.event import EventRegistration
from app.models.user import User
from app.schemas.event import (
    EventAttendanceResponse,
    EventCreate,
    EventRegistrationCreate,
    EventRegistrationResponse,
    EventResponse,
    EventUpdate,
)
from app.services.event_service import (
    EventConflictError,
    EventError,
    EventIdempotencyConflictError,
    _require_event_manage_access,
    cancel_event,
    check_in_registration,
    create_event,
    create_event_registration,
    get_event_attendance,
    get_event_by_id,
    list_all_event_registrations,
    list_all_events,
    list_event_registrations_for_manager,
    list_events,
    list_manageable_events,
    list_my_event_registrations,
    update_event,
)

router = APIRouter(prefix="/events", tags=["events"])


def _registration_response(registration: EventRegistration) -> EventRegistrationResponse:
    return EventRegistrationResponse(
        id=registration.id, event_id=registration.event_id, event_title=registration.event.title,
        user_id=registration.user_id, full_name=registration.full_name, email=registration.email,
        phone=registration.phone, student_id=registration.student_id, status=registration.status,
        confirmation_code=registration.confirmation_code, checked_in_at=registration.checked_in_at,
        created_at=registration.created_at, cancelled_at=registration.cancelled_at,
    )


def _event_response(event: object) -> dict[str, object]:
    if isinstance(event, dict):
        return event
    return {
        "id": event.id, "slug": event.slug, "title": event.title, "description": event.description,
        "category": event.category, "organizer": event.organizer, "location": event.location,
        "starts_at": event.starts_at, "ends_at": event.ends_at, "capacity": event.capacity,
        "status": event.status, "confirmed_registrations": 0, "remaining_capacity": event.capacity,
    }


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create(data: EventCreate, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_organizer_or_admin)]) -> dict[str, object]:
    try:
        return await create_event(session, data=data, actor=current_user)
    except EventConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except EventError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("", response_model=list[EventResponse])
async def list_published(session: Annotated[AsyncSession, Depends(get_db)]) -> list[dict[str, object]]:
    return await list_events(session)


@router.get("/admin", response_model=list[EventResponse])
async def admin_list(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)], include_cancelled: bool = True, limit: int = 200, offset: int = 0) -> list[dict[str, object]]:
    return await list_all_events(session, include_cancelled=include_cancelled, limit=min(limit, 500), offset=max(offset, 0))

@router.get("/manage", response_model=list[EventResponse])
async def managed_events(session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_organizer_or_admin)]) -> list[dict[str, object]]:
    return await list_manageable_events(session, actor=current_user)


@router.post("/registrations", response_model=EventRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register(data: EventRegistrationCreate, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)], idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> EventRegistrationResponse:
    if idempotency_key is None:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required")
    try:
        return _registration_response(await create_event_registration(session, requester=current_user, data=data, idempotency_key=idempotency_key))
    except EventConflictError as error:
        raise HTTPException(status_code=409, detail={"code": "event_full", "message": str(error), "details": [{"code": "remaining_capacity", "value": error.remaining_capacity}]}) from error
    except EventIdempotencyConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except EventError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/registrations", response_model=list[EventRegistrationResponse])
async def all_registrations(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)], limit: int = 200, offset: int = 0) -> list[EventRegistrationResponse]:
    return [_registration_response(item) for item in await list_all_event_registrations(session, limit=min(limit, 500), offset=max(offset, 0))]


@router.get("/registrations/me", response_model=list[EventRegistrationResponse])
async def my_registrations(session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> list[EventRegistrationResponse]:
    return [_registration_response(item) for item in await list_my_event_registrations(session, requester_id=current_user.id)]


@router.get("/{event_id}/registrations", response_model=list[EventRegistrationResponse])
async def event_registrations(event_id: UUID, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_organizer_or_admin)]) -> list[EventRegistrationResponse]:
    try:
        return [_registration_response(item) for item in await list_event_registrations_for_manager(session, event_id=event_id, actor=current_user)]
    except EventError as error:
        code = 404 if "not found" in str(error).lower() else 403
        raise HTTPException(status_code=code, detail=str(error)) from error


@router.post("/registrations/{registration_id}/check-in", response_model=EventRegistrationResponse)
async def check_in(registration_id: UUID, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> EventRegistrationResponse:
    try:
        return _registration_response(await check_in_registration(session, registration_id=registration_id, requester=current_user, allow_event_manager=True))
    except EventError as error:
        code = 403 if "permission" in str(error).lower() else 400
        if "not found" in str(error).lower():
            code = 404
        raise HTTPException(status_code=code, detail=str(error)) from error


@router.get("/{event_id}", response_model=EventResponse)
async def get_one(event_id: UUID, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_organizer_or_admin)]) -> dict[str, object]:
    event = await get_event_by_id(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    try:
        await _require_event_manage_access(session, event=event, user=current_user)
    except EventError:
        raise HTTPException(status_code=403, detail="You do not have permission to view this event")
    counts = await list_all_events(session, include_cancelled=True, limit=500)
    return next((item for item in counts if str(item["id"]) == str(event.id)), _event_response(event))


@router.patch("/{event_id}", response_model=EventResponse)
async def patch_event(event_id: UUID, data: EventUpdate, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_organizer_or_admin)]) -> dict[str, object]:
    event_obj = await get_event_by_id(session, event_id)
    if event_obj is None:
        raise HTTPException(status_code=404, detail="Event not found")
    try:
        await _require_event_manage_access(session, event=event_obj, user=current_user)
        return await update_event(session, event_id=event_id, data=data, actor=current_user, notify_registrants=True)
    except EventConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except EventError as error:
        code = 404 if "not found" in str(error).lower() else 400
        if "permission" in str(error).lower():
            code = 403
        raise HTTPException(status_code=code, detail=str(error)) from error


@router.post("/{event_id}/cancel", response_model=EventResponse)
async def cancel(event_id: UUID, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_organizer_or_admin)]) -> dict[str, object]:
    event_obj = await get_event_by_id(session, event_id)
    if event_obj is None:
        raise HTTPException(status_code=404, detail="Event not found")
    try:
        await _require_event_manage_access(session, event=event_obj, user=current_user)
        return await cancel_event(session, event_id=event_id, actor=current_user, notify_registrants=True)
    except EventError as error:
        code = 404 if "not found" in str(error).lower() else 403
        raise HTTPException(status_code=code, detail=str(error)) from error


@router.get("/{event_id}/attendance", response_model=EventAttendanceResponse)
async def attendance(event_id: UUID, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_organizer_or_admin)]) -> dict[str, object]:
    try:
        return await get_event_attendance(session, event_id=event_id, actor=current_user)
    except EventError as error:
        code = 404 if "not found" in str(error).lower() else 403
        raise HTTPException(status_code=code, detail=str(error)) from error


