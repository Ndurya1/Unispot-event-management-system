"""Add service providers and confirmed service requests.

Revision ID: 20261105_0014
Revises: 20261105_0013
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261105_0014"
down_revision: str | Sequence[str] | None = "20261105_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> None:
    sa.Enum(*values, name=name).create(op.get_bind(), checkfirst=True)


def upgrade() -> None:
    _enum("provider_status", "ACTIVE", "INACTIVE")
    _enum("service_request_status", "CONFIRMED", "CANCELLED")

    op.create_table(
        "service_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location", sa.String(length=160), nullable=False, server_default="Main Campus"),
        sa.Column("price_from_kes", sa.Integer(), nullable=False),
        sa.Column("rating", sa.String(length=10), nullable=False, server_default="4.5"),
        sa.Column("reviews", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("availability", sa.String(length=40), nullable=False, server_default="week"),
        sa.Column("image_url", sa.String(length=255), nullable=True),
        sa.Column("status", postgresql.ENUM(name="provider_status", create_type=False), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_service_providers"),
        sa.UniqueConstraint("slug", name="uq_service_providers_slug"),
        sa.CheckConstraint("price_from_kes >= 0", name="ck_service_providers_price_non_negative"),
    )

    op.create_table(
        "service_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_name", sa.String(length=200), nullable=False),
        sa.Column("requested_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", postgresql.ENUM(name="service_request_status", create_type=False), nullable=False, server_default="CONFIRMED"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("confirmation_code", sa.String(length=24), nullable=False, server_default=sa.text("upper(substr(md5(random()::text), 1, 12))")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["provider_id"], ["service_providers.id"], name="fk_service_requests_provider_id_service_providers", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], name="fk_service_requests_requester_id_users", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_service_requests"),
        sa.UniqueConstraint("confirmation_code", name="uq_service_requests_confirmation_code"),
        sa.CheckConstraint("(active = true AND status = 'CONFIRMED' AND cancelled_at IS NULL) OR (active = false AND status = 'CANCELLED' AND cancelled_at IS NOT NULL)", name="ck_service_requests_state_consistent"),
    )
    op.create_index("ix_service_requests_requester_created_at", "service_requests", ["requester_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_service_requests_requester_created_at", table_name="service_requests")
    op.drop_table("service_requests")
    op.drop_table("service_providers")
    sa.Enum(name="service_request_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="provider_status").drop(op.get_bind(), checkfirst=True)
