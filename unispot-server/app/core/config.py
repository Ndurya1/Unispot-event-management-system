from enum import StrEnum
from functools import lru_cache
from typing import Self

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Validated application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        frozen=True,
    )

    app_name: str = "UniSpot API"
    app_version: str = "0.1.0"
    environment: Environment = Field(validation_alias="APP_ENV")
    database_url: SecretStr = Field(validation_alias="DATABASE_URL")
    jwt_secret_key: SecretStr = Field(validation_alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_access_token_minutes: int = Field(
        default=15,
        gt=0,
        validation_alias="JWT_ACCESS_TOKEN_MINUTES",
    )
    jwt_refresh_token_minutes: int = Field(
        default=10_080,
        gt=0,
        validation_alias="JWT_REFRESH_TOKEN_MINUTES",
    )
    allowed_origins: list[AnyHttpUrl] = Field(validation_alias="ALLOWED_ORIGINS")
    max_request_body_bytes: int = Field(default=32768, ge=1024, le=1048576)
    request_body_timeout_seconds: int = Field(default=15, ge=1, le=120)
    rate_limit_enabled: bool = True
    rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)
    rate_limit_login: int = Field(default=10, ge=1, le=10000)
    rate_limit_booking: int = Field(default=30, ge=1, le=10000)
    rate_limit_availability: int = Field(default=60, ge=1, le=10000)
    rate_limit_assistant: int = Field(default=20, ge=1, le=10000)
    assistant_timeout_seconds: int = Field(default=20, ge=1, le=120)
    worker_interval_seconds: int = Field(default=30, ge=1, le=3600)

    @field_validator("database_url")
    @classmethod
    def require_async_postgresql(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use the postgresql+asyncpg driver")
        return value

    @field_validator("jwt_secret_key")
    @classmethod
    def require_strong_jwt_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET_KEY must contain at least 32 characters")
        return value

    @model_validator(mode="after")
    def validate_production_safety(self) -> Self:
        if self.environment is not Environment.PRODUCTION:
            return self

        if not self.rate_limit_enabled:
            raise ValueError("production requires rate limiting")

        database_url = self.database_url.get_secret_value().lower()
        secret = self.jwt_secret_key.get_secret_value().lower()
        origins = {str(origin).lower() for origin in self.allowed_origins}

        if "localhost" in database_url or "@127.0.0.1" in database_url:
            raise ValueError("production DATABASE_URL cannot point to localhost")
        if "replace" in secret or "example" in secret:
            raise ValueError("production JWT_SECRET_KEY cannot use an example value")
        if any("localhost" in origin or "127.0.0.1" in origin for origin in origins):
            raise ValueError("production ALLOWED_ORIGINS cannot contain localhost")
        if not origins:
            raise ValueError("production ALLOWED_ORIGINS must not be empty")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
