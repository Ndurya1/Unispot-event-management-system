"""Provider quote fields and pending status.

Revision ID: 20261108_0023
Revises: 20261108_0022
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261108_0023"
down_revision: str | Sequence[str] | None = "20261108_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE provider_status ADD VALUE IF NOT EXISTS 'PENDING'")
        op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'SERVICE_REQUEST_QUOTED'")
    op.add_column("service_requests", sa.Column("quote_amount_kes", sa.Integer(), nullable=True))
    op.add_column("service_requests", sa.Column("quote_notes", sa.Text(), nullable=True))
    op.add_column("service_requests", sa.Column("quoted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("service_requests", sa.Column("quoted_by_provider_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_service_requests_quoted_by_provider_id_service_providers", "service_requests", "service_providers", ["quoted_by_provider_id"], ["id"], ondelete="SET NULL")
    op.add_column("service_providers", sa.Column("contact_email", sa.String(length=255), nullable=True))
    op.add_column("service_providers", sa.Column("contact_phone", sa.String(length=40), nullable=True))
    op.add_column("service_providers", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))


def downgrade() -> None:
    op.drop_column("service_providers", "updated_at")
    op.drop_column("service_providers", "contact_phone")
    op.drop_column("service_providers", "contact_email")
    op.drop_constraint("fk_service_requests_quoted_by_provider_id_service_providers", "service_requests", type_="foreignkey")
    op.drop_column("service_requests", "quoted_by_provider_id")
    op.drop_column("service_requests", "quoted_at")
    op.drop_column("service_requests", "quote_notes")
    op.drop_column("service_requests", "quote_amount_kes")
