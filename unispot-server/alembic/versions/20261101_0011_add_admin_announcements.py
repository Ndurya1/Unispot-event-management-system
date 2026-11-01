"""Add announcement notifications for admin broadcasts.

Revision ID: 20261101_0011
Revises: 20261101_0010
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261101_0011"
down_revision: str | Sequence[str] | None = "20261101_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values safely in-place.
    pass
