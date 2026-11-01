"""Add venue presentation metadata.

Revision ID: 20261101_0010
Revises: 20261009_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261101_0010"
down_revision: str | Sequence[str] | None = "20261009_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "venues",
        sa.Column("venue_type", sa.String(length=80), nullable=False, server_default="OTHER"),
    )
    op.add_column("venues", sa.Column("image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("venues", "image_url")
    op.drop_column("venues", "venue_type")
