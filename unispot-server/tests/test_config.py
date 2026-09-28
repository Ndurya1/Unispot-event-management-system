import pytest
from pydantic import ValidationError

from app.core.config import Environment, Settings


def valid_settings_values() -> dict[str, object]:
    return {
        "APP_ENV": "test",
        "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@localhost/unispot_test",
        "JWT_SECRET_KEY": "test-only-secret-that-is-at-least-32-characters",
        "ALLOWED_ORIGINS": ["http://localhost:3000"],
    }


def test_test_configuration_is_safe_and_typed() -> None:
    settings = Settings(_env_file=None, **valid_settings_values())  # type: ignore[arg-type]

    assert settings.environment is Environment.TEST
    assert settings.jwt_access_token_minutes == 15
    assert settings.jwt_refresh_token_minutes == 10_080


def test_production_rejects_local_example_configuration() -> None:
    values = valid_settings_values()
    values["APP_ENV"] = "production"

    with pytest.raises(ValidationError, match="production DATABASE_URL cannot point to localhost"):
        Settings(_env_file=None, **values)  # type: ignore[arg-type]


def test_secret_is_redacted_from_serialized_settings() -> None:
    secret = "test-only-secret-that-is-at-least-32-characters"
    settings = Settings(_env_file=None, **valid_settings_values())  # type: ignore[arg-type]

    assert secret not in repr(settings)
    assert secret not in settings.model_dump_json()
    assert "**********" in settings.model_dump_json()


def test_database_url_requires_async_postgresql() -> None:
    values = valid_settings_values()
    values["DATABASE_URL"] = "sqlite+aiosqlite:///test.db"

    with pytest.raises(ValidationError, match=r"postgresql\+asyncpg"):
        Settings(_env_file=None, **values)  # type: ignore[arg-type]
