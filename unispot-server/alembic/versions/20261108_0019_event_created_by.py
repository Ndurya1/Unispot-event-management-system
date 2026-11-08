"""Add created_by_user_id to campus_events.

Revision ID: 20261108_0019
Revises: 20261108_0018
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261108_0019"
down_revision: str | Sequence[str] | None = "20261108_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("campus_events", sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_campus_events_created_by_user_id_users", "campus_events", "users", ["created_by_user_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_campus_events_created_by_user_id", "campus_events", ["created_by_user_id"])


def downgrade() -> None:
    op.drop_index("ix_campus_events_created_by_user_id", table_name="campus_events")
    op.drop_constraint("fk_campus_events_created_by_user_id_users", "campus_events", type_="foreignkey")
    op.drop_column("campus_events", "created_by_user_id")
