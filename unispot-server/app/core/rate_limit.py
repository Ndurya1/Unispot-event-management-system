import hashlib
import hmac
import math
import time
from datetime import UTC, datetime
from typing import Protocol

from sqlalchemy import case
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.rate_limit import RateLimitBucket


class RateLimiter(Protocol):
    async def check(self, key: str, limit: int, window: int) -> int: ...


def bucket_key(secret: str, group: str, identity: str) -> str:
    return hmac.new(secret.encode(), f"{group}:{identity}".encode(), hashlib.sha256).hexdigest()


class PostgresRateLimiter:
    """Atomic fixed windows shared by API workers and replicas."""

    def __init__(self, factory: async_sessionmaker[AsyncSession]) -> None:
        self.factory = factory

    async def check(self, key: str, limit: int, window: int) -> int:
        now = time.time()
        start = int(now // window) * window
        statement = insert(RateLimitBucket).values(
            key=key,
            window_start=start,
            count=1,
            expires_at=datetime.fromtimestamp(start + window * 2, UTC),
        )
        upsert = statement.on_conflict_do_update(
            index_elements=[RateLimitBucket.key],
            set_={
                "window_start": start,
                "count": case(
                    (RateLimitBucket.window_start == start, RateLimitBucket.count + 1),
                    else_=1,
                ),
                "expires_at": statement.excluded.expires_at,
            },
        ).returning(RateLimitBucket.count)
        async with self.factory() as session, session.begin():
            count = await session.scalar(upsert)
        return max(1, math.ceil(start + window - now)) if (count or 0) > limit else 0
