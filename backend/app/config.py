"""Application configuration loaded from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings.

    Values are read from environment variables. Never hardcode credentials;
    the database URL and CORS origins must be supplied by the environment
    (docker-compose, Render, Railway, etc.).
    """

    # Full SQLAlchemy database URL, e.g.
    # postgresql+psycopg2://user:pass@host:5432/dbname
    database_url: str = "postgresql+psycopg2://postgres:postgres@db:5432/inventory"

    # Comma-separated list of allowed CORS origins for the frontend.
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost"

    # Whether to auto-create tables on startup (handy for demos/free hosting
    # where running migrations separately is inconvenient).
    auto_create_tables: bool = True

    # Low-stock threshold used by the dashboard summary.
    low_stock_threshold: int = 10

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
