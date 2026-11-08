"""Add event notification types.

Revision ID: 20261108_0018
Revises: 20261107_0017
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261108_0018"
down_revision: str | Sequence[str] | None = "20261107_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # PostgreSQL enum values must be added outside a transaction in some setups; Alembic/autocommit handles this in modern usage.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'EVENT_UPDATED'")
        op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'EVENT_CANCELLED'")


def downgrade() -> None:
    # Enum value removal is non-trivial in PostgreSQL; leave values in place.
    pass
