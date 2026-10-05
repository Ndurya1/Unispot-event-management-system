from collections.abc import Iterator
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.config import get_settings
from app.core.http_errors import install_error_handlers
from app.core.http_middleware import HttpMiddleware


class Limiter:
    def __init__(self) -> None:
        self.count = 0

    async def check(self, key: str, limit: int, window: int) -> int:
        self.count += 1
        return 30 if self.count > limit else 0


class Input(BaseModel):
    password: str = Field(max_length=4)


@pytest.fixture
def hardened_client() -> Iterator[TestClient]:
    app = FastAPI()
    settings = get_settings().model_copy(
        update={
            "rate_limit_enabled": True,
            "rate_limit_login": 2,
            "max_request_body_bytes": 1024,
        }
    )
    app.add_middleware(HttpMiddleware, settings=settings, limiter=Limiter())
    install_error_handlers(app)

    @app.post("/auth/login")
    async def login(data: Input) -> None:
        raise HTTPException(401, "Invalid email or password")

    @app.get("/failure/{kind}")
    async def failure(kind: str) -> None:
        if kind == "integrity":
            raise IntegrityError("SQL secret", {}, Exception("password-secret"))
        if kind == "database":
            raise OperationalError("SQL secret", {}, Exception("password-secret"))
        raise RuntimeError("password-secret")

    with TestClient(app) as client:
        yield client


def test_error_codes_request_ids_and_redaction(hardened_client: TestClient) -> None:
    request_id = str(uuid4())
    with patch("app.core.http_middleware.log_event") as log:
        response = hardened_client.post(
            "/auth/login?token=query-secret",
            json={"password": "password-secret"},
            headers={"X-Request-ID": request_id, "Authorization": "Bearer header-secret"},
        )
    assert response.status_code == 422
    assert response.headers["X-Request-ID"] == request_id
    assert response.json()["error"]["request_id"] == request_id
    assert response.json()["error"]["code"] == "validation_error"
    assert "secret" not in response.text
    assert "secret" not in str(log.call_args)
    assert log.call_args.kwargs["endpoint"] == "/auth/login"


@pytest.mark.parametrize(
    "kind,status,code",
    [
        ("integrity", 409, "integrity_conflict"),
        ("database", 503, "database_unavailable"),
        ("unexpected", 500, "internal_error"),
    ],
)
def test_safe_database_and_unexpected_errors(
    hardened_client: TestClient,
    kind: str,
    status: int,
    code: str,
) -> None:
    response = hardened_client.get(f"/failure/{kind}", headers={"X-Request-ID": "invalid"})
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    UUID(response.headers["X-Request-ID"])
    assert "secret" not in response.text
    assert "SQL" not in response.text


def test_login_throttling_has_retry_guidance(hardened_client: TestClient) -> None:
    for _ in range(2):
        assert hardened_client.post("/auth/login", json={"password": "bad"}).status_code == 401
    response = hardened_client.post("/auth/login", json={"password": "bad"})
    assert response.status_code == 429
    assert response.headers["Retry-After"] == "30"
    assert response.json()["error"]["code"] == "rate_limited"


def test_body_limit_ignores_spoofed_content_length(hardened_client: TestClient) -> None:
    response = hardened_client.post(
        "/auth/login",
        content=b"x" * 2048,
        headers={"Content-Length": "1"},
    )
    assert response.status_code == 413


def test_openapi_error_contract_and_no_approval_controls(client: TestClient) -> None:
    document = client.get("/openapi.json").json()
    assert "/auth/login" in document["paths"]
    assert "/admin/metrics" in document["paths"]
    assert document["paths"]["/bookings"]["post"]["responses"]["429"]["content"]
    assert not any("approve" in path or "reject" in path for path in document["paths"])
    assert client.get("/admin/metrics").status_code in {401, 403}
