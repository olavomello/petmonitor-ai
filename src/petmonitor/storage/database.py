"""SQLite storage layer — clips, detections, tracks, activity, trajectories and frames tables."""

from __future__ import annotations

import logging
import sqlite3
from pathlib import Path
from typing import TYPE_CHECKING

import yaml

if TYPE_CHECKING:
    from petmonitor.ingestion.ingestor import ClipRecord
    from petmonitor.vision.detector import Detection

logger = logging.getLogger(__name__)

# Default location of the application config used to seed the pets table.
_DEFAULT_SEED_CONFIG = Path("configs/app.yaml")

# Known pet -> species mapping for the one-time seed. The legacy app.yaml carried
# a numeric ``class_id`` per pet, but those were custom-trained detector ids
# (0, 1) and are NOT COCO classes, so species cannot be derived from them.
# Map species by the known pet instead, and extend this table as pets are added.
_KNOWN_PET_SPECIES: dict[str, str] = {
    "branca": "dog",
    "marrie": "dog",
}

# Species fallback for a config pet not listed above. We never invent a cat from
# an unknown entry; a generic dog/cat detector plus the Pets screen can correct
# any mis-seeded species later.
_FALLBACK_SPECIES = "dog"

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

CREATE TABLE IF NOT EXISTS activity_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    clip_id     INTEGER NOT NULL REFERENCES clips(id),
    track_id    INTEGER NOT NULL,
    pet_id      INTEGER,
    identity    TEXT    NOT NULL,
    state       TEXT    NOT NULL CHECK(state IN ('moving','stationary','not_visible','unknown')),
    frame_start INTEGER NOT NULL,
    frame_end   INTEGER NOT NULL,
    UNIQUE(clip_id, track_id)
);

CREATE TABLE IF NOT EXISTS trajectories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    clip_id     INTEGER NOT NULL REFERENCES clips(id),
    track_id    INTEGER NOT NULL,
    frame_index INTEGER NOT NULL,
    x_px        REAL    NOT NULL,
    y_px        REAL    NOT NULL
);

CREATE TABLE IF NOT EXISTS frames (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    clip_id     INTEGER NOT NULL,
    frame_index INTEGER NOT NULL,
    file_path   TEXT    NOT NULL UNIQUE,
    status      TEXT    NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','keep','discard','labeled')),
    split       TEXT    DEFAULT NULL
                    CHECK(split IS NULL OR split IN ('train','val','test')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pets (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL UNIQUE,
    species          TEXT    NOT NULL CHECK(species IN ('dog','cat')),
    color            TEXT,
    breed            TEXT,
    notes            TEXT,
    active           INTEGER NOT NULL DEFAULT 1,
    trained_override TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pet_references (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id          INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    image_path      TEXT    NOT NULL,
    embedding       BLOB,
    embedding_model TEXT,
    source          TEXT    NOT NULL DEFAULT 'upload'
                        CHECK(source IN ('upload','auto_crop')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(pet_id, image_path)
);

CREATE INDEX IF NOT EXISTS idx_pet_references_pet ON pet_references(pet_id);
CREATE INDEX IF NOT EXISTS idx_pets_species_active ON pets(species, active);
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
        self._conn = sqlite3.connect(str(self._path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        # Enforce foreign keys so pet_references cascade-delete with their pet.
        self._conn.execute("PRAGMA foreign_keys=ON")

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    def __enter__(self) -> Database:
        self.connect()
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Schema
    # ------------------------------------------------------------------

    def migrate(self, seed_config_path: Path | str = _DEFAULT_SEED_CONFIG) -> None:
        assert self._conn
        self._conn.executescript(_SCHEMA)
        self._conn.commit()
        self._seed_pets(Path(seed_config_path))

    def _seed_pets(self, config_path: Path) -> None:
        """One-time, idempotent seed of the pets table from the app config.

        Runs only when the table is empty, so calling migrate() repeatedly leaves
        exactly one seeded row set. Species is derived from the known-pet map, not
        from the legacy numeric class_id (which was a custom-trained id, not COCO).
        """
        assert self._conn
        count = self._conn.execute("SELECT COUNT(*) FROM pets").fetchone()[0]
        if count:
            return

        for pet in self._read_config_pets(config_path):
            name = pet.get("name")
            if not name:
                continue
            species = _KNOWN_PET_SPECIES.get(str(name).strip().lower())
            if species is None:
                logger.warning(
                    "Seeding pet %r with fallback species %r (not in known map)",
                    name,
                    _FALLBACK_SPECIES,
                )
                species = _FALLBACK_SPECIES
            self._conn.execute(
                "INSERT OR IGNORE INTO pets (name, species, color) VALUES (?, ?, ?)",
                (name, species, pet.get("color")),
            )
        self._conn.commit()

    @staticmethod
    def _read_config_pets(config_path: Path) -> list[dict]:
        """Read the ``pets`` list from the app config, tolerating a missing file."""
        try:
            with open(config_path, encoding="utf-8") as fh:
                cfg = yaml.safe_load(fh) or {}
        except (OSError, yaml.YAMLError) as exc:
            logger.warning("Pet seed skipped: could not read %s (%s)", config_path, exc)
            return []
        pets = cfg.get("pets") or []
        return [p for p in pets if isinstance(p, dict)]

    # ------------------------------------------------------------------
    # Clips — callable as db_writer for Ingestor
    # ------------------------------------------------------------------

    def __call__(self, record: ClipRecord) -> int:
        return self.insert_clip(record)

    def insert_clip(self, record: ClipRecord) -> int:
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
        row = self._conn.execute("SELECT id FROM clips WHERE sha256 = ?", (sha256,)).fetchone()
        return row is not None

    # ------------------------------------------------------------------
    # Detections
    # ------------------------------------------------------------------

    def insert_detection(self, detection: Detection) -> int:
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

    def list_detections_for_track(
        self, clip_id: int, frame_start: int, frame_end: int
    ) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            """
            SELECT * FROM detections
            WHERE clip_id = ? AND frame_index BETWEEN ? AND ?
            ORDER BY frame_index
            """,
            (clip_id, frame_start, frame_end),
        ).fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------------
    # Activity events
    # ------------------------------------------------------------------

    def insert_activity_event(
        self,
        clip_id: int,
        track_id: int,
        identity: str,
        state: str,
        frame_start: int,
        frame_end: int,
        pet_id: int | None = None,
    ) -> int:
        assert self._conn
        cur = self._conn.execute(
            """
            INSERT OR IGNORE INTO activity_events
                (clip_id, track_id, identity, state, frame_start, frame_end, pet_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (clip_id, track_id, identity, state, frame_start, frame_end, pet_id),
        )
        self._conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def list_activity_events(
        self,
        identity: str | None = None,
        clip_id: int | None = None,
    ) -> list[dict]:
        assert self._conn
        query = "SELECT * FROM activity_events WHERE 1=1"
        params: list = []
        if identity is not None:
            query += " AND identity = ?"
            params.append(identity)
        if clip_id is not None:
            query += " AND clip_id = ?"
            params.append(clip_id)
        query += " ORDER BY clip_id, frame_start"
        rows = self._conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def list_clips_without_activity_events(self) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            """
            SELECT t.clip_id, t.track_id, t.identity, t.confidence,
                   t.frame_start, t.frame_end, t.pet_id
            FROM tracks t
            WHERE NOT EXISTS (
                SELECT 1 FROM activity_events a
                WHERE a.clip_id = t.clip_id AND a.track_id = t.track_id
            )
            ORDER BY t.clip_id, t.track_id
            """
        ).fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------------
    # Trajectories
    # ------------------------------------------------------------------

    def insert_trajectory_points(self, clip_id: int, track_id: int, points: list[dict]) -> None:
        assert self._conn
        self._conn.executemany(
            """
            INSERT INTO trajectories (clip_id, track_id, frame_index, x_px, y_px)
            VALUES (?, ?, ?, ?, ?)
            """,
            [(clip_id, track_id, p["frame_index"], p["x_px"], p["y_px"]) for p in points],
        )
        self._conn.commit()

    def list_trajectory_points(
        self, identity: str, db_tracks: list[dict] | None = None
    ) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            """
            SELECT tr.frame_index, tr.x_px, tr.y_px
            FROM trajectories tr
            JOIN tracks t ON t.clip_id = tr.clip_id AND t.track_id = tr.track_id
            WHERE t.identity = ?
            ORDER BY tr.clip_id, tr.frame_index
            """,
            (identity,),
        ).fetchall()
        return [dict(r) for r in rows]

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

    # ------------------------------------------------------------------
    # Frames (extracted stills for dataset curation)
    # ------------------------------------------------------------------

    def insert_frames_bulk(self, frames: list[dict]) -> int:
        """Insert a batch of frame records, skipping duplicates.  Returns inserted count."""
        assert self._conn
        before = self._conn.execute("SELECT COUNT(*) FROM frames").fetchone()[0]
        self._conn.executemany(
            "INSERT OR IGNORE INTO frames (clip_id, frame_index, file_path)"
            " VALUES (:clip_id, :frame_index, :file_path)",
            frames,
        )
        self._conn.commit()
        after = self._conn.execute("SELECT COUNT(*) FROM frames").fetchone()[0]
        return after - before

    def get_frame_paths(self) -> set[str]:
        assert self._conn
        rows = self._conn.execute("SELECT file_path FROM frames").fetchall()
        return {r["file_path"] for r in rows}

    def list_frames(
        self,
        limit: int = 100,
        offset: int = 0,
        status: str | None = None,
        clip_id: int | None = None,
    ) -> list[dict]:
        assert self._conn
        q = "SELECT * FROM frames WHERE 1=1"
        params: list = []
        if status is not None:
            q += " AND status = ?"
            params.append(status)
        if clip_id is not None:
            q += " AND clip_id = ?"
            params.append(clip_id)
        q += " ORDER BY clip_id, frame_index LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = self._conn.execute(q, params).fetchall()
        return [dict(r) for r in rows]

    def count_frames(self, status: str | None = None, clip_id: int | None = None) -> int:
        assert self._conn
        q = "SELECT COUNT(*) FROM frames WHERE 1=1"
        params: list = []
        if status is not None:
            q += " AND status = ?"
            params.append(status)
        if clip_id is not None:
            q += " AND clip_id = ?"
            params.append(clip_id)
        return self._conn.execute(q, params).fetchone()[0]

    def update_frame_status(self, frame_id: int, status: str) -> None:
        assert self._conn
        self._conn.execute("UPDATE frames SET status = ? WHERE id = ?", (status, frame_id))
        self._conn.commit()

    def get_frame(self, frame_id: int) -> dict | None:
        assert self._conn
        row = self._conn.execute("SELECT * FROM frames WHERE id = ?", (frame_id,)).fetchone()
        return dict(row) if row else None

    def get_frame_stats(self) -> dict:
        assert self._conn
        rows = self._conn.execute(
            "SELECT status, COUNT(*) AS count FROM frames GROUP BY status"
        ).fetchall()
        stats: dict = {r["status"]: r["count"] for r in rows}
        stats["total"] = sum(stats.values())
        return stats

    # ------------------------------------------------------------------
    # Pets (user-defined identity)
    # ------------------------------------------------------------------

    def list_pets(self, active_only: bool = True) -> list[dict]:
        assert self._conn
        query = "SELECT * FROM pets"
        if active_only:
            query += " WHERE active = 1"
        query += " ORDER BY name"
        rows = self._conn.execute(query).fetchall()
        return [dict(r) for r in rows]

    def get_pet(self, pet_id: int) -> dict | None:
        assert self._conn
        row = self._conn.execute("SELECT * FROM pets WHERE id = ?", (pet_id,)).fetchone()
        return dict(row) if row else None

    def insert_pet(
        self,
        name: str,
        species: str,
        color: str | None = None,
        breed: str | None = None,
        notes: str | None = None,
        active: int = 1,
        trained_override: str | None = None,
    ) -> int:
        assert self._conn
        cur = self._conn.execute(
            """
            INSERT INTO pets (name, species, color, breed, notes, active, trained_override)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (name, species, color, breed, notes, active, trained_override),
        )
        self._conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def update_pet(
        self,
        pet_id: int,
        *,
        name: str | None = None,
        species: str | None = None,
        color: str | None = None,
        breed: str | None = None,
        notes: str | None = None,
        active: int | None = None,
        trained_override: str | None = None,
    ) -> None:
        """Update the supplied fields of a pet and bump updated_at.

        Only non-None arguments are written, so callers patch individual columns.
        """
        assert self._conn
        fields: list[str] = []
        params: list = []
        for col, val in (
            ("name", name),
            ("species", species),
            ("color", color),
            ("breed", breed),
            ("notes", notes),
            ("active", active),
            ("trained_override", trained_override),
        ):
            if val is not None:
                fields.append(f"{col} = ?")
                params.append(val)
        # Column names above are fixed literals, never user input.
        fields.append("updated_at = datetime('now')")
        params.append(pet_id)
        self._conn.execute(f"UPDATE pets SET {', '.join(fields)} WHERE id = ?", params)
        self._conn.commit()

    def archive_pet(self, pet_id: int) -> None:
        """Soft-delete a pet (active=0) so historical tracks stay valid."""
        assert self._conn
        self._conn.execute(
            "UPDATE pets SET active = 0, updated_at = datetime('now') WHERE id = ?",
            (pet_id,),
        )
        self._conn.commit()

    def count_active_pets_by_species(self, species: str) -> int:
        assert self._conn
        return self._conn.execute(
            "SELECT COUNT(*) FROM pets WHERE active = 1 AND species = ?",
            (species,),
        ).fetchone()[0]

    # ------------------------------------------------------------------
    # Pet reference images
    # ------------------------------------------------------------------

    def insert_pet_reference(
        self,
        pet_id: int,
        image_path: str,
        source: str = "upload",
        embedding: bytes | None = None,
        embedding_model: str | None = None,
    ) -> int:
        assert self._conn
        cur = self._conn.execute(
            """
            INSERT INTO pet_references
                (pet_id, image_path, source, embedding, embedding_model)
            VALUES (?, ?, ?, ?, ?)
            """,
            (pet_id, image_path, source, embedding, embedding_model),
        )
        self._conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def list_pet_references(self, pet_id: int) -> list[dict]:
        assert self._conn
        rows = self._conn.execute(
            "SELECT * FROM pet_references WHERE pet_id = ? ORDER BY created_at, id",
            (pet_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_pet_reference(self, ref_id: int) -> dict | None:
        assert self._conn
        row = self._conn.execute("SELECT * FROM pet_references WHERE id = ?", (ref_id,)).fetchone()
        return dict(row) if row else None

    def count_pet_references(self, pet_id: int) -> int:
        """Reference count for a pet. The 10-image cap is enforced in the API/UI."""
        assert self._conn
        return self._conn.execute(
            "SELECT COUNT(*) FROM pet_references WHERE pet_id = ?", (pet_id,)
        ).fetchone()[0]

    def delete_pet_reference(self, ref_id: int) -> None:
        assert self._conn
        self._conn.execute("DELETE FROM pet_references WHERE id = ?", (ref_id,))
        self._conn.commit()

    def set_reference_embedding(
        self, ref_id: int, embedding_blob: bytes, embedding_model: str
    ) -> None:
        assert self._conn
        self._conn.execute(
            "UPDATE pet_references SET embedding = ?, embedding_model = ? WHERE id = ?",
            (embedding_blob, embedding_model, ref_id),
        )
        self._conn.commit()
