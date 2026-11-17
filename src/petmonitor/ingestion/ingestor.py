"""Clip ingestor — intake, deduplication, and provenance recording.

Responsibilities:
- Accept a clip from the Blink adapter (ClipInfo) or a manual MP4 file path.
- Compute a content hash (SHA-256) for deduplication.
- Copy the clip to the configured storage directory.
- Record provenance: capture_at, downloaded_at, source_type, original_filename.
- Write an ingestion record to the database via the storage layer.
- Return a ClipRecord describing the ingested clip.

Manual MP4 import is a first-class path that works without Blink credentials.
"""

from __future__ import annotations

import hashlib
import logging
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class SourceType(str, Enum):
    BLINK_API = "blink_api"
    MANUAL_MP4 = "manual_mp4"


@dataclass(frozen=True)
class ClipRecord:
    """Immutable record for a successfully ingested clip."""

    clip_id: Optional[int]        # DB row ID (None if storage is not used)
    local_path: Path              # Where the file lives on disk
    sha256: str                   # Content hash for dedup
    source_type: SourceType
    original_filename: str
    capture_at: Optional[datetime]   # When the clip was recorded (from metadata)
    ingested_at: datetime            # When we stored it (always set)
    duration_seconds: Optional[float] = None
    already_existed: bool = False    # True if dedup matched an existing record


class IngestorError(Exception):
    """Base error raised by the ingestor."""


class DuplicateClipError(IngestorError):
    """The clip has already been ingested (content hash matched)."""

    def __init__(self, sha256: str, existing: ClipRecord) -> None:
        super().__init__(f"Duplicate clip (sha256={sha256[:12]}…)")
        self.sha256 = sha256
        self.existing = existing


class Ingestor:
    """Ingests clips from Blink or manual MP4 import.

    Args:
        clips_dir: Directory where clips are stored.
        db_writer: Optional callable that persists a ClipRecord and returns its ID.
                   If None, records are created without DB persistence (useful for tests).
    """

    def __init__(
        self,
        clips_dir: Path,
        db_writer=None,  # Optional[Callable[[ClipRecord], int]]
    ) -> None:
        self._clips_dir = clips_dir
        self._db_writer = db_writer
        self._clips_dir.mkdir(parents=True, exist_ok=True)

    @property
    def clips_dir(self) -> Path:
        return self._clips_dir

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def ingest_blink_clip(
        self,
        source_path: Path,
        clip_url: str,
        capture_at: Optional[datetime] = None,
        downloaded_at: Optional[datetime] = None,
    ) -> ClipRecord:
        """Ingest a clip previously downloaded from the Blink API.

        Args:
            source_path: Local path to the downloaded file.
            clip_url: Original Blink URL (used as source ID for dedup).
            capture_at: When the camera recorded the clip (from Blink metadata).
            downloaded_at: When the file was downloaded.

        Returns:
            A :class:`ClipRecord` with ``already_existed=True`` if the clip was
            already present, or a new record if it was just added.
        """
        return self._ingest(
            source_path=source_path,
            source_type=SourceType.BLINK_API,
            capture_at=capture_at,
            downloaded_at=downloaded_at or datetime.now(timezone.utc),
        )

    def ingest_manual(
        self,
        source_path: Path,
        capture_at: Optional[datetime] = None,
    ) -> ClipRecord:
        """Import a local MP4 file as a manual ingestion.

        This is the guaranteed fallback path and works without Blink credentials.

        Args:
            source_path: Path to the .mp4 (or any OpenCV-readable video file).
            capture_at: When the footage was recorded; pass None if unknown.

        Returns:
            A :class:`ClipRecord` describing the ingested clip.

        Raises:
            IngestorError: If the file does not exist or is not readable.
        """
        if not source_path.exists():
            raise IngestorError(f"File not found: {source_path}")
        if not source_path.is_file():
            raise IngestorError(f"Not a file: {source_path}")

        return self._ingest(
            source_path=source_path,
            source_type=SourceType.MANUAL_MP4,
            capture_at=capture_at,
            downloaded_at=None,
        )

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _ingest(
        self,
        source_path: Path,
        source_type: SourceType,
        capture_at: Optional[datetime],
        downloaded_at: Optional[datetime],
    ) -> ClipRecord:
        sha256 = _sha256(source_path)
        dest_filename = f"{sha256[:16]}_{source_path.name}"
        dest_path = self._clips_dir / dest_filename
        ingested_at = datetime.now(timezone.utc)

        already_existed = dest_path.exists()
        if not already_existed:
            shutil.copy2(source_path, dest_path)
            logger.info(
                "Ingested clip: %s → %s (sha256=%s…, source=%s)",
                source_path.name,
                dest_path,
                sha256[:12],
                source_type.value,
            )
        else:
            logger.info(
                "Clip already ingested: %s (sha256=%s…)",
                dest_filename,
                sha256[:12],
            )

        record = ClipRecord(
            clip_id=None,
            local_path=dest_path,
            sha256=sha256,
            source_type=source_type,
            original_filename=source_path.name,
            capture_at=capture_at,
            ingested_at=ingested_at,
            already_existed=already_existed,
        )

        if self._db_writer is not None:
            clip_id = self._db_writer(record)
            # ClipRecord is frozen; create a new one with the assigned ID.
            record = ClipRecord(
                clip_id=clip_id,
                local_path=record.local_path,
                sha256=record.sha256,
                source_type=record.source_type,
                original_filename=record.original_filename,
                capture_at=record.capture_at,
                ingested_at=record.ingested_at,
                already_existed=record.already_existed,
            )

        return record


def _sha256(path: Path) -> str:
    """Compute the SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()
