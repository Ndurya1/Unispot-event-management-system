"""Add equipment inventory and auto-confirmed reservations.

Revision ID: 20261105_0012
Revises: 20261101_0011
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261105_0012"
down_revision: str | Sequence[str] | None = "20261101_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> None:
    sa.Enum(*values, name=name).create(op.get_bind(), checkfirst=True)


def upgrade() -> None:
    _enum("equipment_status", "ACTIVE", "INACTIVE")
    _enum("equipment_reservation_status", "CONFIRMED", "CANCELLED")

    op.create_table(
        "equipment_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("total_quantity", sa.Integer(), nullable=False),
        sa.Column("status", postgresql.ENUM(name="equipment_status", create_type=False), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_equipment_items"),
        sa.UniqueConstraint("slug", name="uq_equipment_items_slug"),
        sa.CheckConstraint("total_quantity > 0", name="ck_equipment_items_total_positive"),
    )

    op.create_table(
        "equipment_reservations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("equipment_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.String(length=255), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "reserved_range",
            postgresql.TSTZRANGE(),
            sa.Computed("tstzrange(starts_at, ends_at, '[)')", persisted=True),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(name="equipment_reservation_status", create_type=False),
            nullable=False,
            server_default="CONFIRMED",
        ),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "confirmation_code",
            sa.String(length=24),
            nullable=False,
            server_default=sa.text("upper(substr(md5(random()::text), 1, 12))"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancellation_reason", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["equipment_item_id"], ["equipment_items.id"], name="fk_equipment_reservations_equipment_item_id_equipment_items", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], name="fk_equipment_reservations_requester_id_users", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_equipment_reservations_organization_id_organizations", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_equipment_reservations"),
        sa.UniqueConstraint("confirmation_code", name="uq_equipment_reservations_confirmation_code"),
        sa.CheckConstraint("quantity > 0", name="ck_equipment_reservations_quantity_positive"),
        sa.CheckConstraint("ends_at > starts_at", name="ck_equipment_reservations_time_ordered"),
        sa.CheckConstraint(
            "(active = true AND status = 'CONFIRMED' AND cancelled_at IS NULL) OR "
            "(active = false AND status = 'CANCELLED' AND cancelled_at IS NOT NULL)",
            name="ck_equipment_reservations_state_consistent",
        ),
    )
    op.create_index("ix_equipment_reservations_item_active_range", "equipment_reservations", ["equipment_item_id", "active"])
    op.create_index("ix_equipment_reservations_requester_starts_at", "equipment_reservations", ["requester_id", "starts_at"])


def downgrade() -> None:
    op.drop_index("ix_equipment_reservations_requester_starts_at", table_name="equipment_reservations")
    op.drop_index("ix_equipment_reservations_item_active_range", table_name="equipment_reservations")
    op.drop_table("equipment_reservations")
    op.drop_table("equipment_items")
    sa.Enum(name="equipment_reservation_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="equipment_status").drop(op.get_bind(), checkfirst=True)
