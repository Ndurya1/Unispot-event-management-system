from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DatabaseUnavailableError
from app.db.session import AsyncSessionFactory, check_database_connection


async def get_db() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionFactory() as session:
        yield session


async def require_database_connection(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    try:
        await check_database_connection(session)
    except DatabaseUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "database_unavailable",
                "message": "Database is temporarily unavailable",
            },
        ) from error
