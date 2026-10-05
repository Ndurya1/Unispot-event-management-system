from collections.abc import AsyncIterator

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.api.dependencies.database import get_db, require_database_connection
from app.main import app


class BrokenSession:
    async def execute(self, _: object) -> None:
        raise OperationalError("SELECT 1", {}, ConnectionError("database offline"))


async def broken_database_session() -> AsyncIterator[BrokenSession]:
    yield BrokenSession()


async def available_database() -> None:
    return None


def test_health_returns_status_and_version(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0"}


def test_readiness_hides_database_failure(client: TestClient) -> None:
    app.dependency_overrides[get_db] = broken_database_session

    response = client.get("/health/readiness")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "database_unavailable"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]
    assert "database offline" not in response.text


def test_readiness_reports_available_database(client: TestClient) -> None:
    app.dependency_overrides[require_database_connection] = available_database

    response = client.get("/health/readiness")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "available"}
