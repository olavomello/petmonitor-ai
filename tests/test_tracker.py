"""Unit tests for the IoU-based multi-object tracker."""

from __future__ import annotations

import types

import pytest

from petmonitor.tracking.tracker import TrackResult, Tracker, _iou


# ------------------------------------------------------------------
# _iou
# ------------------------------------------------------------------

def test_iou_no_overlap() -> None:
    assert _iou(0, 0, 10, 10, 20, 20, 10, 10) == 0.0


def test_iou_identical_boxes() -> None:
    assert abs(_iou(0, 0, 10, 10, 0, 0, 10, 10) - 1.0) < 1e-6


def test_iou_partial_overlap() -> None:
    # 5×10 overlap out of 200 total (100+100-50)
    score = _iou(0, 0, 10, 10, 5, 0, 10, 10)
    assert abs(score - 50 / 150) < 1e-6


def test_iou_touching_edges() -> None:
    assert _iou(0, 0, 10, 10, 10, 0, 10, 10) == 0.0


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------

def _det(frame: int, cls: int = 0, conf: float = 0.9,
         x: float = 10.0, y: float = 10.0, w: float = 50.0, h: float = 50.0):
    return types.SimpleNamespace(
        frame_index=frame, pet_class=cls, confidence=conf,
        bbox_x=x, bbox_y=y, bbox_w=w, bbox_h=h,
    )


# ------------------------------------------------------------------
# track_clip — basic cases
# ------------------------------------------------------------------

def test_track_clip_empty() -> None:
    tracker = Tracker()
    assert tracker.track_clip(1, []) == []


def test_track_clip_single_detection_produces_one_track() -> None:
    tracker = Tracker()
    results = tracker.track_clip(1, [_det(0)])
    assert len(results) == 1
    assert isinstance(results[0], TrackResult)
    assert results[0].clip_id == 1
    assert results[0].frame_start == 0
    assert results[0].frame_end == 0


def test_track_clip_same_object_across_frames() -> None:
    tracker = Tracker()
    # Same bounding box every 5 frames — should merge into one track
    dets = [_det(i * 5) for i in range(4)]
    results = tracker.track_clip(1, dets)
    assert len(results) == 1
    assert results[0].frame_start == 0
    assert results[0].frame_end == 15


def test_track_clip_two_separate_objects_produce_two_tracks() -> None:
    tracker = Tracker()
    # Object A: top-left; Object B: bottom-right, no overlap
    dets = [
        _det(0, x=0.0, y=0.0, w=50.0, h=50.0),
        _det(0, x=200.0, y=200.0, w=50.0, h=50.0),
    ]
    results = tracker.track_clip(1, dets)
    assert len(results) == 2


def test_track_clip_missing_frames_do_not_close_early() -> None:
    tracker = Tracker(max_missed=5)
    # Detection at frame 0 and frame 3 — 3 missed frames, within tolerance
    dets = [_det(0), _det(3)]
    results = tracker.track_clip(1, dets)
    assert len(results) == 1
    assert results[0].frame_end == 3


def test_track_clip_too_many_missed_frames_closes_track() -> None:
    tracker = Tracker(max_missed=2)
    # First detection, then nothing for 3 frames, then a new object
    dets = [_det(0), _det(10)]
    results = tracker.track_clip(1, dets)
    # Both produce separate tracks (10 frames missed > max_missed=2)
    assert len(results) == 2


# ------------------------------------------------------------------
# Identity resolution
# ------------------------------------------------------------------

def test_identity_unknown_without_identity_map() -> None:
    tracker = Tracker()
    results = tracker.track_clip(1, [_det(0, cls=0)])
    assert results[0].identity == "Unknown"
    assert results[0].pet_id is None


def test_identity_resolved_from_config() -> None:
    cfg = {"pets": [{"id": 1, "name": "Branca", "class_id": 0}]}
    tracker = Tracker.from_config(cfg)
    dets = [_det(i, cls=0) for i in range(5)]
    results = tracker.track_clip(1, dets)
    assert results[0].identity == "Branca"
    assert results[0].pet_id == 1
    assert results[0].confidence > 0


def test_identity_requires_vote_majority() -> None:
    # 3 votes for class 0, 7 votes for class 1
    cfg = {
        "pets": [
            {"id": 1, "name": "Branca", "class_id": 0},
            {"id": 2, "name": "Marrie", "class_id": 1},
        ]
    }
    tracker = Tracker.from_config(cfg)
    # All detections near the same bbox so they merge into one track
    dets = [_det(i, cls=(1 if i < 7 else 0)) for i in range(10)]
    results = tracker.track_clip(1, dets)
    assert len(results) == 1
    assert results[0].identity == "Marrie"


def test_identity_low_vote_ratio_gives_unknown() -> None:
    cfg = {"pets": [{"id": 1, "name": "Branca", "class_id": 0}]}
    # identity_confidence_threshold=0.5; only 3/10 votes for class 0
    tracker = Tracker.from_config(cfg)
    tracker._conf_threshold = 0.5
    # 3 votes for class 0, 7 for unknown class 99
    dets = [_det(i, cls=(0 if i < 3 else 99)) for i in range(10)]
    results = tracker.track_clip(1, dets)
    assert results[0].identity == "Unknown"


def test_from_config_builds_identity_map() -> None:
    cfg = {
        "pets": [
            {"id": 1, "name": "Branca", "class_id": 0},
            {"id": 2, "name": "Marrie", "class_id": 1},
        ]
    }
    tracker = Tracker.from_config(cfg)
    assert tracker._identity_map == {0: ("Branca", 1), 1: ("Marrie", 2)}
