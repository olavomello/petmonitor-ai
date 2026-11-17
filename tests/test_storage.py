"""Tests for the SQLite storage layer."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from petmonitor.ingestion.ingestor import ClipRecord, SourceType
from petmonitor.storage.database import Database
from petmonitor.vision.detector import Detection


@pytest.fixture()
def db(tmp_path: Path) -> Database:
    d = Database(tmp_path / "test.db")
    d.connect()
    d.migrate()
    yield d
    d.close()


def _make_record(sha256: str = "abc123", already_existed: bool = False) -> ClipRecord:
    return ClipRecord(
        clip_id=None,
        local_path=Path("/tmp/clip.mp4"),
        sha256=sha256,
        source_type=SourceType.MANUAL_MP4,
        original_filename="clip.mp4",
        capture_at=None,
        ingested_at=datetime(2026, 11, 16, 10, 0, tzinfo=timezone.utc),
        already_existed=already_existed,
    )


def _make_detection(clip_id: int = 1) -> Detection:
    return Detection(
        clip_id=clip_id,
        frame_index=5,
        timestamp_ms=166.7,
        pet_class=0,
        confidence=0.92,
        bbox_x=100.0,
        bbox_y=50.0,
        bbox_w=80.0,
        bbox_h=90.0,
    )


# ------------------------------------------------------------------
# Clips
# ------------------------------------------------------------------

def test_insert_clip_returns_id(db: Database) -> None:
    row_id = db.insert_clip(_make_record("aaa"))
    assert isinstance(row_id, int)
    assert row_id > 0


def test_insert_clip_callable_interface(db: Database) -> None:
    row_id = db(_make_record("bbb"))
    assert row_id > 0


def test_clip_exists_by_sha256_true(db: Database) -> None:
    db.insert_clip(_make_record("ccc"))
    assert db.clip_exists_by_sha256("ccc") is True


def test_clip_exists_by_sha256_false(db: Database) -> None:
    assert db.clip_exists_by_sha256("nonexistent") is False


def test_duplicate_clip_returns_existing_id(db: Database) -> None:
    first_id = db.insert_clip(_make_record("dup123"))
    dup = _make_record("dup123", already_existed=True)
    second_id = db.insert_clip(dup)
    assert second_id == first_id


def test_insert_clip_stores_source_type(db: Database) -> None:
    db.insert_clip(_make_record("eee"))
    assert db._conn is not None
    row = db._conn.execute("SELECT source_type FROM clips WHERE sha256='eee'").fetchone()
    assert row["source_type"] == "manual_mp4"


def test_insert_clip_stores_null_capture_at(db: Database) -> None:
    db.insert_clip(_make_record("fff"))
    assert db._conn is not None
    row = db._conn.execute("SELECT capture_at FROM clips WHERE sha256='fff'").fetchone()
    assert row["capture_at"] is None


# ------------------------------------------------------------------
# Detections
# ------------------------------------------------------------------

def test_insert_detection_returns_id(db: Database) -> None:
    clip_id = db.insert_clip(_make_record("ggg"))
    det_id = db.insert_detection(_make_detection(clip_id))
    assert isinstance(det_id, int)
    assert det_id > 0


def test_insert_detection_stores_fields(db: Database) -> None:
    clip_id = db.insert_clip(_make_record("hhh"))
    db.insert_detection(_make_detection(clip_id))
    assert db._conn is not None
    row = db._conn.execute("SELECT * FROM detections").fetchone()
    assert row["pet_class"] == 0
    assert abs(row["confidence"] - 0.92) < 0.001
    assert row["frame_index"] == 5


# ------------------------------------------------------------------
# Query helpers
# ------------------------------------------------------------------

def test_list_clips_without_detections_returns_unprocessed(db: Database) -> None:
    clip_id = db.insert_clip(_make_record("iii"))
    pending = db.list_clips_without_detections()
    assert len(pending) == 1
    assert pending[0]["sha256"] == "iii"


def test_list_clips_without_detections_excludes_processed(db: Database) -> None:
    clip_id = db.insert_clip(_make_record("jjj"))
    db.insert_detection(_make_detection(clip_id))
    assert db.list_clips_without_detections() == []


# ------------------------------------------------------------------
# Context manager
# ------------------------------------------------------------------

def test_database_context_manager(tmp_path: Path) -> None:
    db_path = tmp_path / "ctx.db"
    with Database(db_path) as d:
        d.migrate()
        d.insert_clip(_make_record("kkk"))
    assert db_path.exists()
