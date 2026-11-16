"""Tests for the YOLO-based Detector."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from petmonitor.vision.detector import Detection, Detector


# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------

def test_from_config_reads_all_fields() -> None:
    cfg = {
        "detection": {
            "model_path": "my_model.pt",
            "confidence_threshold": 0.55,
            "frame_sample_rate": 10,
            "device": "cpu",
            "filter_classes": [16],
        }
    }
    d = Detector.from_config(cfg)
    assert d._model_path == "my_model.pt"
    assert d._confidence == 0.55
    assert d._sample_rate == 10
    assert d._device == "cpu"
    assert d._filter_classes == [16]


def test_from_config_defaults_on_empty() -> None:
    d = Detector.from_config({})
    assert d._model_path == "yolov8n.pt"
    assert d._confidence == 0.40
    assert d._sample_rate == 5
    assert d._device == "cpu"
    assert d._filter_classes is None


def test_empty_model_path_falls_back_to_default() -> None:
    d = Detector(model_path="")
    assert d._model_path == "yolov8n.pt"


# ------------------------------------------------------------------
# detect_clip — with mocked OpenCV and YOLO
# ------------------------------------------------------------------

def _make_mock_cap(frames: list) -> MagicMock:
    """Build a mock cv2.VideoCapture that yields the given frames."""
    cap = MagicMock()
    cap.isOpened.return_value = True
    cap.get.return_value = 30.0  # fps
    # read() returns (True, frame) for each frame, then (False, None)
    cap.read.side_effect = [(True, f) for f in frames] + [(False, None)]
    return cap


def _make_mock_box(cls_id: int = 0, conf: float = 0.9) -> MagicMock:
    box = MagicMock()
    box.xyxy = [MagicMock()]
    box.xyxy[0].tolist.return_value = [10.0, 20.0, 90.0, 80.0]
    box.cls = [MagicMock()]
    box.cls[0].item.return_value = cls_id
    box.conf = [MagicMock()]
    box.conf[0].item.return_value = conf
    return box


def test_detect_clip_returns_detections(tmp_path: Path) -> None:
    clip_path = tmp_path / "test.mp4"
    clip_path.touch()

    mock_frame = MagicMock()
    mock_cap = _make_mock_cap([mock_frame, mock_frame, mock_frame])

    mock_box = _make_mock_box(cls_id=1, conf=0.85)
    mock_result = MagicMock()
    mock_result.boxes = [mock_box]
    mock_model = MagicMock()
    mock_model.predict.return_value = [mock_result]

    detector = Detector(sample_rate=1)
    detector._model = mock_model

    with patch("cv2.VideoCapture", return_value=mock_cap):
        detections = detector.detect_clip(clip_path, clip_id=7)

    assert len(detections) == 3
    assert all(d.clip_id == 7 for d in detections)
    assert all(d.pet_class == 1 for d in detections)
    assert all(abs(d.confidence - 0.85) < 0.001 for d in detections)
    assert all(d.bbox_w == 80.0 for d in detections)
    assert all(d.bbox_h == 60.0 for d in detections)


def test_detect_clip_respects_sample_rate(tmp_path: Path) -> None:
    clip_path = tmp_path / "test.mp4"
    clip_path.touch()

    frames = [MagicMock()] * 10  # 10 frames
    mock_cap = _make_mock_cap(frames)

    mock_result = MagicMock()
    mock_result.boxes = [_make_mock_box()]
    mock_model = MagicMock()
    mock_model.predict.return_value = [mock_result]

    detector = Detector(sample_rate=5)
    detector._model = mock_model

    with patch("cv2.VideoCapture", return_value=mock_cap):
        detections = detector.detect_clip(clip_path, clip_id=1)

    # Frames 0 and 5 → predict called twice → 2 detections
    assert mock_model.predict.call_count == 2
    assert len(detections) == 2


def test_detect_clip_unopenable_video_returns_empty(tmp_path: Path) -> None:
    clip_path = tmp_path / "bad.mp4"
    clip_path.touch()

    mock_cap = MagicMock()
    mock_cap.isOpened.return_value = False

    detector = Detector()
    detector._model = MagicMock()

    with patch("cv2.VideoCapture", return_value=mock_cap):
        detections = detector.detect_clip(clip_path, clip_id=99)

    assert detections == []


def test_detect_clip_no_boxes_returns_empty(tmp_path: Path) -> None:
    clip_path = tmp_path / "empty.mp4"
    clip_path.touch()

    mock_cap = _make_mock_cap([MagicMock()])
    mock_result = MagicMock()
    mock_result.boxes = []
    mock_model = MagicMock()
    mock_model.predict.return_value = [mock_result]

    detector = Detector(sample_rate=1)
    detector._model = mock_model

    with patch("cv2.VideoCapture", return_value=mock_cap):
        detections = detector.detect_clip(clip_path, clip_id=1)

    assert detections == []


def test_detection_dataclass_fields() -> None:
    d = Detection(
        clip_id=1, frame_index=10, timestamp_ms=333.3,
        pet_class=0, confidence=0.95,
        bbox_x=5.0, bbox_y=5.0, bbox_w=50.0, bbox_h=50.0,
    )
    assert d.clip_id == 1
    assert d.pet_class == 0
