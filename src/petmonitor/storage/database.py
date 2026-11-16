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

CREATE TABLE IF NOT EXISTS tracks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    clip_id      INTEGER NOT NULL REFERENCES clips(id),
    track_id     INTEGER NOT NULL,
    identity     TEXT    NOT NULL,
    confidence   REAL    NOT NULL,
    frame_start  INTEGER NOT NULL,
    frame_end    INTEGER NOT NULL,
    pet_id       INTEGER,
    UNIQUE(clip_id, track_id)
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

    # ------------------------------------------------------------------
    # Tracks
    # ------------------------------------------------------------------

    def insert_track(
        self,
        clip_id: int,
        track_id: int,
        identity: str,
        confidence: float,
        frame_start: int,
        frame_end: int,
        pet_id: int | None = None,
    ) -> int:
        assert self._conn
        cur = self._conn.execute(
            """
            INSERT OR IGNORE INTO tracks
                (clip_id, track_id, identity, confidence, frame_start, frame_end, pet_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (clip_id, track_id, identity, confidence, frame_start, frame_end, pet_id),
        )
        self._conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def list_tracks_for_clip(self, clip_id: int) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            "SELECT * FROM tracks WHERE clip_id = ? ORDER BY track_id",
            (clip_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def list_clips_without_tracks(self) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            """
            SELECT c.id FROM clips c
            WHERE EXISTS     (SELECT 1 FROM detections d WHERE d.clip_id = c.id)
              AND NOT EXISTS (SELECT 1 FROM tracks t     WHERE t.clip_id = c.id)
            ORDER BY c.ingested_at
            """
        ).fetchall()
        return [dict(r) for r in rows]

    def list_detections_for_clip(self, clip_id: int) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            "SELECT * FROM detections WHERE clip_id = ? ORDER BY frame_index",
            (clip_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------------
    # API query helpers
    # ------------------------------------------------------------------

    def list_clips(self, limit: int = 50, offset: int = 0) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            """
            SELECT c.*,
                   COUNT(DISTINCT d.id) AS detection_count,
                   COUNT(DISTINCT t.id) AS track_count
            FROM clips c
            LEFT JOIN detections d ON d.clip_id = c.id
            LEFT JOIN tracks t     ON t.clip_id = c.id
            GROUP BY c.id
            ORDER BY c.ingested_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_clip(self, clip_id: int) -> dict | None:
        assert self._conn
        row = self._conn.execute(
            """
            SELECT c.*,
                   COUNT(DISTINCT d.id) AS detection_count,
                   COUNT(DISTINCT t.id) AS track_count
            FROM clips c
            LEFT JOIN detections d ON d.clip_id = c.id
            LEFT JOIN tracks t     ON t.clip_id = c.id
            WHERE c.id = ?
            GROUP BY c.id
            """,
            (clip_id,),
        ).fetchone()
        if row is None:
            return None
        result = dict(row)
        result["detections"] = self.list_detections_for_clip(clip_id)
        result["tracks"] = self.list_tracks_for_clip(clip_id)
        return result

    def get_stats(self) -> dict:
        assert self._conn
        clips = self._conn.execute("SELECT COUNT(*) FROM clips").fetchone()[0]
        detections = self._conn.execute("SELECT COUNT(*) FROM detections").fetchone()[0]
        tracks = self._conn.execute("SELECT COUNT(*) FROM tracks").fetchone()[0]
        return {
            "clips": {"total": clips},
            "detections": {"total": detections},
            "tracks": {"total": tracks},
        }

    def get_identity_stats(self) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            """
            SELECT identity,
                   COUNT(*)               AS track_count,
                   COUNT(DISTINCT clip_id) AS clip_count
            FROM tracks
            GROUP BY identity
            """
        ).fetchall()
        return [dict(r) for r in rows]
