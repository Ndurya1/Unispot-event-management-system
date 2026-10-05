import hashlib
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def lock_idempotency_key(
    session: AsyncSession,
    user_id: UUID,
    operation: str,
    key: str,
) -> None:
    """Serialize same-key requests, including the first insert (no row exists yet)."""
    digest = hashlib.sha256(f"{user_id}:{operation}:{key}".encode()).digest()
    lock_key = int.from_bytes(digest[:8], "big", signed=True)
    await session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
