"""create initial database structure

Revision ID: 21f64b3b1812
Revises:
Create Date: 2026-10-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "21f64b3b1812"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ============================================================
    # EXTENSIONS
    # ============================================================

    op.execute('CREATE EXTENSION IF NOT EXISTS "citext"')


    # ============================================================
    # ENUM TYPES
    # ============================================================

    op.execute("""
        CREATE TYPE userstatus AS ENUM (
            'ACTIVE',
            'SUSPENDED',
            'DISABLED'
        )
    """)

    op.execute("""
        CREATE TYPE organizationtype AS ENUM (
            'CLUB',
            'ASSOCIATION',
            'DEPARTMENT',
            'OTHER'
        )
    """)

    op.execute("""
        CREATE TYPE organisationstatus AS ENUM (
            'ACTIVE',
            'INACTIVE'
        )
    """)

    op.execute("""
        CREATE TYPE membershiprole AS ENUM (
            'MEMBER',
            'ORGANIZER'
        )
    """)

    op.execute("""
        CREATE TYPE membershipstatus AS ENUM (
            'ACTIVE',
            'INACTIVE'
        )
    """)


    # ============================================================
    # USERS
    # ============================================================

    op.create_table(
        "users",

        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False
        ),

        sa.Column(
            "full_name",
            sa.String(160),
            nullable=False
        ),

        sa.Column(
            "email",
            postgresql.CITEXT(),
            nullable=False
        ),

        sa.Column(
            "password_hash",
            sa.String(),
            nullable=True
        ),

        sa.Column(
            "status",
            postgresql.ENUM(
                "ACTIVE",
                "SUSPENDED",
                "DISABLED",
                name="userstatus",
                create_type=False
            ),
            nullable=False
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),

        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=True
        ),

        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )


    # ============================================================
    # ROLES
    # ============================================================

    op.create_table(
        "roles",

        sa.Column(
            "role_id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False
        ),

        sa.Column(
            "role_name",
            sa.String(80),
            nullable=False
        ),

        sa.PrimaryKeyConstraint("role_id"),
        sa.UniqueConstraint("role_name"),
    )


    # ============================================================
    # USER ROLES
    # ============================================================

    op.create_table(
        "user_roles",

        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False
        ),

        sa.Column(
            "user_role",
            postgresql.UUID(as_uuid=True),
            nullable=False
        ),

        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),

        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE"
        ),

        sa.ForeignKeyConstraint(
            ["user_role"],
            ["roles.role_id"],
            ondelete="CASCADE"
        ),

        sa.PrimaryKeyConstraint(
            "user_id",
            "user_role"
        ),
    )


    # ============================================================
    # ORGANIZATIONS
    # ============================================================

    op.create_table(
        "organizations",

        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False
        ),

        sa.Column(
            "name",
            sa.String(180),
            nullable=False
        ),

        sa.Column(
            "slung",
            sa.String(180),
            nullable=False
        ),

        sa.Column(
            "organization_type",
            postgresql.ENUM(
                "CLUB",
                "ASSOCIATION",
                "DEPARTMENT",
                "OTHER",
                name="organizationtype",
                create_type=False
            ),
            nullable=False
        ),

        sa.Column(
            "status",
            postgresql.ENUM(
                "ACTIVE",
                "INACTIVE",
                name="organisationstatus",
                create_type=False
            ),
            nullable=False
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),

        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slung"),
    )


    # ============================================================
    # ORGANIZATION MEMBERSHIP
    # ============================================================

    op.create_table(
        "organization_membership",

        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False
        ),

        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False
        ),

        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            nullable=False
        ),

        sa.Column(
            "membership_role",
            postgresql.ENUM(
                "MEMBER",
                "ORGANIZER",
                name="membershiprole",
                create_type=False
            ),
            nullable=False
        ),

        sa.Column(
            "status",
            postgresql.ENUM(
                "ACTIVE",
                "INACTIVE",
                name="membershipstatus",
                create_type=False
            ),
            nullable=False
        ),

        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),

        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE"
        ),

        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE"
        ),

        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:

    op.drop_table("organization_membership")
    op.drop_table("organizations")
    op.drop_table("user_roles")
    op.drop_table("roles")
    op.drop_table("users")

    op.execute("DROP TYPE membershipstatus")
    op.execute("DROP TYPE membershiprole")
    op.execute("DROP TYPE organisationstatus")
    op.execute("DROP TYPE organizationtype")
    op.execute("DROP TYPE userstatus")