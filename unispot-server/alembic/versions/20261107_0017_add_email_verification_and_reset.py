"""Add email verification and password reset action tokens.

Revision ID: 20261107_0017
Revises: 20261106_0016
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20261107_0017"
down_revision: str | Sequence[str] | None = "20261106_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))

    action_type = postgresql.ENUM("VERIFY_EMAIL", "RESET_PASSWORD", name="auth_action_type")
    action_type.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "auth_action_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_type", postgresql.ENUM(name="auth_action_type", create_type=False), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_auth_action_tokens_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_auth_action_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_auth_action_tokens_token_hash"),
    )
    op.create_index("ix_auth_action_tokens_user_type", "auth_action_tokens", ["user_id", "action_type"], unique=False)
    op.create_index("ix_auth_action_tokens_expires_at", "auth_action_tokens", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_auth_action_tokens_expires_at", table_name="auth_action_tokens")
    op.drop_index("ix_auth_action_tokens_user_type", table_name="auth_action_tokens")
    op.drop_table("auth_action_tokens")
    sa.Enum(name="auth_action_type").drop(op.get_bind(), checkfirst=True)
    op.drop_column("users", "email_verified_at")
