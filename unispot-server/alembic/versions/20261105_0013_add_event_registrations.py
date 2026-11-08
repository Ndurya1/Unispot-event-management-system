"""Add campus events and auto-confirmed registrations.

Revision ID: 20261105_0013
Revises: 20261105_0012
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261105_0013"
down_revision: str | Sequence[str] | None = "20261105_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> None:
    sa.Enum(*values, name=name).create(op.get_bind(), checkfirst=True)


def upgrade() -> None:
    _enum("event_status", "PUBLISHED", "CANCELLED")
    _enum("event_registration_status", "CONFIRMED", "CANCELLED")

    op.create_table(
        "campus_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("organizer", sa.String(length=160), nullable=True),
        sa.Column("location", sa.String(length=160), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("status", postgresql.ENUM(name="event_status", create_type=False), nullable=False, server_default="PUBLISHED"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_campus_events"),
        sa.UniqueConstraint("slug", name="uq_campus_events_slug"),
        sa.CheckConstraint("capacity > 0", name="ck_campus_events_capacity_positive"),
        sa.CheckConstraint("ends_at > starts_at", name="ck_campus_events_time_ordered"),
    )

    op.create_table(
        "event_registrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=False),
        sa.Column("student_id", sa.String(length=80), nullable=True),
        sa.Column("status", postgresql.ENUM(name="event_registration_status", create_type=False), nullable=False, server_default="CONFIRMED"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("confirmation_code", sa.String(length=24), nullable=False, server_default=sa.text("upper(substr(md5(random()::text), 1, 12))")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["campus_events.id"], name="fk_event_registrations_event_id_campus_events", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_event_registrations_user_id_users", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_event_registrations"),
        sa.UniqueConstraint("confirmation_code", name="uq_event_registrations_confirmation_code"),
        sa.CheckConstraint(
            "(active = true AND status = 'CONFIRMED' AND cancelled_at IS NULL) OR "
            "(active = false AND status = 'CANCELLED' AND cancelled_at IS NOT NULL)",
            name="ck_event_registrations_state_consistent",
        ),
    )
    op.create_index("ix_event_registrations_event_active", "event_registrations", ["event_id", "active"])
    op.create_index("ix_event_registrations_user_created_at", "event_registrations", ["user_id", "created_at"])
    op.create_index("uq_event_registrations_active_user_event", "event_registrations", ["event_id", "user_id"], unique=True, postgresql_where=sa.text("active = true"))


def downgrade() -> None:
    op.drop_index("uq_event_registrations_active_user_event", table_name="event_registrations")
    op.drop_index("ix_event_registrations_user_created_at", table_name="event_registrations")
    op.drop_index("ix_event_registrations_event_active", table_name="event_registrations")
    op.drop_table("event_registrations")
    op.drop_table("campus_events")
    sa.Enum(name="event_registration_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="event_status").drop(op.get_bind(), checkfirst=True)
