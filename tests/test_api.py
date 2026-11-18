"""Tests for the local REST API routes (called directly, no HTTP layer needed)."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException

from petmonitor.api.routes import get_clip, get_pets, get_status, list_clips
from petmonitor.ingestion.ingestor import ClipRecord, SourceType
from petmonitor.storage.database import Database
from petmonitor.vision.detector import Detection


@pytest.fixture()
def db(tmp_path: Path) -> Database:
    d = Database(tmp_path / "api_test.db")
    d.connect()
    d.migrate()
    yield d
    d.close()


def _clip(sha: str = "abc") -> ClipRecord:
    return ClipRecord(
        clip_id=None,
        local_path=Path("/tmp/clip.mp4"),
        sha256=sha,
        source_type=SourceType.MANUAL_MP4,
        original_filename="clip.mp4",
        capture_at=None,
        ingested_at=datetime(2026, 11, 16, 10, 0, tzinfo=timezone.utc),
        already_existed=False,
    )


def _detection(clip_id: int, frame: int = 0) -> Detection:
    return Detection(
        clip_id=clip_id, frame_index=frame, timestamp_ms=0.0,
        pet_class=0, confidence=0.9,
        bbox_x=10.0, bbox_y=10.0, bbox_w=50.0, bbox_h=50.0,
    )


# ------------------------------------------------------------------
# /status
# ------------------------------------------------------------------

def test_status_empty_db(db: Database) -> None:
    result = get_status(db=db)
    assert result["clips"]["total"] == 0
    assert result["detections"]["total"] == 0
    assert result["tracks"]["total"] == 0
    assert "version" in result


def test_status_counts_are_correct(db: Database) -> None:
    clip_id = db.insert_clip(_clip("s1"))
    db.insert_detection(_detection(clip_id))
    db.insert_track(clip_id=clip_id, track_id=0, identity="Branca",
                    confidence=0.9, frame_start=0, frame_end=5, pet_id=1)
    result = get_status(db=db)
    assert result["clips"]["total"] == 1
    assert result["detections"]["total"] == 1
    assert result["tracks"]["total"] == 1


# ------------------------------------------------------------------
# /clips
# ------------------------------------------------------------------

def test_list_clips_empty(db: Database) -> None:
    result = list_clips(db=db)
    assert result == []


def test_list_clips_returns_entries(db: Database) -> None:
    db.insert_clip(_clip("c1"))
    db.insert_clip(_clip("c2"))
    result = list_clips(db=db)
    assert len(result) == 2


def test_list_clips_respects_limit(db: Database) -> None:
    for i in range(5):
        db.insert_clip(_clip(f"sha{i}"))
    result = list_clips(limit=2, offset=0, db=db)
    assert len(result) == 2


def test_list_clips_has_counts(db: Database) -> None:
    clip_id = db.insert_clip(_clip("cc1"))
    db.insert_detection(_detection(clip_id))
    result = list_clips(db=db)
    assert result[0]["detection_count"] == 1
    assert result[0]["track_count"] == 0


# ------------------------------------------------------------------
# /clips/{clip_id}
# ------------------------------------------------------------------

def test_get_clip_not_found_raises_404(db: Database) -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_clip(clip_id=999, db=db)
    assert exc_info.value.status_code == 404


def test_get_clip_returns_detail(db: Database) -> None:
    clip_id = db.insert_clip(_clip("det1"))
    db.insert_detection(_detection(clip_id))
    result = get_clip(clip_id=clip_id, db=db)
    assert result["id"] == clip_id
    assert len(result["detections"]) == 1
    assert result["tracks"] == []


def test_get_clip_includes_tracks(db: Database) -> None:
    clip_id = db.insert_clip(_clip("tk1"))
    db.insert_track(clip_id=clip_id, track_id=0, identity="Branca",
                    confidence=0.9, frame_start=0, frame_end=10, pet_id=1)
    result = get_clip(clip_id=clip_id, db=db)
    assert len(result["tracks"]) == 1
    assert result["tracks"][0]["identity"] == "Branca"


# ------------------------------------------------------------------
# /pets
# ------------------------------------------------------------------

@pytest.fixture()
def empty_db(tmp_path: Path) -> Database:
    """DB with schema but no seeded pets (non-existent seed config)."""
    d = Database(tmp_path / "empty.db")
    d.connect()
    d.migrate(seed_config_path=tmp_path / "no_config.yaml")
    yield d
    d.close()


def test_get_pets_returns_seeded_pets(db: Database) -> None:
    result = get_pets(db=db)
    assert len(result) == 2
    names = {p["name"] for p in result}
    assert names == {"Branca", "Marrie"}


def test_get_pets_zero_tracks_by_default(db: Database) -> None:
    result = get_pets(db=db)
    for pet in result:
        assert pet["track_count"] == 0
        assert pet["clip_count"] == 0


def test_get_pets_track_counts_updated(db: Database) -> None:
    clip_id = db.insert_clip(_clip("p1"))
    db.insert_track(clip_id=clip_id, track_id=0, identity="Branca",
                    confidence=0.9, frame_start=0, frame_end=5, pet_id=1)
    result = get_pets(db=db)
    branca = next(p for p in result if p["name"] == "Branca")
    assert branca["track_count"] == 1
    assert branca["clip_count"] == 1


def test_get_pets_empty_db_returns_empty_list(empty_db: Database) -> None:
    result = get_pets(db=empty_db)
    assert result == []
