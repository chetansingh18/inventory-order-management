"""Pytest configuration: set safe env vars before the app is imported."""
import os

# Disable Postgres-dependent startup behaviour; tests create their own
# in-memory SQLite schema via the `client` fixture.
os.environ.setdefault("AUTO_CREATE_TABLES", "false")
os.environ.setdefault("DATABASE_URL", "sqlite://")
