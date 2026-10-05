from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.core.exceptions import DatabaseUnavailableError
from app.core.observability import install_database_metrics

settings = get_settings()

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    hide_parameters=True,
    connect_args={"server_settings": {"statement_timeout": "10000", "lock_timeout": "5000"}},
)
install_database_metrics(engine.sync_engine)
AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def check_database_connection(session: AsyncSession) -> None:
    try:
        await session.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise DatabaseUnavailableError("PostgreSQL health check failed") from error


async def dispose_engine() -> None:
    await engine.dispose()
