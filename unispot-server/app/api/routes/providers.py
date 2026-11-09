from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Annotated
from app.api.dependencies.auth import get_current_user, require_system_admin
from app.api.dependencies.database import get_db
from app.core.config import get_settings

from app.models.user import User
from app.schemas.provider import (
    ServiceProviderCreate,
    ServiceProviderResponse,
    ServiceProviderUpdate,
    ServiceRequestAssign,
    ServiceRequestCreate,
    ServiceRequestQuote,
    ServiceRequestResponse,
    ServiceRequestStatusUpdate,
)
from app.services import provider_service

router = APIRouter(prefix="/providers", tags=["providers"])


def _sr(r) -> ServiceRequestResponse:
    return ServiceRequestResponse(id=r.id, provider_id=r.provider_id, provider_name=r.provider.name if r.provider else "", requester_id=r.requester_id, assigned_provider_id=r.assigned_provider_id, assigned_at=r.assigned_at, event_name=r.event_name, requested_date=r.requested_date, notes=r.notes, quote_amount_kes=r.quote_amount_kes, quote_notes=r.quote_notes, quoted_at=r.quoted_at, status=r.status, confirmation_code=r.confirmation_code, created_at=r.created_at, cancelled_at=r.cancelled_at)


@router.get("", response_model=list[ServiceProviderResponse])
async def list_service_providers(request: Request, session: Annotated[AsyncSession, Depends(get_db)]) -> list[ServiceProviderResponse]:
    request.state.critical_path = "service_providers_list"
    return [ServiceProviderResponse.model_validate(p) for p in await provider_service.list_providers(session)]


@router.get("/me/profile", response_model=ServiceProviderResponse | None)
async def my_provider_profile(request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> ServiceProviderResponse | None:
    request.state.critical_path = "service_provider_me"
    p = await provider_service.get_my_provider_profile(session, user_id=current_user.id)
    return ServiceProviderResponse.model_validate(p) if p else None


@router.get("/admin/all", response_model=list[ServiceProviderResponse])
async def admin_list_service_providers(request: Request, session: Annotated[AsyncSession, Depends(get_db)], _=Depends(require_system_admin)) -> list[ServiceProviderResponse]:
    request.state.critical_path = "admin_service_providers_list"
    return [ServiceProviderResponse.model_validate(p) for p in await provider_service.list_all_providers_admin(session)]


@router.post("/admin", response_model=ServiceProviderResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_service_provider(payload: ServiceProviderCreate, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_system_admin)]) -> ServiceProviderResponse:
    request.state.critical_path = "admin_service_provider_create"
    try:
        return ServiceProviderResponse.model_validate(await provider_service.create_provider(session, data=payload, actor=current_user))
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch("/admin/{provider_id}", response_model=ServiceProviderResponse)
async def admin_update_service_provider(provider_id: UUID, payload: ServiceProviderUpdate, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_system_admin)]) -> ServiceProviderResponse:
    request.state.critical_path = "admin_service_provider_update"
    try:
        return ServiceProviderResponse.model_validate(await provider_service.update_provider(session, provider_id=provider_id, data=payload, actor=current_user))
    except provider_service.ProviderAccessError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/me/profile", response_model=ServiceProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_my_provider_profile(payload: ServiceProviderCreate, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> ServiceProviderResponse:
    request.state.critical_path = "service_provider_profile_create"
    payload.owner_user_id = current_user.id
    payload.status = None
    try:
        return ServiceProviderResponse.model_validate(await provider_service.create_provider(session, data=payload, actor=current_user))
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch("/me/profile/{provider_id}", response_model=ServiceProviderResponse)
async def update_my_provider_profile(provider_id: UUID, payload: ServiceProviderUpdate, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> ServiceProviderResponse:
    request.state.critical_path = "service_provider_profile_update"
    try:
        return ServiceProviderResponse.model_validate(await provider_service.update_provider(session, provider_id=provider_id, data=payload, actor=current_user))
    except provider_service.ProviderAccessError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/requests", response_model=ServiceRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_service_request(payload: ServiceRequestCreate, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)], idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")) -> ServiceRequestResponse:
    request.state.critical_path = "service_request_create"
    if not idempotency_key or len(idempotency_key) > get_settings().booking_idempotency_key_max_length:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Idempotency-Key must contain between 1 and {get_settings().booking_idempotency_key_max_length} characters")
    try:
        sr = await provider_service.create_service_request(session, requester=current_user, data=payload, idempotency_key=idempotency_key)
        return _sr(sr)
    except provider_service.ProviderIdempotencyConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/requests", response_model=list[ServiceRequestResponse])
async def my_service_requests(request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> list[ServiceRequestResponse]:
    request.state.critical_path = "service_requests_list"
    return [_sr(r) for r in await provider_service.list_my_service_requests(session, requester_id=current_user.id)]


@router.post("/requests/{request_id}/cancel", response_model=ServiceRequestResponse)
async def cancel_my_service_request(request_id: UUID, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> ServiceRequestResponse:
    request.state.critical_path = "service_request_cancel"
    try:
        return _sr(await provider_service.cancel_my_service_request(session, request_id=request_id, requester=current_user))
    except provider_service.ProviderAccessError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/requests/admin", response_model=list[ServiceRequestResponse])
async def admin_service_requests(request: Request, session: Annotated[AsyncSession, Depends(get_db)], _=Depends(require_system_admin)) -> list[ServiceRequestResponse]:
    request.state.critical_path = "admin_service_requests_list"
    return [_sr(r) for r in await provider_service.list_service_requests_admin(session)]


@router.post("/requests/admin/{request_id}/assign", response_model=ServiceRequestResponse)
async def admin_assign_service_request(request_id: UUID, payload: ServiceRequestAssign, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_system_admin)]) -> ServiceRequestResponse:
    request.state.critical_path = "admin_service_request_assign"
    try:
        return _sr(await provider_service.assign_service_request(session, request_id=request_id, assigned_provider_id=payload.assigned_provider_id, actor=current_user))
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/requests/admin/{request_id}/status", response_model=ServiceRequestResponse)
async def admin_update_service_request(request_id: UUID, payload: ServiceRequestStatusUpdate, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(require_system_admin)]) -> ServiceRequestResponse:
    request.state.critical_path = "admin_service_request_status"
    try:
        return _sr(await provider_service.admin_update_service_request(session, request_id=request_id, actor=current_user, status=payload.status))
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/requests/assigned", response_model=list[ServiceRequestResponse])
async def my_assigned_service_requests(request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> list[ServiceRequestResponse]:
    request.state.critical_path = "service_requests_assigned_list"
    return [_sr(r) for r in await provider_service.list_assigned_service_requests(session, user_id=current_user.id)]


@router.post("/requests/assigned/{request_id}/status", response_model=ServiceRequestResponse)
async def update_assigned_service_request_status(request_id: UUID, payload: ServiceRequestStatusUpdate, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> ServiceRequestResponse:
    request.state.critical_path = "service_request_assigned_status_update"
    try:
        return _sr(await provider_service.update_assigned_service_request_status(session, request_id=request_id, user_id=current_user.id, new_status=payload.status))
    except provider_service.ProviderAccessError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/requests/assigned/{request_id}/quote", response_model=ServiceRequestResponse)
async def quote_assigned_service_request(request_id: UUID, payload: ServiceRequestQuote, request: Request, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]) -> ServiceRequestResponse:
    request.state.critical_path = "service_request_quote"
    try:
        return _sr(await provider_service.quote_service_request(session, request_id=request_id, user_id=current_user.id, data=payload))
    except provider_service.ProviderAccessError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except provider_service.ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
