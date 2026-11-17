"""Tests for admin API routes."""

from __future__ import annotations

from pathlib import Path

import pytest

from petmonitor.api.admin_routes import (
    BBoxItem,
    FrameUpdate,
    LabelsPayload,
    _label_path,
    _scan_frames,
    get_frame_labels,
    get_frame_stats,
    list_frames,
    list_runs,
    save_frame_labels,
    scan_frames,
    update_frame,
)
from petmonitor.storage.database import Database


@pytest.fixture()
def db(tmp_path: Path) -> Database:
    d = Database(tmp_path / "admin_test.db")
    d.connect()
    d.migrate()
    yield d
    d.close()


# ------------------------------------------------------------------
# _scan_frames helper
# ------------------------------------------------------------------

def test_scan_frames_registers_new_frames(tmp_path: Path, db: Database) -> None:
    clip_dir = tmp_path / "datasets" / "images" / "raw" / "5"
    clip_dir.mkdir(parents=True)
    (clip_dir / "frame_0001.jpg").write_bytes(b"fake")
    (clip_dir / "frame_0002.jpg").write_bytes(b"fake")

    result = _scan_frames(db, root=tmp_path)

    assert result["registered"] == 2
    assert result["total"] == 2


def test_scan_frames_skips_already_registered(tmp_path: Path, db: Database) -> None:
    clip_dir = tmp_path / "datasets" / "images" / "raw" / "5"
    clip_dir.mkdir(parents=True)
    (clip_dir / "frame_0001.jpg").write_bytes(b"fake")

    _scan_frames(db, root=tmp_path)
    result = _scan_frames(db, root=tmp_path)

    assert result["registered"] == 0
    assert result["total"] == 1


def test_scan_frames_missing_root(tmp_path: Path, db: Database) -> None:
    result = _scan_frames(db, root=tmp_path / "nonexistent")
    assert result["registered"] == 0
    assert result["total"] == 0


def test_scan_frames_parses_clip_id(tmp_path: Path, db: Database) -> None:
    clip_dir = tmp_path / "datasets" / "images" / "raw" / "42"
    clip_dir.mkdir(parents=True)
    (clip_dir / "frame_0007.jpg").write_bytes(b"fake")

    _scan_frames(db, root=tmp_path)
    frames = db.list_frames()

    assert len(frames) == 1
    assert frames[0]["clip_id"] == 42
    assert frames[0]["frame_index"] == 7


# ------------------------------------------------------------------
# Frame stats
# ------------------------------------------------------------------

def test_get_frame_stats_empty(db: Database) -> None:
    result = get_frame_stats(db=db)
    assert result == {"total": 0}


def test_get_frame_stats_counts(tmp_path: Path, db: Database) -> None:
    clip_dir = tmp_path / "datasets" / "images" / "raw" / "1"
    clip_dir.mkdir(parents=True)
    for i in range(3):
        (clip_dir / f"frame_{i:04d}.jpg").write_bytes(b"x")
    _scan_frames(db, root=tmp_path)

    db.update_frame_status(1, "keep")
    db.update_frame_status(2, "discard")

    stats = get_frame_stats(db=db)
    assert stats["total"] == 3
    assert stats["keep"] == 1
    assert stats["discard"] == 1
    assert stats["pending"] == 1


# ------------------------------------------------------------------
# list_frames
# ------------------------------------------------------------------

def test_list_frames_returns_all(tmp_path: Path, db: Database) -> None:
    clip_dir = tmp_path / "datasets" / "images" / "raw" / "1"
    clip_dir.mkdir(parents=True)
    for i in range(5):
        (clip_dir / f"frame_{i:04d}.jpg").write_bytes(b"x")
    _scan_frames(db, root=tmp_path)

    result = list_frames(db=db)
    assert result["total"] == 5
    assert len(result["frames"]) == 5


def test_list_frames_filter_by_status(tmp_path: Path, db: Database) -> None:
    clip_dir = tmp_path / "datasets" / "images" / "raw" / "1"
    clip_dir.mkdir(parents=True)
    for i in range(4):
        (clip_dir / f"frame_{i:04d}.jpg").write_bytes(b"x")
    _scan_frames(db, root=tmp_path)

    db.update_frame_status(1, "keep")
    db.update_frame_status(2, "keep")

    result = list_frames(status="keep", db=db)
    assert result["total"] == 2
    assert all(f["status"] == "keep" for f in result["frames"])


def test_list_frames_invalid_status_raises(db: Database) -> None:
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        list_frames(status="bad", db=db)
    assert exc.value.status_code == 422


# ------------------------------------------------------------------
# update_frame
# ------------------------------------------------------------------

def test_update_frame_changes_status(tmp_path: Path, db: Database) -> None:
    clip_dir = tmp_path / "datasets" / "images" / "raw" / "1"
    clip_dir.mkdir(parents=True)
    (clip_dir / "frame_0001.jpg").write_bytes(b"x")
    _scan_frames(db, root=tmp_path)

    result = update_frame(frame_id=1, body=FrameUpdate(status="keep"), db=db)
    assert result["status"] == "keep"


def test_update_frame_not_found_raises(db: Database) -> None:
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        update_frame(frame_id=9999, body=FrameUpdate(status="keep"), db=db)
    assert exc.value.status_code == 404


def test_update_frame_invalid_status_raises(db: Database) -> None:
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        update_frame(frame_id=1, body=FrameUpdate(status="wrong"), db=db)
    assert exc.value.status_code == 422


# ------------------------------------------------------------------
# list_runs
# ------------------------------------------------------------------

def test_list_runs_no_directory(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    result = list_runs()
    assert result == []


def test_list_runs_returns_entries(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    run_dir = tmp_path / "runs" / "detect" / "train1"
    run_dir.mkdir(parents=True)
    (run_dir / "weights").mkdir()
    (run_dir / "weights" / "best.pt").write_bytes(b"model")

    result = list_runs()
    assert len(result) == 1
    assert result[0]["name"] == "train1"
    assert result[0]["has_best_weights"] is True
    assert result[0]["has_metrics"] is False


def test_list_runs_reads_results_csv(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    run_dir = tmp_path / "runs" / "detect" / "train2"
    run_dir.mkdir(parents=True)
    csv = "epoch,mAP50\n1,0.45\n2,0.52\n"
    (run_dir / "results.csv").write_text(csv, encoding="utf-8")

    result = list_runs()
    assert result[0]["has_metrics"] is True
    assert result[0]["last_epoch"]["mAP50"] == "0.52"


# ------------------------------------------------------------------
# _label_path helper
# ------------------------------------------------------------------

def test_label_path_converts_images_to_labels() -> None:
    p = _label_path("datasets/images/raw/42/frame_000001.jpg")
    assert p == Path("datasets/labels/raw/42/frame_000001.txt")


# ------------------------------------------------------------------
# get_frame_labels / save_frame_labels
# ------------------------------------------------------------------

def _make_frame(db: Database, tmp_path: Path) -> dict:
    img_dir = tmp_path / "datasets" / "images" / "raw" / "1"
    img_dir.mkdir(parents=True)
    img = img_dir / "frame_000001.jpg"
    img.write_bytes(b"\xff\xd8\xff")
    db.insert_frames_bulk([{
        "clip_id": 1, "frame_index": 1, "file_path": img.as_posix(),
    }])
    return db.list_frames(limit=1)[0]


def test_get_frame_labels_no_file(
    monkeypatch: pytest.MonkeyPatch, db: Database, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)
    frame = _make_frame(db, tmp_path)
    result = get_frame_labels(frame["id"], db=db)
    assert result == {"labels": []}


def test_get_frame_labels_reads_file(
    monkeypatch: pytest.MonkeyPatch, db: Database, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)
    frame = _make_frame(db, tmp_path)
    label_dir = tmp_path / "datasets" / "labels" / "raw" / "1"
    label_dir.mkdir(parents=True)
    (label_dir / "frame_000001.txt").write_text("0 0.5 0.5 0.3 0.4\n1 0.2 0.3 0.1 0.15")
    result = get_frame_labels(frame["id"], db=db)
    assert len(result["labels"]) == 2
    assert result["labels"][0]["class_id"] == 0
    assert result["labels"][1]["class_id"] == 1


def test_get_frame_labels_not_found(db: Database) -> None:
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        get_frame_labels(9999, db=db)
    assert exc.value.status_code == 404


def test_save_frame_labels_writes_file_and_sets_labeled(
    monkeypatch: pytest.MonkeyPatch, db: Database, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)
    frame = _make_frame(db, tmp_path)
    payload = LabelsPayload(labels=[
        BBoxItem(class_id=0, cx=0.5, cy=0.5, w=0.3, h=0.4),
    ])
    updated = save_frame_labels(frame["id"], body=payload, db=db)
    assert updated["status"] == "labeled"
    label_file = tmp_path / "datasets" / "labels" / "raw" / "1" / "frame_000001.txt"
    assert label_file.exists()
    assert "0 0.500000" in label_file.read_text()


def test_save_frame_labels_empty_does_not_set_labeled(
    monkeypatch: pytest.MonkeyPatch, db: Database, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)
    frame = _make_frame(db, tmp_path)
    payload = LabelsPayload(labels=[])
    updated = save_frame_labels(frame["id"], body=payload, db=db)
    assert updated["status"] == "pending"


def test_save_frame_labels_not_found(db: Database) -> None:
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        save_frame_labels(9999, body=LabelsPayload(labels=[]), db=db)
    assert exc.value.status_code == 404
