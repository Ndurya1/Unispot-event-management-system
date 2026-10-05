"""Add the M2 venue catalogue and occupancy primitives.

Revision ID: 20261005_0003
Revises: 20261002_0002
"""
# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261005_0003"
down_revision: str | Sequence[str] | None = "20261002_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> None:
    sa.Enum(*values, name=name).create(op.get_bind(), checkfirst=True)


def upgrade() -> None:
    _enum("venue_status", "ACTIVE", "INACTIVE", "MAINTENANCE")
    _enum("reservation_type", "BOOKING", "BLOCK")
    _enum("block_status", "ACTIVE", "CANCELLED")
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "venues",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", postgresql.ENUM(name="venue_status", create_type=False), nullable=False, server_default="ACTIVE"),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Africa/Nairobi"),
        sa.Column("booking_buffer_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_venues"),
        sa.UniqueConstraint("name", name="uq_venues_name"),
        sa.UniqueConstraint("code", name="uq_venues_code"),
        sa.CheckConstraint("capacity > 0", name="ck_venues_capacity_positive"),
        sa.CheckConstraint("booking_buffer_minutes >= 0", name="ck_venues_buffer_nonnegative"),
    )
    op.create_table(
        "facilities",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_facilities"),
        sa.UniqueConstraint("name", name="uq_facilities_name"),
    )
    op.create_table(
        "venue_facilities",
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("facility_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["facility_id"], ["facilities.id"], name="fk_venue_facilities_facility_id_facilities", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], name="fk_venue_facilities_venue_id_venues", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("venue_id", "facility_id", name="pk_venue_facilities"),
    )
    op.create_table(
        "venue_operating_hours",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column("opens_at", sa.Time(), nullable=False),
        sa.Column("closes_at", sa.Time(), nullable=False),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], name="fk_venue_operating_hours_venue_id_venues", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_venue_operating_hours"),
        sa.UniqueConstraint("venue_id", "day_of_week", name="uq_venue_operating_hours_venue_id"),
        sa.CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_venue_operating_hours_day_of_week_valid"),
        sa.CheckConstraint("closes_at > opens_at", name="ck_venue_operating_hours_hours_ordered"),
    )
    op.create_table(
        "venue_reservations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reservation_type", postgresql.ENUM(name="reservation_type", create_type=False), nullable=False),
        sa.Column("occupied_range", postgresql.TSTZRANGE(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], name="fk_venue_reservations_venue_id_venues", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_venue_reservations"),
        sa.CheckConstraint("NOT isempty(occupied_range)", name="ck_venue_reservations_range_nonempty"),
    )
    op.create_index(
        "ix_venue_reservations_venue_id_active",
        "venue_reservations",
        ["venue_id", "active"],
    )
    op.execute(
        """ALTER TABLE venue_reservations ADD CONSTRAINT ex_venue_reservation_time
        EXCLUDE USING gist (venue_id WITH =, occupied_range WITH &&) WHERE (active)"""
    )
    op.create_table(
        "venue_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("reservation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("status", postgresql.ENUM(name="block_status", create_type=False), nullable=False, server_default="ACTIVE"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_venue_blocks_created_by_users", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reservation_id"], ["venue_reservations.id"], name="fk_venue_blocks_reservation_id_venue_reservations", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], name="fk_venue_blocks_venue_id_venues", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_venue_blocks"),
        sa.UniqueConstraint("reservation_id", name="uq_venue_blocks_reservation_id"),
        sa.CheckConstraint("ends_at > starts_at", name="ck_venue_blocks_time_ordered"),
    )
    op.create_index("ix_venue_blocks_venue_id_status", "venue_blocks", ["venue_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_venue_blocks_venue_id_status", table_name="venue_blocks")
    op.drop_table("venue_blocks")
    op.execute(
        "ALTER TABLE venue_reservations DROP CONSTRAINT ex_venue_reservation_time"
    )
    op.drop_index("ix_venue_reservations_venue_id_active", table_name="venue_reservations")
    op.drop_table("venue_reservations")
    op.drop_table("venue_operating_hours")
    op.drop_table("venue_facilities")
    op.drop_table("facilities")
    op.drop_table("venues")
    sa.Enum(name="block_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="reservation_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="venue_status").drop(op.get_bind(), checkfirst=True)
