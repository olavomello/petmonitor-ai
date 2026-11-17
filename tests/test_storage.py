"""Tests for the SQLite storage layer."""

from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
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


@pytest.fixture()
def empty_db(tmp_path: Path) -> Database:
    """A migrated DB whose pets table is empty (seed config absent)."""
    d = Database(tmp_path / "empty.db")
    d.connect()
    d.migrate(seed_config_path=tmp_path / "no-such-config.yaml")
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
        ingested_at=datetime(2026, 11, 16, 10, 0, tzinfo=UTC),
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
    db.insert_clip(_make_record("iii"))
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


# ------------------------------------------------------------------
# Pets — seed migration
# ------------------------------------------------------------------

_SEED_CONFIG = (
    "pets:\n"
    "  - id: 1\n"
    "    name: Branca\n"
    "    class_id: 0\n"
    "    color: '#00B4D8'\n"
    "  - id: 2\n"
    "    name: Marrie\n"
    "    class_id: 1\n"
    "    color: '#9B59B6'\n"
)


def _seeded_db(tmp_path: Path, config_text: str, name: str = "seed.db") -> Database:
    cfg = tmp_path / "app.yaml"
    cfg.write_text(config_text, encoding="utf-8")
    d = Database(tmp_path / name)
    d.connect()
    d.migrate(seed_config_path=cfg)
    return d


def test_migrate_seeds_pets_from_config(tmp_path: Path) -> None:
    d = _seeded_db(tmp_path, _SEED_CONFIG)
    pets = d.list_pets()
    assert {p["name"] for p in pets} == {"Branca", "Marrie"}
    # Branca and Marrie are both dogs — species comes from the known-pet map,
    # not the legacy class_id (0/1 were custom-trained ids, not COCO classes).
    assert all(p["species"] == "dog" for p in pets)
    assert {p["color"] for p in pets} == {"#00B4D8", "#9B59B6"}
    d.close()


def test_migrate_seed_is_idempotent(tmp_path: Path) -> None:
    cfg = tmp_path / "app.yaml"
    cfg.write_text(_SEED_CONFIG, encoding="utf-8")
    d = Database(tmp_path / "idem.db")
    d.connect()
    d.migrate(seed_config_path=cfg)
    d.migrate(seed_config_path=cfg)  # second run must not duplicate
    assert len(d.list_pets()) == 2
    d.close()


def test_migrate_seed_skips_when_config_missing(tmp_path: Path) -> None:
    d = Database(tmp_path / "noseed.db")
    d.connect()
    d.migrate(seed_config_path=tmp_path / "absent.yaml")
    assert d.list_pets() == []
    d.close()


def test_migrate_seed_unknown_pet_falls_back_to_dog(tmp_path: Path) -> None:
    d = _seeded_db(tmp_path, "pets:\n  - name: Rex\n    color: '#fff'\n", "unknown.db")
    pets = d.list_pets()
    assert len(pets) == 1
    assert pets[0]["species"] == "dog"
    d.close()


# ------------------------------------------------------------------
# Pets — CRUD helpers
# ------------------------------------------------------------------


def test_insert_and_get_pet(empty_db: Database) -> None:
    pid = empty_db.insert_pet("Rex", "dog", color="#111", breed="Lab", notes="good boy")
    pet = empty_db.get_pet(pid)
    assert pet is not None
    assert pet["name"] == "Rex"
    assert pet["species"] == "dog"
    assert pet["breed"] == "Lab"
    assert pet["notes"] == "good boy"
    assert pet["active"] == 1
    assert pet["trained_override"] is None
    assert pet["created_at"]
    assert pet["updated_at"]


def test_get_pet_missing_returns_none(empty_db: Database) -> None:
    assert empty_db.get_pet(999) is None


def test_list_pets_active_only_filter(empty_db: Database) -> None:
    empty_db.insert_pet("Alpha", "dog")
    beta = empty_db.insert_pet("Beta", "cat")
    empty_db.archive_pet(beta)
    assert {p["name"] for p in empty_db.list_pets(active_only=True)} == {"Alpha"}
    assert {p["name"] for p in empty_db.list_pets(active_only=False)} == {"Alpha", "Beta"}


def test_update_pet_changes_fields(empty_db: Database) -> None:
    pid = empty_db.insert_pet("Alpha", "dog")
    empty_db.update_pet(pid, name="Alpha2", color="#222", trained_override="model.onnx")
    pet = empty_db.get_pet(pid)
    assert pet is not None
    assert pet["name"] == "Alpha2"
    assert pet["color"] == "#222"
    assert pet["trained_override"] == "model.onnx"
    assert pet["species"] == "dog"  # untouched field unchanged


def test_update_pet_bumps_updated_at(empty_db: Database) -> None:
    pid = empty_db.insert_pet("Alpha", "dog")
    assert empty_db._conn is not None
    empty_db._conn.execute(
        "UPDATE pets SET updated_at = '2000-01-01 00:00:00' WHERE id = ?", (pid,)
    )
    empty_db._conn.commit()
    empty_db.update_pet(pid, color="#333")
    pet = empty_db.get_pet(pid)
    assert pet is not None
    assert pet["updated_at"] > "2000-01-01 00:00:00"


def test_archive_pet_is_soft_delete(empty_db: Database) -> None:
    pid = empty_db.insert_pet("Alpha", "dog")
    empty_db.archive_pet(pid)
    pet = empty_db.get_pet(pid)
    assert pet is not None  # row still present — never hard-deleted
    assert pet["active"] == 0
    assert empty_db.list_pets(active_only=True) == []


def test_count_active_pets_by_species(empty_db: Database) -> None:
    empty_db.insert_pet("A", "dog")
    empty_db.insert_pet("B", "dog")
    empty_db.insert_pet("C", "cat")
    archived = empty_db.insert_pet("D", "dog")
    empty_db.archive_pet(archived)
    assert empty_db.count_active_pets_by_species("dog") == 2
    assert empty_db.count_active_pets_by_species("cat") == 1


def test_pet_species_check_rejects_invalid(empty_db: Database) -> None:
    with pytest.raises(sqlite3.IntegrityError):
        empty_db.insert_pet("Fishy", "fish")


def test_pet_name_is_unique(empty_db: Database) -> None:
    empty_db.insert_pet("Dup", "dog")
    with pytest.raises(sqlite3.IntegrityError):
        empty_db.insert_pet("Dup", "cat")


# ------------------------------------------------------------------
# Pet references
# ------------------------------------------------------------------


def test_insert_and_list_pet_references(empty_db: Database) -> None:
    pid = empty_db.insert_pet("A", "dog")
    empty_db.insert_pet_reference(pid, "data/refs/a1.jpg")
    empty_db.insert_pet_reference(pid, "data/refs/a2.jpg", source="auto_crop")
    refs = empty_db.list_pet_references(pid)
    assert len(refs) == 2
    assert {r["source"] for r in refs} == {"upload", "auto_crop"}


def test_get_pet_reference(empty_db: Database) -> None:
    pid = empty_db.insert_pet("A", "dog")
    rid = empty_db.insert_pet_reference(pid, "x.jpg")
    ref = empty_db.get_pet_reference(rid)
    assert ref is not None
    assert ref["image_path"] == "x.jpg"
    assert ref["embedding"] is None
    assert ref["source"] == "upload"
    assert empty_db.get_pet_reference(999) is None


def test_count_pet_references(empty_db: Database) -> None:
    pid = empty_db.insert_pet("A", "dog")
    assert empty_db.count_pet_references(pid) == 0
    empty_db.insert_pet_reference(pid, "a.jpg")
    empty_db.insert_pet_reference(pid, "b.jpg")
    assert empty_db.count_pet_references(pid) == 2


def test_delete_pet_reference(empty_db: Database) -> None:
    pid = empty_db.insert_pet("A", "dog")
    rid = empty_db.insert_pet_reference(pid, "a.jpg")
    empty_db.delete_pet_reference(rid)
    assert empty_db.get_pet_reference(rid) is None
    assert empty_db.count_pet_references(pid) == 0


def test_set_reference_embedding(empty_db: Database) -> None:
    pid = empty_db.insert_pet("A", "dog")
    rid = empty_db.insert_pet_reference(pid, "a.jpg")
    blob = b"\x00\x01\x02\x03"
    empty_db.set_reference_embedding(rid, blob, "mobilenetv3s")
    ref = empty_db.get_pet_reference(rid)
    assert ref is not None
    assert ref["embedding"] == blob
    assert ref["embedding_model"] == "mobilenetv3s"


def test_pet_reference_source_check(empty_db: Database) -> None:
    pid = empty_db.insert_pet("A", "dog")
    with pytest.raises(sqlite3.IntegrityError):
        empty_db.insert_pet_reference(pid, "a.jpg", source="webcam")


def test_pet_reference_unique_pet_image(empty_db: Database) -> None:
    pid = empty_db.insert_pet("A", "dog")
    empty_db.insert_pet_reference(pid, "a.jpg")
    with pytest.raises(sqlite3.IntegrityError):
        empty_db.insert_pet_reference(pid, "a.jpg")


def test_delete_pet_cascades_references(empty_db: Database) -> None:
    pid = empty_db.insert_pet("A", "dog")
    empty_db.insert_pet_reference(pid, "a.jpg")
    empty_db.insert_pet_reference(pid, "b.jpg")
    assert empty_db._conn is not None
    empty_db._conn.execute("DELETE FROM pets WHERE id = ?", (pid,))
    empty_db._conn.commit()
    # ON DELETE CASCADE removed the references with the pet.
    assert empty_db.count_pet_references(pid) == 0
