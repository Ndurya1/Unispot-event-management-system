from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user, require_system_admin
from app.api.dependencies.database import get_db
from app.models.user import User
from app.schemas.certificate import CertificateIssueRequest, CertificateResponse, CertificateVerifyResponse
from app.services import certificate_service

router = APIRouter(tags=["certificates"])


# Public verification endpoint: allows anyone with a code to verify authenticity.
@router.get("/certificates/verify/{verification_code}", response_model=CertificateVerifyResponse)
async def verify(verification_code: str, session: Annotated[AsyncSession, Depends(get_db)]):
    return await certificate_service.verify_certificate(session, verification_code=verification_code)


@router.get("/certificates/me", response_model=list[CertificateResponse])
async def mine(session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    return await certificate_service.list_my_certificates(session, user_id=current_user.id)


@router.post("/certificates/issue", response_model=CertificateResponse, status_code=201)
async def issue(data: CertificateIssueRequest, session: Annotated[AsyncSession, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    try:
        return await certificate_service.issue_certificate(session, registration_id=data.registration_id, template_name=data.template_name, actor=current_user)
    except certificate_service.CertificateError as e:
        code = 404 if "not found" in str(e).lower() else 403 if "authorized" in str(e).lower() else 400
        raise HTTPException(status_code=code, detail=str(e)) from e


@router.get("/admin/certificates", response_model=list[CertificateResponse])
async def admin_list(session: Annotated[AsyncSession, Depends(get_db)], _admin: Annotated[User, Depends(require_system_admin)], limit: int = Query(default=200, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    return await certificate_service.list_all_certificates(session, limit=limit, offset=offset)


@router.post("/admin/certificates/{certificate_id}/revoke", response_model=CertificateResponse)
async def revoke(certificate_id: UUID, session: Annotated[AsyncSession, Depends(get_db)], admin: Annotated[User, Depends(require_system_admin)], reason: str | None = Query(default=None)):
    try:
        return await certificate_service.revoke_certificate(session, certificate_id=certificate_id, actor=admin, reason=reason)
    except certificate_service.CertificateError as e:
        code = 404 if "not found" in str(e).lower() else 403
        raise HTTPException(status_code=code, detail=str(e)) from e
