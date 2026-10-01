from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class Settings(BaseSettings):
    DATABASE_URL: str

    JWT_ACCESS_SECRET: str
    JWT_REFRESH_SECRET: str
    JWT_ACCESS_EXPIRES_IN: str
    JWT_REFRESH_EXPIRES_IN: str

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()

engine = create_engine(
    settings.DATABASE_URL,
    echo=True
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)
