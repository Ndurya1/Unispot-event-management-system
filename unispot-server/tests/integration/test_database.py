import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import check_database_connection


@pytest.mark.integration
@pytest.mark.asyncio
async def test_postgresql_session_executes_select_one(db_session: AsyncSession) -> None:
    await check_database_connection(db_session)
