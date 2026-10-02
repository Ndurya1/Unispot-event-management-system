from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_system_admin
from app.api.dependencies.database import get_db
from app.schemas.organization import (
    MembershipCreate,
    MembershipResponse,
    OrganizationCreate,
    OrganizationResponse,
)
from app.services.organization_service import (
    assign_membership,
    create_organization,
    deactivate_membership,
    list_organizations,
    update_organization,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create(
    data: OrganizationCreate,
    session: AsyncSession = Depends(get_db),  # noqa: B008
    _: object = Depends(require_system_admin),  # noqa: B008
):
    try:
        return await create_organization(
            session,
            data.name,
            data.slug,
            data.organization_type,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error


@router.get("", response_model=list[OrganizationResponse])
async def list_all(
    session: AsyncSession = Depends(get_db),  # noqa: B008
    _: object = Depends(require_system_admin),  # noqa: B008
):
    return await list_organizations(session)


@router.patch(
    "/{organization_id}",
    response_model=OrganizationResponse,
)
async def update(
    organization_id: UUID,
    data: OrganizationCreate,
    session: AsyncSession = Depends(get_db),  # noqa: B008
    _: object = Depends(require_system_admin),  # noqa: B008
):
    try:
        return await update_organization(
            session,
            organization_id,
            data.name,
            data.slug,
            data.organization_type,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error


@router.post(
    "/{organization_id}/members",
    response_model=MembershipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    organization_id: UUID,
    data: MembershipCreate,
    session: AsyncSession = Depends(get_db),  # noqa: B008
    _: object = Depends(require_system_admin),  # noqa: B008
):
    try:
        return await assign_membership(
            session,
            data.user_id,
            organization_id,
            data.membership_role,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.patch(
    "/members/{membership_id}/deactivate",
    response_model=MembershipResponse,
)
async def deactivate_member(
    membership_id: UUID,
    session: AsyncSession = Depends(get_db),  # noqa: B008
    _: object = Depends(require_system_admin),  # noqa: B008
):
    try:
        return await deactivate_membership(
            session,
            membership_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error
