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
    database_url: str = Field(validation_alias="DATABASE_URL")
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

    @field_validator("database_url")
    @classmethod
    def require_async_postgresql(cls, value: str) -> str:
        if not value.startswith("postgresql+asyncpg://"):
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

        database_url = self.database_url.lower()
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
