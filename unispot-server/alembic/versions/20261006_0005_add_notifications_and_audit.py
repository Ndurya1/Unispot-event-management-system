"""Add M4 notification and audit records.

Revision ID: 20261006_0005
Revises: 20261005_0004
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261006_0005"
down_revision: str | Sequence[str] | None = "20261005_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> None:
    sa.Enum(*values, name=name).create(op.get_bind(), checkfirst=True)


def upgrade() -> None:
    _enum("notification_type", "CONFIRMED", "CANCELLED", "REMINDER", "VENUE_CHANGE")
    _enum("notification_channel", "IN_APP", "EMAIL", "SMS")
    _enum("delivery_status", "PENDING", "SENT", "FAILED", "READ")
    _enum("actor_type", "USER", "ASSISTANT", "SYSTEM")
    _enum("audit_outcome", "SUCCEEDED", "FAILED", "DENIED")

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", postgresql.ENUM(name="notification_type", create_type=False), nullable=False),
        sa.Column("channel", postgresql.ENUM(name="notification_channel", create_type=False), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("delivery_status", postgresql.ENUM(name="delivery_status", create_type=False), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], name="fk_notifications_booking_id_bookings", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_notifications_user_id_users", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_notifications"),
    )
    op.create_index("ix_notifications_user_created_at", "notifications", ["user_id", "created_at"])
    op.create_index("ix_notifications_delivery_status", "notifications", ["delivery_status"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_type", postgresql.ENUM(name="actor_type", create_type=False), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=80), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("channel", postgresql.ENUM(name="booking_source", create_type=False), nullable=False),
        sa.Column("outcome", postgresql.ENUM(name="audit_outcome", create_type=False), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], name="fk_audit_events_actor_user_id_users", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_audit_events"),
    )
    op.create_index("ix_audit_events_target_created_at", "audit_events", ["target_type", "target_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_target_created_at", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_notifications_delivery_status", table_name="notifications")
    op.drop_index("ix_notifications_user_created_at", table_name="notifications")
    op.drop_table("notifications")
    sa.Enum(name="audit_outcome").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="actor_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="delivery_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="notification_channel").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="notification_type").drop(op.get_bind(), checkfirst=True)
