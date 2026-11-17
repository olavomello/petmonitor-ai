"""Tests for activity state classification, trajectory extraction, and heatmaps."""

from __future__ import annotations

import math
import types

import pytest

from petmonitor.activities.analyser import (
    STATE_MOVING,
    STATE_NOT_VISIBLE,
    STATE_STATIONARY,
    classify_track_state,
    compute_heatmap,
    extract_trajectory,
    get_activity_summary,
)
from petmonitor.api.routes import get_activity, get_heatmap
from petmonitor.storage.database import Database


# ---------------------------------------------------------------------------
# classify_track_state
# ---------------------------------------------------------------------------


def _det(frame: int, x: float, y: float, w: float = 100.0, h: float = 80.0) -> dict:
    return {
        "frame_index": frame,
        "bbox_x": x,
        "bbox_y": y,
        "bbox_w": w,
        "bbox_h": h,
        "confidence": 0.9,
        "pet_class": 0,
        "timestamp_ms": float(frame * 100),
        "clip_id": 1,
    }


def test_classify_single_detection_is_stationary():
    assert classify_track_state([_det(0, 0, 0)]) == STATE_STATIONARY


def test_classify_empty_detections_is_stationary():
    assert classify_track_state([]) == STATE_STATIONARY


def test_classify_no_movement_is_stationary():
    dets = [_det(0, 100, 100), _det(1, 100, 100), _det(2, 100, 100)]
    assert classify_track_state(dets) == STATE_STATIONARY


def test_classify_small_displacement_is_stationary():
    # displacement < 30 px threshold
    dets = [_det(0, 0, 0), _det(5, 10, 10)]
    # hypot(10, 10) ≈ 14.14 < 30
    assert classify_track_state(dets) == STATE_STATIONARY


def test_classify_large_displacement_is_moving():
    dets = [_det(0, 0, 0), _det(5, 100, 100)]
    # center shift: (100+50)-(0+50)=100 in x, (100+40)-(0+40)=100 in y
    # hypot(100, 100) ≈ 141 > 30
    assert classify_track_state(dets) == STATE_MOVING


def test_classify_custom_threshold():
    dets = [_det(0, 0, 0), _det(1, 10, 10)]
    # With threshold=5 this should be moving
    assert classify_track_state(dets, movement_threshold_px=5.0) == STATE_MOVING


def test_classify_exact_threshold_is_moving():
    # Exactly at the threshold
    dets = [_det(0, 0, 0), _det(1, 30, 0)]
    # center x shifts by 30, y by 0 → hypot(30, 0) = 30.0 >= 30
    assert classify_track_state(dets) == STATE_MOVING


# ---------------------------------------------------------------------------
# extract_trajectory
# ---------------------------------------------------------------------------


def test_extract_trajectory_empty():
    assert extract_trajectory([]) == []


def test_extract_trajectory_ground_point():
    det = _det(5, 100.0, 200.0, w=60.0, h=80.0)
    result = extract_trajectory([det])
    assert len(result) == 1
    pt = result[0]
    assert pt["frame_index"] == 5
    assert pt["x_px"] == pytest.approx(100.0 + 60.0 / 2)   # 130.0
    assert pt["y_px"] == pytest.approx(200.0 + 80.0)        # 280.0


def test_extract_trajectory_multiple():
    dets = [_det(i, float(i * 10), float(i * 5)) for i in range(4)]
    result = extract_trajectory(dets)
    assert len(result) == 4
    for i, pt in enumerate(result):
        assert pt["frame_index"] == i
        assert pt["x_px"] == pytest.approx(i * 10 + 50.0)
        assert pt["y_px"] == pytest.approx(i * 5 + 80.0)


# ---------------------------------------------------------------------------
# compute_heatmap
# ---------------------------------------------------------------------------


def test_compute_heatmap_empty_returns_zero_grid():
    grid = compute_heatmap([], grid_w=10, grid_h=10)
    assert len(grid) == 10
    assert len(grid[0]) == 10
    assert all(grid[r][c] == 0 for r in range(10) for c in range(10))


def test_compute_heatmap_single_point_goes_to_top_left():
    points = [{"frame_index": 0, "x_px": 100.0, "y_px": 200.0}]
    grid = compute_heatmap(points, grid_w=5, grid_h=5)
    total = sum(grid[r][c] for r in range(5) for c in range(5))
    assert total == 1


def test_compute_heatmap_accumulates():
    points = [
        {"frame_index": i, "x_px": float(i), "y_px": float(i)}
        for i in range(10)
    ]
    grid = compute_heatmap(points, grid_w=5, grid_h=5)
    total = sum(grid[r][c] for r in range(5) for c in range(5))
    assert total == 10


def test_compute_heatmap_dimensions():
    points = [{"frame_index": 0, "x_px": 1.0, "y_px": 1.0}]
    grid = compute_heatmap(points, grid_w=20, grid_h=30)
    assert len(grid) == 30
    assert all(len(row) == 20 for row in grid)


# ---------------------------------------------------------------------------
# get_activity_summary
# ---------------------------------------------------------------------------


def _event(identity: str, state: str) -> dict:
    return {
        "identity": identity,
        "state": state,
        "clip_id": 1,
        "track_id": 1,
        "frame_start": 0,
        "frame_end": 10,
    }


def test_get_activity_summary_empty():
    assert get_activity_summary([]) == {}


def test_get_activity_summary_counts():
    events = [
        _event("Branca", STATE_MOVING),
        _event("Branca", STATE_STATIONARY),
        _event("Branca", STATE_MOVING),
        _event("Marrie", STATE_STATIONARY),
    ]
    summary = get_activity_summary(events)
    assert summary["Branca"][STATE_MOVING] == 2
    assert summary["Branca"][STATE_STATIONARY] == 1
    assert summary["Marrie"][STATE_STATIONARY] == 1
    assert summary["Marrie"][STATE_MOVING] == 0


def test_get_activity_summary_not_visible():
    events = [_event("Branca", STATE_NOT_VISIBLE)]
    summary = get_activity_summary(events)
    assert summary["Branca"][STATE_NOT_VISIBLE] == 1


# ---------------------------------------------------------------------------
# API routes — direct function calls (no HTTP layer)
# ---------------------------------------------------------------------------


@pytest.fixture
def db_with_activity(tmp_path):
    from pathlib import Path
    db = Database(Path(tmp_path / "test.db"))
    db.connect()
    db.migrate()

    # Insert clip
    class FakeRecord:
        sha256 = "abc" * 10 + "ab"
        local_path = "data/clip1.mp4"
        source_type = type("ST", (), {"value": "blink"})()
        original_filename = "clip1.mp4"
        capture_at = None
        already_existed = False
        ingested_at = __import__("datetime").datetime(2026, 1, 1, 12, 0, 0)

    clip_id = db.insert_clip(FakeRecord())

    # Insert tracks (required for list_trajectory_points JOIN)
    db.insert_track(clip_id=clip_id, track_id=1, identity="Branca",
                    confidence=0.9, frame_start=0, frame_end=10)
    db.insert_track(clip_id=clip_id, track_id=2, identity="Marrie",
                    confidence=0.8, frame_start=5, frame_end=15)

    # Insert activity events
    db.insert_activity_event(
        clip_id=clip_id, track_id=1, identity="Branca",
        state="moving", frame_start=0, frame_end=10
    )
    db.insert_activity_event(
        clip_id=clip_id, track_id=2, identity="Marrie",
        state="stationary", frame_start=5, frame_end=15
    )

    # Insert trajectory points
    db.insert_trajectory_points(clip_id, 1, [
        {"frame_index": i, "x_px": float(i * 10), "y_px": float(i * 5)}
        for i in range(5)
    ])

    yield db
    db.close()


def test_api_get_activity_all(db_with_activity):
    result = get_activity(db=db_with_activity)
    assert len(result["events"]) == 2
    assert "summary" in result
    assert "note" in result


def test_api_get_activity_filtered_by_identity(db_with_activity):
    result = get_activity(identity="Branca", db=db_with_activity)
    assert all(e["identity"] == "Branca" for e in result["events"])
    assert len(result["events"]) == 1


def test_api_get_activity_no_events(db_with_activity):
    result = get_activity(identity="Unknown", db=db_with_activity)
    assert result["events"] == []
    assert result["summary"] == {}


def test_api_get_heatmap_known_identity(db_with_activity):
    result = get_heatmap(identity="Branca", db=db_with_activity)
    assert result["identity"] == "Branca"
    assert result["point_count"] == 5
    assert len(result["grid"]) == 50
    assert len(result["grid"][0]) == 50
    assert "note" in result


def test_api_get_heatmap_unknown_identity_returns_empty_grid(db_with_activity):
    result = get_heatmap(identity="Unknown", db=db_with_activity)
    assert result["point_count"] == 0
    total = sum(result["grid"][r][c] for r in range(50) for c in range(50))
    assert total == 0


def test_api_get_heatmap_custom_grid_size(db_with_activity):
    result = get_heatmap(identity="Branca", grid_w=20, grid_h=10, db=db_with_activity)
    assert result["grid_w"] == 20
    assert result["grid_h"] == 10
    assert len(result["grid"]) == 10
    assert len(result["grid"][0]) == 20
