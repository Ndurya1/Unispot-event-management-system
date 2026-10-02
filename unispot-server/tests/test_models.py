from typing import cast

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Table

from app.models import (
    Organization,
    OrganizationMembership,
    Role,
    User,
    UserRoles,
)


def test_identity_models_match_documented_table_names() -> None:
    assert set(User.__table__.columns.keys()) == {
        "id",
        "full_name",
        "email",
        "password_hash",
        "status",
        "created_at",
        "updated_at",
        "last_login_at",
    }
    assert set(Role.__table__.columns.keys()) == {"id", "name"}
    assert set(UserRoles.__table__.columns.keys()) == {
        "user_id",
        "role_id",
        "assigned_at",
    }
    assert set(Organization.__table__.columns.keys()) == {
        "id",
        "name",
        "slug",
        "organization_type",
        "status",
        "created_at",
        "updated_at",
    }
    assert set(OrganizationMembership.__table__.columns.keys()) == {
        "id",
        "user_id",
        "organization_id",
        "membership_role",
        "status",
        "joined_at",
    }


def test_memberships_prevent_duplicate_user_organization_pairs() -> None:
    membership_table = cast(Table, OrganizationMembership.__table__)
    constraint_names = {
        constraint.name for constraint in membership_table.constraints
    }

    assert "uq_organization_memberships_user_id_organization_id" in constraint_names


def test_identity_enum_names_match_database_contract() -> None:
    assert cast(SQLEnum, User.__table__.c.status.type).name == "user_status"
    assert (
        cast(SQLEnum, Organization.__table__.c.organization_type.type).name
        == "organization_type"
    )
    assert cast(SQLEnum, Organization.__table__.c.status.type).name == "organization_status"
    assert (
        cast(SQLEnum, OrganizationMembership.__table__.c.membership_role.type).name
        == "membership_role"
    )
    assert (
        cast(SQLEnum, OrganizationMembership.__table__.c.status.type).name
        == "membership_status"
    )


def test_membership_references_restrict_parent_deletion() -> None:
    user_foreign_key = next(iter(OrganizationMembership.__table__.c.user_id.foreign_keys))
    organization_foreign_key = next(
        iter(OrganizationMembership.__table__.c.organization_id.foreign_keys)
    )

    assert user_foreign_key.ondelete == "RESTRICT"
    assert organization_foreign_key.ondelete == "RESTRICT"
