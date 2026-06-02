"""Database engine, session factory, and declarative base."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()


def _normalize_db_url(url: str) -> str:
    """Normalize provider-supplied URLs to the psycopg2 dialect.

    Render/Heroku hand out ``postgres://`` (and sometimes plain
    ``postgresql://``) URLs; SQLAlchemy 2.0 needs an explicit driver.
    """
    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+" not in url.split("://", 1)[0]:
        return "postgresql+psycopg2://" + url[len("postgresql://") :]
    return url


# pool_pre_ping avoids stale connections on free hosting tiers that
# aggressively close idle connections.
engine = create_engine(_normalize_db_url(settings.database_url), pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a database session and closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
