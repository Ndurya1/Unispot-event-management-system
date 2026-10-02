"""Align the M1 identity schema with the documented database contract.

Revision ID: 20261002_0002
Revises: 21f64b3b1812
Create Date: 2026-10-02
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261002_0002"
down_revision: str | Sequence[str] | None = "21f64b3b1812"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.rename_table("organization_membership", "organization_memberships")
    op.alter_column("organizations", "slung", new_column_name="slug")

    op.alter_column("roles", "role_id", new_column_name="id")
    op.alter_column("roles", "role_name", new_column_name="name")
    op.alter_column("user_roles", "user_role", new_column_name="role_id")

    op.execute("ALTER TYPE userstatus RENAME TO user_status")
    op.execute("ALTER TYPE organizationtype RENAME TO organization_type")
    op.execute("ALTER TYPE organisationstatus RENAME TO organization_status")
    op.execute("ALTER TYPE membershiprole RENAME TO membership_role")
    op.execute("ALTER TYPE membershipstatus RENAME TO membership_status")

    op.execute(
        "ALTER TABLE roles RENAME CONSTRAINT uq_roles_role_name TO uq_roles_name"
    )
    op.execute(
        "ALTER TABLE organizations RENAME CONSTRAINT uq_organizations_slung "
        "TO uq_organizations_slug"
    )
    op.execute(
        "ALTER TABLE user_roles RENAME CONSTRAINT fk_user_roles_user_role_roles "
        "TO fk_user_roles_role_id_roles"
    )
    op.execute(
        "ALTER TABLE organization_memberships RENAME CONSTRAINT pk_organization_membership "
        "TO pk_organization_memberships"
    )
    op.execute(
        "ALTER TABLE organization_memberships RENAME CONSTRAINT "
        "fk_organization_membership_user_id_users "
        "TO fk_organization_memberships_user_id_users"
    )
    op.execute(
        "ALTER TABLE organization_memberships RENAME CONSTRAINT "
        "fk_organization_membership_organization_id_organizations "
        "TO fk_organization_memberships_organization_id_organizations"
    )

    op.drop_constraint(
        "fk_organization_memberships_user_id_users",
        "organization_memberships",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_organization_memberships_organization_id_organizations",
        "organization_memberships",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "fk_organization_memberships_user_id_users",
        "organization_memberships",
        "users",
        ["user_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_organization_memberships_organization_id_organizations",
        "organization_memberships",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_unique_constraint(
        "uq_organization_memberships_user_id_organization_id",
        "organization_memberships",
        ["user_id", "organization_id"],
    )

    op.execute(
        """
        INSERT INTO roles (id, name)
        VALUES
            (gen_random_uuid(), 'ORGANIZER'),
            (gen_random_uuid(), 'VENUE_ADMIN'),
            (gen_random_uuid(), 'SYSTEM_ADMIN')
        ON CONFLICT (name) DO NOTHING
        """
    )


def downgrade() -> None:
    # Seeded roles are retained on downgrade because they may predate this
    # migration or already be referenced by user_roles rows.

    op.drop_constraint(
        "uq_organization_memberships_user_id_organization_id",
        "organization_memberships",
        type_="unique",
    )

    op.drop_constraint(
        "fk_organization_memberships_user_id_users",
        "organization_memberships",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_organization_memberships_organization_id_organizations",
        "organization_memberships",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "fk_organization_memberships_user_id_users",
        "organization_memberships",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_organization_memberships_organization_id_organizations",
        "organization_memberships",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        "ALTER TABLE organization_memberships RENAME CONSTRAINT "
        "fk_organization_memberships_organization_id_organizations "
        "TO fk_organization_membership_organization_id_organizations"
    )
    op.execute(
        "ALTER TABLE organization_memberships RENAME CONSTRAINT "
        "fk_organization_memberships_user_id_users "
        "TO fk_organization_membership_user_id_users"
    )
    op.execute(
        "ALTER TABLE organization_memberships RENAME CONSTRAINT pk_organization_memberships "
        "TO pk_organization_membership"
    )
    op.execute(
        "ALTER TABLE user_roles RENAME CONSTRAINT fk_user_roles_role_id_roles "
        "TO fk_user_roles_user_role_roles"
    )
    op.execute(
        "ALTER TABLE organizations RENAME CONSTRAINT uq_organizations_slug "
        "TO uq_organizations_slung"
    )
    op.execute(
        "ALTER TABLE roles RENAME CONSTRAINT uq_roles_name TO uq_roles_role_name"
    )

    op.execute("ALTER TYPE membership_status RENAME TO membershipstatus")
    op.execute("ALTER TYPE membership_role RENAME TO membershiprole")
    op.execute("ALTER TYPE organization_status RENAME TO organisationstatus")
    op.execute("ALTER TYPE organization_type RENAME TO organizationtype")
    op.execute("ALTER TYPE user_status RENAME TO userstatus")

    op.alter_column("user_roles", "role_id", new_column_name="user_role")
    op.alter_column("roles", "name", new_column_name="role_name")
    op.alter_column("roles", "id", new_column_name="role_id")
    op.alter_column("organizations", "slug", new_column_name="slung")
    op.rename_table("organization_memberships", "organization_membership")
