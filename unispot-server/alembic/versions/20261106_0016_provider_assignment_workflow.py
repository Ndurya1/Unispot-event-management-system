"""Add provider ownership and assignment workflow fields.

Revision ID: 20261106_0016
Revises: 20261105_0015
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261106_0016"
down_revision: str | Sequence[str] | None = "20261105_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("service_providers", sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_service_providers_owner_user_id_users", "service_providers", "users", ["owner_user_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_service_providers_owner_user_id", "service_providers", ["owner_user_id"], unique=False)

    op.execute("ALTER TYPE service_request_status ADD VALUE IF NOT EXISTS 'PENDING'")
    op.execute("ALTER TYPE service_request_status ADD VALUE IF NOT EXISTS 'ACCEPTED'")
    op.execute("ALTER TYPE service_request_status ADD VALUE IF NOT EXISTS 'IN_PROGRESS'")
    op.execute("ALTER TYPE service_request_status ADD VALUE IF NOT EXISTS 'COMPLETED'")

    op.add_column("service_requests", sa.Column("assigned_provider_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("service_requests", sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("service_requests", sa.Column("assigned_by_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_service_requests_assigned_provider_id_service_providers", "service_requests", "service_providers", ["assigned_provider_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_service_requests_assigned_by_user_id_users", "service_requests", "users", ["assigned_by_user_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_service_requests_assigned_provider_id", "service_requests", ["assigned_provider_id"], unique=False)
    op.execute("ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS ck_service_requests_state_consistent")
    op.execute("ALTER TABLE service_requests ALTER COLUMN status SET DEFAULT 'PENDING'")
    op.execute("UPDATE service_requests SET status = 'PENDING' WHERE status = 'CONFIRMED'")
    op.execute("ALTER TABLE service_requests ADD CONSTRAINT ck_service_requests_state_consistent CHECK ((status = 'CANCELLED' AND active = false AND cancelled_at IS NOT NULL) OR (status <> 'CANCELLED' AND active = true AND cancelled_at IS NULL))")
    op.create_unique_constraint("uq_service_requests_id_assigned_provider_id", "service_requests", ["id", "assigned_provider_id"])


def downgrade() -> None:
    op.drop_constraint("uq_service_requests_id_assigned_provider_id", "service_requests", type_="unique")
    op.execute("ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS ck_service_requests_state_consistent")
    op.execute("UPDATE service_requests SET status = 'CONFIRMED', active = true, cancelled_at = NULL WHERE status <> 'CANCELLED'")
    op.execute("ALTER TABLE service_requests ALTER COLUMN status SET DEFAULT 'CONFIRMED'")
    op.execute("ALTER TABLE service_requests ADD CONSTRAINT ck_service_requests_state_consistent CHECK ((active = true AND status = 'CONFIRMED' AND cancelled_at IS NULL) OR (active = false AND status = 'CANCELLED' AND cancelled_at IS NOT NULL))")
    op.drop_index("ix_service_requests_assigned_provider_id", table_name="service_requests")
    op.drop_constraint("fk_service_requests_assigned_by_user_id_users", "service_requests", type_="foreignkey")
    op.drop_constraint("fk_service_requests_assigned_provider_id_service_providers", "service_requests", type_="foreignkey")
    op.drop_column("service_requests", "assigned_by_user_id")
    op.drop_column("service_requests", "assigned_at")
    op.drop_column("service_requests", "assigned_provider_id")
    op.drop_index("ix_service_providers_owner_user_id", table_name="service_providers")
    op.drop_constraint("fk_service_providers_owner_user_id_users", "service_providers", type_="foreignkey")
    op.drop_column("service_providers", "owner_user_id")
