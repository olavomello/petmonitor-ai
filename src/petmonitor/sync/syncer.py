"""Sync orchestrator — Blink API → download → ingest → detect."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from petmonitor.blink.adapter import BlinkAdapter
    from petmonitor.ingestion.ingestor import Ingestor
    from petmonitor.storage.database import Database
    from petmonitor.vision.detector import Detector

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    new_clips: int = 0
    duplicate_clips: int = 0
    detections: int = 0
    errors: list[str] = field(default_factory=list)


class Syncer:
    """Orchestrates one sync cycle: list → download → ingest → detect.

    Args:
        adapter: Connected BlinkAdapter.
        ingestor: Ingestor instance (handles dedup and storage).
        db: Open Database for writing detections.
        detector: Optional Detector; detection is skipped when None.
    """

    def __init__(
        self,
        adapter: "BlinkAdapter",
        ingestor: "Ingestor",
        db: "Database",
        detector: "Detector | None" = None,
    ) -> None:
        self._adapter = adapter
        self._ingestor = ingestor
        self._db = db
        self._detector = detector

    async def run(
        self,
        camera_name: str | None = None,
        detect: bool = True,
    ) -> SyncResult:
        """Run one full sync cycle and return a summary."""
        result = SyncResult()
        dest = self._ingestor.clips_dir

        try:
            clips = await self._adapter.list_clips(camera_name=camera_name)
        except Exception as exc:  # pragma: no cover — network errors
            logger.error("Failed to list clips: %s", exc)
            result.errors.append(str(exc))
            return result

        for clip in clips:
            await self._process_clip(clip, dest, detect, result)

        return result

    async def _process_clip(
        self,
        clip: object,
        dest: Path,
        detect: bool,
        result: SyncResult,
    ) -> None:
        try:
            local_path = await self._adapter.download_clip(clip, dest)  # type: ignore[attr-defined]
            record = self._ingestor.ingest_blink_clip(
                source_path=local_path,
                clip_url=getattr(clip, "url", ""),
                capture_at=getattr(clip, "created_at", None),
                downloaded_at=getattr(clip, "downloaded_at", None),
            )

            if record.already_existed:
                logger.debug("duplicate sha256=%s skipped", record.sha256[:12])
                result.duplicate_clips += 1
                return

            result.new_clips += 1

            if detect and self._detector is not None and record.clip_id is not None:
                dets = self._detector.detect_clip(record.local_path, record.clip_id)
                for det in dets:
                    self._db.insert_detection(det)
                result.detections += len(dets)

        except Exception as exc:
            logger.error("Error processing clip: %s", exc)
            result.errors.append(str(exc))
