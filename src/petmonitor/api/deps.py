"""FastAPI dependency providers for the PetMonitor API."""

from __future__ import annotations

from pathlib import Path

from petmonitor.storage.database import Database

_db: Database | None = None


def init_db(path: Path) -> None:
    global _db
    if _db is not None:
        _db.close()
    _db = Database(path)
    _db.connect()
    _db.migrate()


def get_db() -> Database:
    if _db is None:
        raise RuntimeError("Database not initialised — call init_db() first")
    return _db


def close_db() -> None:
    global _db
    if _db is not None:
        _db.close()
        _db = None
