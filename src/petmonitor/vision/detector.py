"""YOLO-based pet detector — wraps Ultralytics inference over sampled video frames."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    clip_id: int
    frame_index: int
    timestamp_ms: float
    pet_class: int        # 0 = Branca, 1 = Marrie (matches dataset.yaml)
    confidence: float
    bbox_x: float         # top-left x (pixels)
    bbox_y: float         # top-left y (pixels)
    bbox_w: float         # width (pixels)
    bbox_h: float         # height (pixels)


class Detector:
    """Runs YOLO inference on every N-th frame of a video clip.

    Args:
        model_path: Path to .pt weights file or empty string for default yolov8n.pt.
        confidence: Minimum confidence threshold (0–1).
        sample_rate: Process every N-th frame (1 = every frame).
        device: Inference device — always "cpu" on this hardware.
        filter_classes: List of YOLO class IDs to keep; None = all classes.
    """

    def __init__(
        self,
        model_path: str = "",
        confidence: float = 0.40,
        sample_rate: int = 5,
        device: str = "cpu",
        filter_classes: list[int] | None = None,
    ) -> None:
        self._model_path = model_path or "yolov8n.pt"
        self._confidence = confidence
        self._sample_rate = sample_rate
        self._device = device
        self._filter_classes = filter_classes
        self._model: Any = None

    @classmethod
    def from_config(cls, cfg: dict) -> "Detector":
        det = cfg.get("detection", {})
        return cls(
            model_path=det.get("model_path", ""),
            confidence=det.get("confidence_threshold", 0.40),
            sample_rate=det.get("frame_sample_rate", 5),
            device=det.get("device", "cpu"),
            filter_classes=det.get("filter_classes"),
        )

    def _load_model(self) -> None:
        if self._model is None:
            from ultralytics import YOLO  # deferred: downloads weights on first call
            self._model = YOLO(self._model_path)

    def detect_clip(self, clip_path: Path, clip_id: int) -> list[Detection]:
        """Return all detections found in *clip_path*, identified as belonging to *clip_id*."""
        import cv2

        self._load_model()
        cap = cv2.VideoCapture(str(clip_path))
        if not cap.isOpened():
            logger.warning("Cannot open video: %s", clip_path)
            return []

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        detections: list[Detection] = []
        frame_index = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                if frame_index % self._sample_rate == 0:
                    results = self._model.predict(
                        frame,
                        conf=self._confidence,
                        device=self._device,
                        verbose=False,
                        classes=self._filter_classes,
                    )
                    ts = (frame_index / fps) * 1000.0
                    for result in results:
                        for box in result.boxes:
                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                            detections.append(
                                Detection(
                                    clip_id=clip_id,
                                    frame_index=frame_index,
                                    timestamp_ms=ts,
                                    pet_class=int(box.cls[0].item()),
                                    confidence=float(box.conf[0].item()),
                                    bbox_x=x1,
                                    bbox_y=y1,
                                    bbox_w=x2 - x1,
                                    bbox_h=y2 - y1,
                                )
                            )
                frame_index += 1
        finally:
            cap.release()

        logger.info("clip_id=%d  frames=%d  detections=%d", clip_id, frame_index, len(detections))
        return detections
