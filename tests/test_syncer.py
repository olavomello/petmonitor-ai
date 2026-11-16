"""Tests for the Syncer orchestrator."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from petmonitor.ingestion.ingestor import ClipRecord, SourceType
from petmonitor.sync.syncer import Syncer, SyncResult


def _clip_record(
    sha256: str = "abc",
    clip_id: int | None = 1,
    already_existed: bool = False,
    local_path: Path | None = None,
) -> ClipRecord:
    return ClipRecord(
        clip_id=clip_id,
        local_path=local_path or Path("/tmp/clip.mp4"),
        sha256=sha256,
        source_type=SourceType.BLINK_API,
        original_filename="clip.mp4",
        capture_at=datetime(2026, 11, 16, tzinfo=timezone.utc),
        ingested_at=datetime(2026, 11, 16, tzinfo=timezone.utc),
        already_existed=already_existed,
    )


def _make_clip(url: str = "https://blink.test/clip.mp4") -> MagicMock:
    clip = MagicMock()
    clip.url = url
    clip.created_at = datetime(2026, 11, 16, tzinfo=timezone.utc)
    clip.downloaded_at = datetime(2026, 11, 16, tzinfo=timezone.utc)
    return clip


def _make_syncer(clips=None, download_path=None, record=None, detector=None) -> Syncer:
    adapter = AsyncMock()
    adapter.list_clips = AsyncMock(return_value=clips or [])
    adapter.download_clip = AsyncMock(return_value=download_path or Path("/tmp/clip.mp4"))

    ingestor = MagicMock()
    ingestor.clips_dir = Path("/tmp/clips")
    ingestor.ingest_blink_clip.return_value = record or _clip_record()

    db = MagicMock()

    return Syncer(adapter=adapter, ingestor=ingestor, db=db, detector=detector)


# ------------------------------------------------------------------
# No clips
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_no_clips_returns_zero_counts() -> None:
    syncer = _make_syncer(clips=[])
    result = await syncer.run()
    assert result.new_clips == 0
    assert result.duplicate_clips == 0
    assert result.detections == 0
    assert result.errors == []


# ------------------------------------------------------------------
# New clip
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_new_clip_increments_new_clips() -> None:
    syncer = _make_syncer(clips=[_make_clip()])
    result = await syncer.run(detect=False)
    assert result.new_clips == 1
    assert result.duplicate_clips == 0


@pytest.mark.asyncio
async def test_sync_new_clip_with_detection(tmp_path: Path) -> None:
    local_path = tmp_path / "clip.mp4"
    local_path.write_bytes(b"\x00" * 100)
    record = _clip_record(clip_id=42, local_path=local_path)

    mock_det1, mock_det2 = MagicMock(), MagicMock()
    detector = MagicMock()
    detector.detect_clip.return_value = [mock_det1, mock_det2]

    syncer = _make_syncer(clips=[_make_clip()], download_path=local_path, record=record, detector=detector)
    result = await syncer.run(detect=True)

    assert result.new_clips == 1
    assert result.detections == 2
    detector.detect_clip.assert_called_once_with(local_path, 42)
    assert syncer._db.insert_detection.call_count == 2


@pytest.mark.asyncio
async def test_sync_no_detect_flag_skips_detector(tmp_path: Path) -> None:
    detector = MagicMock()
    detector.detect_clip.return_value = []

    syncer = _make_syncer(clips=[_make_clip()], detector=detector)
    result = await syncer.run(detect=False)

    assert result.detections == 0
    detector.detect_clip.assert_not_called()


@pytest.mark.asyncio
async def test_sync_none_detector_skips_detection() -> None:
    syncer = _make_syncer(clips=[_make_clip()], detector=None)
    result = await syncer.run(detect=True)
    assert result.detections == 0


@pytest.mark.asyncio
async def test_sync_no_clip_id_skips_detection(tmp_path: Path) -> None:
    record = _clip_record(clip_id=None)
    detector = MagicMock()

    syncer = _make_syncer(clips=[_make_clip()], record=record, detector=detector)
    result = await syncer.run(detect=True)

    detector.detect_clip.assert_not_called()
    assert result.detections == 0


# ------------------------------------------------------------------
# Duplicate clip
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_duplicate_increments_duplicate_count() -> None:
    record = _clip_record(already_existed=True)
    syncer = _make_syncer(clips=[_make_clip()], record=record)
    result = await syncer.run()

    assert result.duplicate_clips == 1
    assert result.new_clips == 0


@pytest.mark.asyncio
async def test_sync_duplicate_does_not_call_detector() -> None:
    record = _clip_record(already_existed=True)
    detector = MagicMock()
    syncer = _make_syncer(clips=[_make_clip()], record=record, detector=detector)
    await syncer.run(detect=True)
    detector.detect_clip.assert_not_called()


# ------------------------------------------------------------------
# Error handling
# ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_error_in_one_clip_continues_others() -> None:
    adapter = AsyncMock()
    adapter.list_clips = AsyncMock(return_value=[_make_clip("url1"), _make_clip("url2")])
    adapter.download_clip = AsyncMock(side_effect=[Exception("network error"), Path("/tmp/ok.mp4")])

    ingestor = MagicMock()
    ingestor.clips_dir = Path("/tmp/clips")
    ingestor.ingest_blink_clip.return_value = _clip_record(sha256="ok", clip_id=2)

    syncer = Syncer(adapter=adapter, ingestor=ingestor, db=MagicMock(), detector=None)
    result = await syncer.run(detect=False)

    assert result.new_clips == 1
    assert len(result.errors) == 1
    assert "network error" in result.errors[0]


@pytest.mark.asyncio
async def test_sync_multiple_clips_counted_correctly() -> None:
    clips = [_make_clip(f"url{i}") for i in range(3)]

    adapter = AsyncMock()
    adapter.list_clips = AsyncMock(return_value=clips)
    adapter.download_clip = AsyncMock(return_value=Path("/tmp/clip.mp4"))

    ingestor = MagicMock()
    ingestor.clips_dir = Path("/tmp/clips")
    ingestor.ingest_blink_clip.side_effect = [
        _clip_record(sha256="a", clip_id=1),
        _clip_record(sha256="b", clip_id=2, already_existed=True),
        _clip_record(sha256="c", clip_id=3),
    ]

    syncer = Syncer(adapter=adapter, ingestor=ingestor, db=MagicMock(), detector=None)
    result = await syncer.run(detect=False)

    assert result.new_clips == 2
    assert result.duplicate_clips == 1
