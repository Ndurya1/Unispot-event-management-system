"""Link campus events to venue reservations for conflict revalidation.

Revision ID: 20261108_0021
Revises: 20261108_0020
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261108_0021"
down_revision: str | Sequence[str] | None = "20261108_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add EVENT reservation type (idempotent-ish; Postgres errors if exists without IF NOT EXISTS on older patterns)
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE reservation_type ADD VALUE IF NOT EXISTS 'EVENT'")
    op.add_column("campus_events", sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("campus_events", sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("campus_events", sa.Column("reservation_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("campus_events", sa.Column("expected_attendance", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_campus_events_venue_id_venues", "campus_events", "venues", ["venue_id"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_campus_events_organization_id_organizations", "campus_events", "organizations", ["organization_id"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_campus_events_reservation_id_venue_reservations", "campus_events", "venue_reservations", ["reservation_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_campus_events_venue_id", "campus_events", ["venue_id"])
    op.create_unique_constraint("uq_campus_events_reservation_id", "campus_events", ["reservation_id"])


def downgrade() -> None:
    op.drop_constraint("uq_campus_events_reservation_id", "campus_events", type_="unique")
    op.drop_index("ix_campus_events_venue_id", table_name="campus_events")
    op.drop_constraint("fk_campus_events_reservation_id_venue_reservations", "campus_events", type_="foreignkey")
    op.drop_constraint("fk_campus_events_organization_id_organizations", "campus_events", type_="foreignkey")
    op.drop_constraint("fk_campus_events_venue_id_venues", "campus_events", type_="foreignkey")
    op.drop_column("campus_events", "expected_attendance")
    op.drop_column("campus_events", "reservation_id")
    op.drop_column("campus_events", "organization_id")
    op.drop_column("campus_events", "venue_id")
