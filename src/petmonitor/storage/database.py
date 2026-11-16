"""SQLite storage layer — clips and detections tables."""

from __future__ import annotations

import logging
import sqlite3
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from petmonitor.ingestion.ingestor import ClipRecord
    from petmonitor.vision.detector import Detection

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS clips (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    sha256            TEXT    NOT NULL UNIQUE,
    local_path        TEXT    NOT NULL,
    source_type       TEXT    NOT NULL,
    original_filename TEXT    NOT NULL,
    capture_at        TEXT,
    ingested_at       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS detections (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    clip_id      INTEGER NOT NULL REFERENCES clips(id),
    frame_index  INTEGER NOT NULL,
    timestamp_ms REAL    NOT NULL,
    pet_class    INTEGER NOT NULL,
    confidence   REAL    NOT NULL,
    bbox_x       REAL    NOT NULL,
    bbox_y       REAL    NOT NULL,
    bbox_w       REAL    NOT NULL,
    bbox_h       REAL    NOT NULL
);
"""


class Database:
    """Thin SQLite wrapper.  Use as a context manager or call connect/close manually."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._conn: sqlite3.Connection | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def connect(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self._path))
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    def __enter__(self) -> "Database":
        self.connect()
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Schema
    # ------------------------------------------------------------------

    def migrate(self) -> None:
        assert self._conn
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    # ------------------------------------------------------------------
    # Clips — callable as db_writer for Ingestor
    # ------------------------------------------------------------------

    def __call__(self, record: "ClipRecord") -> int:
        """Make Database usable directly as Ingestor's db_writer callable."""
        return self.insert_clip(record)

    def insert_clip(self, record: "ClipRecord") -> int:
        """Insert a clip record and return its row id.

        If the SHA-256 already exists (duplicate on disk that the ingestor flagged
        as already_existed), the existing row id is returned without inserting again.
        """
        assert self._conn
        if record.already_existed:
            row = self._conn.execute(
                "SELECT id FROM clips WHERE sha256 = ?", (record.sha256,)
            ).fetchone()
            if row:
                return int(row["id"])

        cur = self._conn.execute(
            """
            INSERT INTO clips (sha256, local_path, source_type, original_filename, capture_at, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                record.sha256,
                str(record.local_path),
                record.source_type.value,
                record.original_filename,
                record.capture_at.isoformat() if record.capture_at else None,
                record.ingested_at.isoformat(),
            ),
        )
        self._conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def clip_exists_by_sha256(self, sha256: str) -> bool:
        assert self._conn
        row = self._conn.execute(
            "SELECT id FROM clips WHERE sha256 = ?", (sha256,)
        ).fetchone()
        return row is not None

    # ------------------------------------------------------------------
    # Detections
    # ------------------------------------------------------------------

    def insert_detection(self, detection: "Detection") -> int:
        assert self._conn
        cur = self._conn.execute(
            """
            INSERT INTO detections
                (clip_id, frame_index, timestamp_ms, pet_class, confidence, bbox_x, bbox_y, bbox_w, bbox_h)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                detection.clip_id,
                detection.frame_index,
                detection.timestamp_ms,
                detection.pet_class,
                detection.confidence,
                detection.bbox_x,
                detection.bbox_y,
                detection.bbox_w,
                detection.bbox_h,
            ),
        )
        self._conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def list_clips_without_detections(self) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            """
            SELECT c.* FROM clips c
            WHERE NOT EXISTS (SELECT 1 FROM detections d WHERE d.clip_id = c.id)
            ORDER BY c.ingested_at
            """
        ).fetchall()
        return [dict(r) for r in rows]
