"""Add M3 automated booking persistence and idempotency.

Revision ID: 20261005_0004
Revises: 20261005_0003
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261005_0004"
down_revision: str | Sequence[str] | None = "20261005_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> None:
    sa.Enum(*values, name=name).create(op.get_bind(), checkfirst=True)


def upgrade() -> None:
    _enum("booking_status", "CONFIRMED", "CANCELLED", "COMPLETED")
    _enum("booking_source", "WEB", "ASSISTANT", "SYSTEM")
    _enum("booking_event_type", "CREATED", "CONFIRMED", "CANCELLED", "COMPLETED")

    op.create_table(
        "bookings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reservation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_name", sa.String(length=200), nullable=False),
        sa.Column("event_description", sa.Text(), nullable=True),
        sa.Column("expected_attendance", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "occupied_range",
            postgresql.TSTZRANGE(),
            sa.Computed("tstzrange(starts_at, ends_at, '[)')", persisted=True),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(name="booking_status", create_type=False),
            nullable=False,
            server_default="CONFIRMED",
        ),
        sa.Column(
            "source",
            postgresql.ENUM(name="booking_source", create_type=False),
            nullable=False,
            server_default="WEB",
        ),
        sa.Column("confirmation_code", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancellation_reason", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name="fk_bookings_organization_id_organizations", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], name="fk_bookings_requester_id_users", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reservation_id"], ["venue_reservations.id"], name="fk_bookings_reservation_id_venue_reservations", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], name="fk_bookings_venue_id_venues", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_bookings"),
        sa.UniqueConstraint("confirmation_code", name="uq_bookings_confirmation_code"),
        sa.UniqueConstraint("reservation_id", name="uq_bookings_reservation_id"),
        sa.CheckConstraint("expected_attendance > 0", name="ck_bookings_attendance_positive"),
        sa.CheckConstraint("ends_at > starts_at", name="ck_bookings_time_ordered"),
        sa.CheckConstraint(
            "(status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR "
            "(status <> 'CANCELLED' AND cancelled_at IS NULL)",
            name="ck_bookings_cancelled_at_consistent",
        ),
    )
    op.create_index("ix_bookings_requester_starts_at", "bookings", ["requester_id", "starts_at"])
    op.create_index("ix_bookings_organization_starts_at", "bookings", ["organization_id", "starts_at"])

    op.create_table(
        "booking_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "event_type",
            postgresql.ENUM(name="booking_event_type", create_type=False),
            nullable=False,
        ),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "source",
            postgresql.ENUM(name="booking_source", create_type=False),
            nullable=False,
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], name="fk_booking_events_actor_user_id_users", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], name="fk_booking_events_booking_id_bookings", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_booking_events"),
    )
    op.create_index("ix_booking_events_booking_created_at", "booking_events", ["booking_id", "created_at"])

    op.create_table(
        "idempotency_keys",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("operation", sa.String(length=80), nullable=False),
        sa.Column("key", sa.String(length=160), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_code", sa.Integer(), nullable=True),
        sa.Column("response_body", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_idempotency_keys_user_id_users", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_idempotency_keys"),
        sa.UniqueConstraint("user_id", "operation", "key", name="uq_idempotency_keys_user_id"),
    )
    op.create_index("ix_idempotency_keys_expires_at", "idempotency_keys", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_idempotency_keys_expires_at", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")
    op.drop_index("ix_booking_events_booking_created_at", table_name="booking_events")
    op.drop_table("booking_events")
    op.drop_index("ix_bookings_organization_starts_at", table_name="bookings")
    op.drop_index("ix_bookings_requester_starts_at", table_name="bookings")
    op.drop_table("bookings")
    sa.Enum(name="booking_event_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="booking_source").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="booking_status").drop(op.get_bind(), checkfirst=True)
