"""Add notification delivery retry metadata.

Revision ID: 20261006_0006
Revises: 20261006_0005
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261006_0006"
down_revision: str | Sequence[str] | None = "20261006_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("notifications", sa.Column("last_error", sa.Text(), nullable=True))
    op.add_column(
        "notifications",
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_notifications_next_attempt_at", "notifications", ["next_attempt_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_next_attempt_at", table_name="notifications")
    op.drop_column("notifications", "next_attempt_at")
    op.drop_column("notifications", "last_error")
    op.drop_column("notifications", "attempt_count")
