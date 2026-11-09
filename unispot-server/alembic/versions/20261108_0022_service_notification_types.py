"""Service request/provider workflow notification types.

Revision ID: 20261108_0022
Revises: 20261108_0021
"""
from collections.abc import Sequence

from alembic import op

revision: str = "20261108_0022"
down_revision: str | Sequence[str] | None = "20261108_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for value in ("SERVICE_REQUEST_ASSIGNED", "SERVICE_REQUEST_STATUS", "SERVICE_REQUEST_CANCELLED"):
            op.execute(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # PostgreSQL enum value removal is non-trivial; keep values.
    pass
