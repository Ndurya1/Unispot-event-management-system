from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization, OrganizationStatus, OrganizationType
from app.models.organization_membership import (
    MembershipRole,
    MembershipStatus,
    OrganizationMembership,
)
from app.models.user import User


async def create_organization(
    session: AsyncSession,
    name: str,
    slug: str,
    organization_type: OrganizationType,
) -> Organization:
    organization = Organization(
        name=name,
        slug=slug,
        organization_type=organization_type,
        status=OrganizationStatus.ACTIVE,
    )

    session.add(organization)

    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Organization already exists") from error

    await session.refresh(organization)
    return organization


async def list_organizations(
    session: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[Organization]:
    result = await session.execute(
        select(Organization).order_by(Organization.name).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def update_organization(
    session: AsyncSession,
    organization_id: UUID,
    name: str | None = None,
    slug: str | None = None,
    organization_type: OrganizationType | None = None,
    status: OrganizationStatus | None = None,
) -> Organization:
    result = await session.execute(select(Organization).where(Organization.id == organization_id))
    organization = result.scalar_one_or_none()

    if organization is None:
        raise ValueError("Organization not found")

    if name is not None:
        organization.name = name
    if slug is not None:
        organization.slug = slug
    if organization_type is not None:
        organization.organization_type = organization_type
    if status is not None:
        organization.status = status

    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Organization already exists") from error

    await session.refresh(organization)
    return organization


async def assign_membership(
    session: AsyncSession,
    user_id: UUID,
    organization_id: UUID,
    membership_role: MembershipRole,
) -> OrganizationMembership:
    user = await session.get(User, user_id)
    organization = await session.get(Organization, organization_id)

    if user is None:
        raise ValueError("User not found")

    if organization is None:
        raise ValueError("Organization not found")

    existing = await session.execute(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.organization_id == organization_id,
        )
    )

    if existing.scalar_one_or_none() is not None:
        raise ValueError("User is already a member of this organization")

    membership = OrganizationMembership(
        user_id=user_id,
        organization_id=organization_id,
        membership_role=membership_role,
        status=MembershipStatus.ACTIVE,
    )

    session.add(membership)

    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ValueError("Membership already exists") from error

    await session.refresh(membership)
    return membership


async def deactivate_membership(
    session: AsyncSession,
    membership_id: UUID,
) -> OrganizationMembership:
    membership = await session.get(
        OrganizationMembership,
        membership_id,
    )

    if membership is None:
        raise ValueError("Membership not found")

    membership.status = MembershipStatus.INACTIVE

    await session.commit()
    await session.refresh(membership)

    return membership
