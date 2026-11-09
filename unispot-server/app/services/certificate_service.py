import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import EventRegistration, EventRegistrationStatus
from app.models.operations import Certificate
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRoles


class CertificateError(ValueError):
    pass


async def _is_admin(session: AsyncSession, user_id: UUID) -> bool:
    result = await session.execute(select(Role.name).join(UserRoles, UserRoles.role_id == Role.id).where(UserRoles.user_id == user_id, Role.name == "SYSTEM_ADMIN"))
    return result.scalars().first() is not None


def _code() -> str:
    return "CERT-" + secrets.token_hex(6).upper()


def _response(cert: Certificate) -> dict:
    return {
        "id": cert.id, "verification_code": cert.verification_code, "user_id": cert.user_id,
        "registration_id": cert.registration_id, "event_id": cert.event_id, "recipient_name": cert.recipient_name,
        "event_title": cert.event_title, "template_name": cert.template_name, "issued_at": cert.issued_at,
        "issued_by_user_id": cert.issued_by_user_id, "revoked_at": cert.revoked_at, "revoke_reason": cert.revoke_reason,
        "is_valid": cert.revoked_at is None,
    }


async def issue_certificate(session: AsyncSession, *, registration_id: UUID, template_name: str, actor: User) -> dict:
    reg = await session.scalar(select(EventRegistration).options(selectinload(EventRegistration.event)).where(EventRegistration.id == registration_id))
    if reg is None:
        raise CertificateError("Registration not found")
    if reg.user_id != actor.id and not await _is_admin(session, actor.id):
        raise CertificateError("Not authorized to issue this certificate")
    if reg.status != EventRegistrationStatus.CONFIRMED:
        raise CertificateError("Only confirmed registrations can receive certificates")
    existing = await session.scalar(select(Certificate).where(Certificate.registration_id == registration_id))
    if existing is not None:
        return _response(existing)
    cert = Certificate(
        verification_code=_code(), user_id=reg.user_id, registration_id=reg.id, event_id=reg.event_id,
        recipient_name=reg.full_name, event_title=reg.event.title, template_name=template_name or "Campus Classic",
        issued_by_user_id=actor.id,
    )
    session.add(cert)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(select(Certificate).where(Certificate.registration_id == registration_id))
        if existing is not None:
            return _response(existing)
        raise
    await session.refresh(cert)
    return _response(cert)


async def list_my_certificates(session: AsyncSession, *, user_id: UUID) -> list[dict]:
    rows = list((await session.execute(select(Certificate).where(Certificate.user_id == user_id).order_by(Certificate.issued_at.desc()))).scalars().all())
    return [_response(r) for r in rows]


async def list_all_certificates(session: AsyncSession, *, limit: int = 200, offset: int = 0) -> list[dict]:
    rows = list((await session.execute(select(Certificate).order_by(Certificate.issued_at.desc()).limit(limit).offset(offset))).scalars().all())
    return [_response(r) for r in rows]


async def revoke_certificate(session: AsyncSession, *, certificate_id: UUID, actor: User, reason: str | None = None) -> dict:
    if not await _is_admin(session, actor.id):
        raise CertificateError("Not authorized")
    cert = await session.get(Certificate, certificate_id)
    if cert is None:
        raise CertificateError("Certificate not found")
    if cert.revoked_at is None:
        cert.revoked_at = datetime.now(UTC)
        cert.revoke_reason = (reason or "").strip() or None
        await session.commit()
        await session.refresh(cert)
    return _response(cert)


async def verify_certificate(session: AsyncSession, *, verification_code: str) -> dict:
    cert = await session.scalar(select(Certificate).where(Certificate.verification_code == verification_code.strip().upper()))
    if cert is None:
        return {"valid": False, "verification_code": verification_code, "recipient_name": None, "event_title": None, "template_name": None, "issued_at": None, "revoked_at": None, "message": "Certificate not found."}
    if cert.revoked_at is not None:
        return {"valid": False, "verification_code": cert.verification_code, "recipient_name": cert.recipient_name, "event_title": cert.event_title, "template_name": cert.template_name, "issued_at": cert.issued_at, "revoked_at": cert.revoked_at, "message": "Certificate has been revoked."}
    return {"valid": True, "verification_code": cert.verification_code, "recipient_name": cert.recipient_name, "event_title": cert.event_title, "template_name": cert.template_name, "issued_at": cert.issued_at, "revoked_at": None, "message": "Certificate is valid."}
