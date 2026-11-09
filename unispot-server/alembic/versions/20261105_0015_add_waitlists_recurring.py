"""Add venue waitlists and recurring schedules.

Revision ID: 20261105_0015
Revises: 20261105_0014
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261105_0015"
down_revision: str | Sequence[str] | None = "20261105_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> None:
    sa.Enum(*values, name=name).create(op.get_bind(), checkfirst=True)


def upgrade() -> None:
    _enum("waitlist_status", "ACTIVE", "CANCELLED")
    _enum("recurring_status", "ACTIVE", "PAUSED", "CANCELLED")

    op.create_table(
        "venue_waitlists",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_date", sa.Date(), nullable=False),
        sa.Column("requested_start", sa.String(length=5), nullable=False),
        sa.Column("requested_end", sa.String(length=5), nullable=False),
        sa.Column("event_name", sa.String(length=200), nullable=False),
        sa.Column("status", postgresql.ENUM(name="waitlist_status", create_type=False), nullable=False, server_default="ACTIVE"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("confirmation_code", sa.String(length=24), nullable=False, server_default=sa.text("upper(substr(md5(random()::text), 1, 12))")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_venue_waitlists_user_id_users", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], name="fk_venue_waitlists_venue_id_venues", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_venue_waitlists"),
        sa.UniqueConstraint("confirmation_code", name="uq_venue_waitlists_confirmation_code"),
    )
    op.create_index("ix_venue_waitlists_user_created_at", "venue_waitlists", ["user_id", "created_at"])

    op.create_table(
        "recurring_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_name", sa.String(length=200), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.String(length=5), nullable=False),
        sa.Column("end_time", sa.String(length=5), nullable=False),
        sa.Column("status", postgresql.ENUM(name="recurring_status", create_type=False), nullable=False, server_default="ACTIVE"),
        sa.Column("confirmation_code", sa.String(length=24), nullable=False, server_default=sa.text("upper(substr(md5(random()::text), 1, 12))")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_recurring_schedules_user_id_users", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], name="fk_recurring_schedules_venue_id_venues", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_recurring_schedules"),
        sa.UniqueConstraint("confirmation_code", name="uq_recurring_schedules_confirmation_code"),
        sa.CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="ck_recurring_schedules_day_range"),
    )
    op.create_index("ix_recurring_schedules_user_created_at", "recurring_schedules", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_recurring_schedules_user_created_at", table_name="recurring_schedules")
    op.drop_table("recurring_schedules")
    op.drop_index("ix_venue_waitlists_user_created_at", table_name="venue_waitlists")
    op.drop_table("venue_waitlists")
    sa.Enum(name="recurring_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="waitlist_status").drop(op.get_bind(), checkfirst=True)
