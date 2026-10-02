import os
from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/unispot_test",
)
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-that-is-at-least-32-characters")
os.environ.setdefault("ALLOWED_ORIGINS", '["http://localhost:5173"]')

from app.main import app  # noqa: E402


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """Yield an isolated PostgreSQL session and roll back all test writes."""
    database_url = os.getenv("TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("TEST_DATABASE_URL is not configured")

    test_engine = create_async_engine(database_url, pool_pre_ping=True)
    async with test_engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(bind=connection, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()
    await test_engine.dispose()
