import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_event import ActorType, AuditEvent, AuditOutcome
from app.models.booking import BookingSource, IdempotencyKey
from app.models.notification import DeliveryStatus, Notification, NotificationChannel, NotificationType
from app.models.provider import ProviderStatus, ServiceProvider, ServiceRequest, ServiceRequestStatus
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRoles
from app.schemas.provider import ServiceProviderCreate, ServiceProviderUpdate, ServiceRequestCreate, ServiceRequestQuote
from app.services.booking_policy import require_active_organizer_membership
from app.services.idempotency import lock_idempotency_key

IDEMPOTENCY_RETENTION = timedelta(hours=24)
DEFAULT_PROVIDERS = [
    {"slug": "royal-catering", "name": "Royal Catering Services", "category": "Catering", "description": "Campus-friendly refreshments, snack tables, and catered meals for student events.", "location": "Main Campus", "price_from_kes": 5000, "rating": "4.8", "reviews": 76, "availability": "today", "image_url": "/assets/event-culture.jpg"},
    {"slug": "pocus-media", "name": "Pocus Media Kenya", "category": "Photography & Videography", "description": "Event photography and short-form video coverage for campus organizations.", "location": "Main Campus", "price_from_kes": 12000, "rating": "4.9", "reviews": 42, "availability": "week", "image_url": "/assets/event-innovation.jpg"},
    {"slug": "sound-masters", "name": "Sound Masters KE", "category": "Sound Systems", "description": "Sound, microphones, and basic technical support for indoor and outdoor events.", "location": "Main Campus", "price_from_kes": 18000, "rating": "4.7", "reviews": 64, "availability": "today", "image_url": "/assets/event-leadership.jpg"},
    {"slug": "event-decor", "name": "Event Decor Solutions", "category": "Decorations", "description": "Simple stage, table, and campus-space decorations tailored to your event.", "location": "Main Campus", "price_from_kes": 8000, "rating": "4.6", "reviews": 28, "availability": "week", "image_url": "/assets/event-culture.jpg"},
]

PROVIDER_TRANSITIONS = {
    ServiceRequestStatus.PENDING: {ServiceRequestStatus.ACCEPTED, ServiceRequestStatus.CANCELLED},
    ServiceRequestStatus.ACCEPTED: {ServiceRequestStatus.IN_PROGRESS, ServiceRequestStatus.CANCELLED},
    ServiceRequestStatus.IN_PROGRESS: {ServiceRequestStatus.COMPLETED, ServiceRequestStatus.CANCELLED},
    ServiceRequestStatus.COMPLETED: set(),
    ServiceRequestStatus.CANCELLED: set(),
}


class ProviderError(ValueError):
    pass


class ProviderIdempotencyConflictError(ProviderError):
    pass


class ProviderAccessError(ProviderError):
    pass


def _slugify(value: str) -> str:
    base = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    while "--" in base:
        base = base.replace("--", "-")
    return base[:110] or "provider"


async def _is_admin(session: AsyncSession, user_id: UUID) -> bool:
    result = await session.execute(select(Role.name).join(UserRoles, UserRoles.role_id == Role.id).where(UserRoles.user_id == user_id, Role.name == "SYSTEM_ADMIN"))
    return result.scalars().first() is not None


def _audit(*, actor_id: UUID | None, action: str, target_type: str, target_id: UUID | None, outcome: AuditOutcome = AuditOutcome.SUCCEEDED, metadata: dict | None = None) -> AuditEvent:
    return AuditEvent(actor_user_id=actor_id, actor_type=ActorType.USER if actor_id else ActorType.SYSTEM, action=action, target_type=target_type, target_id=target_id, channel=BookingSource.WEB, outcome=outcome, event_metadata=metadata or {})


def _notify(*, user_id: UUID, title: str, body: str, ntype: NotificationType) -> Notification:
    return Notification(user_id=user_id, type=ntype, channel=NotificationChannel.IN_APP, title=title, body=body, delivery_status=DeliveryStatus.PENDING)


async def _provider_owner_user_id(session: AsyncSession, provider_id: UUID | None) -> UUID | None:
    if provider_id is None:
        return None
    return await session.scalar(select(ServiceProvider.owner_user_id).where(ServiceProvider.id == provider_id))


async def list_providers(session: AsyncSession, *, include_pending_for_admin: bool = False) -> list[ServiceProvider]:
    await _ensure_default_providers(session)
    stmt = select(ServiceProvider).order_by(ServiceProvider.name)
    if not include_pending_for_admin:
        stmt = stmt.where(ServiceProvider.status == ProviderStatus.ACTIVE)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def list_all_providers_admin(session: AsyncSession) -> list[ServiceProvider]:
    await _ensure_default_providers(session)
    result = await session.execute(select(ServiceProvider).order_by(ServiceProvider.created_at.desc()))
    return list(result.scalars().all())


async def create_provider(session: AsyncSession, *, data: ServiceProviderCreate, actor: User) -> ServiceProvider:
    slug = _slugify(data.slug or data.name)
    existing = await session.scalar(select(ServiceProvider.id).where(ServiceProvider.slug == slug))
    if existing:
        slug = f"{slug}-{hashlib.sha256(f'{data.name}{datetime.now(UTC).isoformat()}'.encode()).hexdigest()[:6]}"
    provider = ServiceProvider(
        slug=slug, name=data.name.strip(), category=data.category.strip(), description=(data.description or "").strip() or None,
        location=data.location.strip(), price_from_kes=data.price_from_kes, availability=data.availability, image_url=data.image_url,
        contact_email=str(data.contact_email) if data.contact_email else None, contact_phone=(data.contact_phone or "").strip() or None,
        owner_user_id=data.owner_user_id, status=data.status or ProviderStatus.PENDING,
    )
    session.add(provider)
    try:
        await session.flush()
        session.add(_audit(actor_id=actor.id, action="PROVIDER_CREATED", target_type="SERVICE_PROVIDER", target_id=provider.id, metadata={"name": provider.name, "status": provider.status.value}))
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ProviderError("Could not create provider (slug may already exist)") from exc
    await session.refresh(provider)
    return provider


async def update_provider(session: AsyncSession, *, provider_id: UUID, data: ServiceProviderUpdate, actor: User) -> ServiceProvider:
    provider = await session.get(ServiceProvider, provider_id)
    if provider is None:
        raise ProviderError("Service provider not found")
    if not await _is_admin(session, actor.id):
        # self-service: only own profile, cannot change owner/status
        if provider.owner_user_id != actor.id:
            raise ProviderAccessError("Not authorized to update this provider profile")
        if data.owner_user_id is not None or data.status is not None:
            raise ProviderAccessError("Only administrators can change provider ownership or approval status")
    changed = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "contact_email" and value is not None:
            value = str(value)
        changed[field] = value
        setattr(provider, field, value)
    provider.updated_at = datetime.now(UTC)
    session.add(_audit(actor_id=actor.id, action="PROVIDER_UPDATED", target_type="SERVICE_PROVIDER", target_id=provider.id, metadata={"changed": list(changed.keys())}))
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ProviderError("Could not update provider") from exc
    await session.refresh(provider)
    return provider


async def get_my_provider_profile(session: AsyncSession, *, user_id: UUID) -> ServiceProvider | None:
    return await session.scalar(select(ServiceProvider).where(ServiceProvider.owner_user_id == user_id).order_by(ServiceProvider.created_at.desc()))


async def create_service_request(session: AsyncSession, *, requester: User, data: ServiceRequestCreate, idempotency_key: str) -> ServiceRequest:
    if not idempotency_key or len(idempotency_key) > 160:
        raise ProviderError("Idempotency-Key must contain between 1 and 160 characters")
    request_hash = _request_hash(data)
    await session.rollback()
    async with session.begin():
        await session.refresh(requester)
        await require_active_organizer_membership(session, user=requester, detail="An active organizer membership is required to request campus services.")
        await lock_idempotency_key(session, requester.id, "create_service_request", idempotency_key)
        record = await session.scalar(select(IdempotencyKey).where(IdempotencyKey.user_id == requester.id, IdempotencyKey.operation == "create_service_request", IdempotencyKey.key == idempotency_key).with_for_update())
        if record is not None:
            if record.request_hash != request_hash:
                raise ProviderIdempotencyConflictError("The idempotency key was already used with a different request")
            request_id = _request_id_from_response(record.response_body)
            if request_id is None:
                raise ProviderIdempotencyConflictError("The idempotency key has no replayable result")
            request = await session.scalar(select(ServiceRequest).options(selectinload(ServiceRequest.provider), selectinload(ServiceRequest.assigned_provider)).where(ServiceRequest.id == request_id))
            if request is None:
                raise ProviderIdempotencyConflictError("The original service request no longer exists")
            return request

        provider = await session.scalar(select(ServiceProvider).where(ServiceProvider.id == data.provider_id, ServiceProvider.status == ProviderStatus.ACTIVE).with_for_update())
        if provider is None:
            raise ProviderError("Service provider not found or not active")
        request = ServiceRequest(provider_id=provider.id, provider=provider, requester_id=requester.id, event_name=data.event_name, requested_date=data.requested_date, notes=data.notes, status=ServiceRequestStatus.PENDING, active=True)
        session.add(request)
        await session.flush()
        session.add(IdempotencyKey(user_id=requester.id, operation="create_service_request", key=idempotency_key, request_hash=request_hash, response_code=201, response_body={"service_request_id": str(request.id)}, expires_at=datetime.now(UTC) + IDEMPOTENCY_RETENTION))
        session.add(_audit(actor_id=requester.id, action="SERVICE_REQUEST_CREATED", target_type="SERVICE_REQUEST", target_id=request.id, metadata={"provider_id": str(provider.id)}))
        if provider.owner_user_id:
            session.add(_notify(user_id=provider.owner_user_id, title="New service request", body=f"A new request for {provider.name}: {request.event_name}.", ntype=NotificationType.SERVICE_REQUEST_STATUS))
        await session.flush()
        return request


async def list_my_service_requests(session: AsyncSession, *, requester_id: UUID) -> list[ServiceRequest]:
    result = await session.execute(select(ServiceRequest).options(selectinload(ServiceRequest.provider), selectinload(ServiceRequest.assigned_provider)).where(ServiceRequest.requester_id == requester_id).order_by(ServiceRequest.created_at.desc()))
    return list(result.scalars().all())


async def list_service_requests_admin(session: AsyncSession) -> list[ServiceRequest]:
    result = await session.execute(select(ServiceRequest).options(selectinload(ServiceRequest.provider), selectinload(ServiceRequest.assigned_provider), selectinload(ServiceRequest.requester)).order_by(ServiceRequest.created_at.desc()).limit(300))
    return list(result.scalars().all())


async def assign_service_request(session: AsyncSession, *, request_id: UUID, assigned_provider_id: UUID | None, actor: User) -> ServiceRequest:
    request = await session.scalar(select(ServiceRequest).options(selectinload(ServiceRequest.provider), selectinload(ServiceRequest.assigned_provider), selectinload(ServiceRequest.requester)).where(ServiceRequest.id == request_id).with_for_update())
    if request is None:
        raise ProviderError("Service request not found")
    old_assignee = request.assigned_provider_id
    if assigned_provider_id is not None:
        provider = await session.get(ServiceProvider, assigned_provider_id)
        if provider is None or provider.status != ProviderStatus.ACTIVE:
            raise ProviderError("Assigned provider not found or not active")
        request.assigned_provider_id = assigned_provider_id
        request.assigned_at = datetime.now(UTC)
        request.assigned_by_user_id = actor.id
    else:
        request.assigned_provider_id = None
        request.assigned_at = None
        request.assigned_by_user_id = actor.id
    session.add(_audit(actor_id=actor.id, action="SERVICE_REQUEST_ASSIGNED", target_type="SERVICE_REQUEST", target_id=request.id, metadata={"assigned_provider_id": str(assigned_provider_id) if assigned_provider_id else None, "previous_assigned_provider_id": str(old_assignee) if old_assignee else None}))
    session.add(_notify(user_id=request.requester_id, title="Service request updated", body=f"Your request for {request.event_name} assignment was updated.", ntype=NotificationType.SERVICE_REQUEST_ASSIGNED))
    owner_id = await _provider_owner_user_id(session, assigned_provider_id)
    if owner_id:
        session.add(_notify(user_id=owner_id, title="Service request assigned", body=f"You were assigned a request: {request.event_name}.", ntype=NotificationType.SERVICE_REQUEST_ASSIGNED))
    await session.commit()
    await session.refresh(request)
    return request


async def get_provider_profile_for_user(session: AsyncSession, user_id: UUID) -> ServiceProvider | None:
    return await session.scalar(select(ServiceProvider).where(ServiceProvider.owner_user_id == user_id, ServiceProvider.status == ProviderStatus.ACTIVE))


async def list_assigned_service_requests(session: AsyncSession, *, user_id: UUID) -> list[ServiceRequest]:
    profile = await get_provider_profile_for_user(session, user_id)
    if profile is None:
        return []
    result = await session.execute(select(ServiceRequest).options(selectinload(ServiceRequest.provider), selectinload(ServiceRequest.assigned_provider), selectinload(ServiceRequest.requester)).where(ServiceRequest.assigned_provider_id == profile.id).order_by(ServiceRequest.created_at.desc()))
    return list(result.scalars().all())


async def update_assigned_service_request_status(session: AsyncSession, *, request_id: UUID, user_id: UUID, new_status: ServiceRequestStatus) -> ServiceRequest:
    profile = await get_provider_profile_for_user(session, user_id)
    if profile is None:
        raise ProviderAccessError("No approved provider profile is assigned to this account")
    request = await session.scalar(select(ServiceRequest).options(selectinload(ServiceRequest.provider), selectinload(ServiceRequest.assigned_provider), selectinload(ServiceRequest.requester)).where(ServiceRequest.id == request_id, ServiceRequest.assigned_provider_id == profile.id).with_for_update())
    if request is None:
        raise ProviderAccessError("Service request not found or not assigned to you")
    allowed = PROVIDER_TRANSITIONS.get(request.status, set())
    if new_status not in allowed:
        raise ProviderError(f"Cannot change status from {request.status} to {new_status}")
    request.status = new_status
    request.active = new_status != ServiceRequestStatus.CANCELLED
    request.cancelled_at = datetime.now(UTC) if new_status == ServiceRequestStatus.CANCELLED else None
    session.add(_audit(actor_id=user_id, action="SERVICE_REQUEST_STATUS_UPDATED", target_type="SERVICE_REQUEST", target_id=request.id, metadata={"status": new_status.value, "provider_id": str(profile.id)}))
    session.add(_notify(user_id=request.requester_id, title="Service request status updated", body=f"{request.event_name} is now {new_status.value}.", ntype=NotificationType.SERVICE_REQUEST_STATUS if new_status != ServiceRequestStatus.CANCELLED else NotificationType.SERVICE_REQUEST_CANCELLED))
    await session.commit()
    await session.refresh(request)
    return request


async def quote_service_request(session: AsyncSession, *, request_id: UUID, user_id: UUID, data: ServiceRequestQuote) -> ServiceRequest:
    profile = await get_provider_profile_for_user(session, user_id)
    if profile is None:
        raise ProviderAccessError("No approved provider profile is assigned to this account")
    request = await session.scalar(select(ServiceRequest).options(selectinload(ServiceRequest.provider), selectinload(ServiceRequest.assigned_provider), selectinload(ServiceRequest.requester)).where(ServiceRequest.id == request_id, ServiceRequest.assigned_provider_id == profile.id).with_for_update())
    if request is None:
        raise ProviderAccessError("Service request not found or not assigned to you")
    if request.status in {ServiceRequestStatus.CANCELLED, ServiceRequestStatus.COMPLETED}:
        raise ProviderError("Cannot quote a completed or cancelled request")
    request.quote_amount_kes = data.quote_amount_kes
    request.quote_notes = (data.quote_notes or "").strip() or None
    request.quoted_at = datetime.now(UTC)
    request.quoted_by_provider_id = profile.id
    session.add(_audit(actor_id=user_id, action="SERVICE_REQUEST_QUOTED", target_type="SERVICE_REQUEST", target_id=request.id, metadata={"amount_kes": data.quote_amount_kes}))
    session.add(_notify(user_id=request.requester_id, title="Service quote received", body=f"{profile.name} sent a quote for {request.event_name}.", ntype=NotificationType.SERVICE_REQUEST_QUOTED))
    await session.commit()
    await session.refresh(request)
    return request


async def cancel_my_service_request(session: AsyncSession, *, request_id: UUID, requester: User) -> ServiceRequest:
    request = await session.scalar(select(ServiceRequest).options(selectinload(ServiceRequest.provider), selectinload(ServiceRequest.assigned_provider), selectinload(ServiceRequest.requester)).where(ServiceRequest.id == request_id, ServiceRequest.requester_id == requester.id).with_for_update())
    if request is None:
        raise ProviderAccessError("Service request not found")
    if request.status == ServiceRequestStatus.CANCELLED:
        return request
    if request.status == ServiceRequestStatus.COMPLETED:
        raise ProviderError("Completed requests cannot be cancelled")
    request.status = ServiceRequestStatus.CANCELLED
    request.active = False
    request.cancelled_at = datetime.now(UTC)
    session.add(_audit(actor_id=requester.id, action="SERVICE_REQUEST_CANCELLED", target_type="SERVICE_REQUEST", target_id=request.id))
    owner_id = await _provider_owner_user_id(session, request.assigned_provider_id)
    if owner_id:
        session.add(_notify(user_id=owner_id, title="Service request cancelled", body=f"The requester cancelled {request.event_name}.", ntype=NotificationType.SERVICE_REQUEST_CANCELLED))
    await session.commit()
    await session.refresh(request)
    return request


async def admin_update_service_request(session: AsyncSession, *, request_id: UUID, actor: User, status: ServiceRequestStatus | None = None) -> ServiceRequest:
    request = await session.scalar(select(ServiceRequest).options(selectinload(ServiceRequest.provider), selectinload(ServiceRequest.assigned_provider), selectinload(ServiceRequest.requester)).where(ServiceRequest.id == request_id).with_for_update())
    if request is None:
        raise ProviderError("Service request not found")
    if status is not None and status != request.status:
        request.status = status
        request.active = status != ServiceRequestStatus.CANCELLED
        request.cancelled_at = datetime.now(UTC) if status == ServiceRequestStatus.CANCELLED else request.cancelled_at
        session.add(_audit(actor_id=actor.id, action="SERVICE_REQUEST_ADMIN_STATUS", target_type="SERVICE_REQUEST", target_id=request.id, metadata={"status": status.value}))
        session.add(_notify(user_id=request.requester_id, title="Service request updated by admin", body=f"{request.event_name} is now {status.value}.", ntype=NotificationType.SERVICE_REQUEST_STATUS))
        owner_id = await _provider_owner_user_id(session, request.assigned_provider_id)
        if owner_id:
            session.add(_notify(user_id=owner_id, title="Assigned request updated", body=f"{request.event_name} is now {status.value}.", ntype=NotificationType.SERVICE_REQUEST_STATUS))
    await session.commit()
    await session.refresh(request)
    return request


async def _ensure_default_providers(session: AsyncSession) -> None:
    count = await session.scalar(select(ServiceProvider.id).limit(1))
    if count:
        return
    for row in DEFAULT_PROVIDERS:
        session.add(ServiceProvider(**row, status=ProviderStatus.ACTIVE))
    await session.commit()


def _request_hash(data: ServiceRequestCreate) -> str:
    return hashlib.sha256(json.dumps(data.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _request_id_from_response(response_body: dict[str, object] | None) -> UUID | None:
    value = response_body.get("service_request_id") if response_body else None
    if not isinstance(value, str):
        return None
    try:
        return UUID(value)
    except ValueError:
        return None
