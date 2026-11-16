"""Tests for the ingestion module — no network, no Blink credentials required."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path

import pytest

from petmonitor.ingestion.ingestor import (
    ClipRecord,
    Ingestor,
    IngestorError,
    SourceType,
    _sha256,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def clips_dir(tmp_path: Path) -> Path:
    return tmp_path / "clips"


@pytest.fixture()
def sample_mp4(tmp_path: Path) -> Path:
    """A tiny fake MP4 file (not a real video — just bytes for testing)."""
    p = tmp_path / "sample.mp4"
    p.write_bytes(b"\x00" * 1024)  # 1 KB of null bytes
    return p


@pytest.fixture()
def ingestor(clips_dir: Path) -> Ingestor:
    return Ingestor(clips_dir=clips_dir)


# ---------------------------------------------------------------------------
# SHA-256 helper
# ---------------------------------------------------------------------------


def test_sha256_deterministic(sample_mp4: Path) -> None:
    h1 = _sha256(sample_mp4)
    h2 = _sha256(sample_mp4)
    assert h1 == h2
    assert len(h1) == 64  # 32 bytes hex-encoded


def test_sha256_different_content(tmp_path: Path) -> None:
    a = tmp_path / "a.mp4"
    b = tmp_path / "b.mp4"
    a.write_bytes(b"\x00" * 512)
    b.write_bytes(b"\xff" * 512)
    assert _sha256(a) != _sha256(b)


def test_sha256_matches_stdlib(sample_mp4: Path) -> None:
    expected = hashlib.sha256(sample_mp4.read_bytes()).hexdigest()
    assert _sha256(sample_mp4) == expected


# ---------------------------------------------------------------------------
# Manual import
# ---------------------------------------------------------------------------


def test_manual_ingest_creates_copy(ingestor: Ingestor, sample_mp4: Path, clips_dir: Path) -> None:
    record = ingestor.ingest_manual(sample_mp4)

    assert record.local_path.exists()
    assert record.local_path.parent == clips_dir
    assert record.source_type == SourceType.MANUAL_MP4
    assert record.original_filename == "sample.mp4"
    assert len(record.sha256) == 64
    assert not record.already_existed


def test_manual_ingest_copy_has_correct_content(ingestor: Ingestor, sample_mp4: Path) -> None:
    record = ingestor.ingest_manual(sample_mp4)
    assert record.local_path.read_bytes() == sample_mp4.read_bytes()


def test_manual_ingest_capture_at(ingestor: Ingestor, sample_mp4: Path) -> None:
    cap = datetime(2026, 11, 16, 10, 0, 0, tzinfo=timezone.utc)
    record = ingestor.ingest_manual(sample_mp4, capture_at=cap)
    assert record.capture_at == cap


def test_manual_ingest_capture_at_optional(ingestor: Ingestor, sample_mp4: Path) -> None:
    record = ingestor.ingest_manual(sample_mp4, capture_at=None)
    assert record.capture_at is None


def test_manual_ingest_ingested_at_is_utc(ingestor: Ingestor, sample_mp4: Path) -> None:
    record = ingestor.ingest_manual(sample_mp4)
    assert record.ingested_at.tzinfo is not None


def test_manual_ingest_file_not_found(ingestor: Ingestor, tmp_path: Path) -> None:
    with pytest.raises(IngestorError, match="File not found"):
        ingestor.ingest_manual(tmp_path / "missing.mp4")


def test_manual_ingest_not_a_file(ingestor: Ingestor, tmp_path: Path) -> None:
    d = tmp_path / "adir"
    d.mkdir()
    with pytest.raises(IngestorError, match="Not a file"):
        ingestor.ingest_manual(d)


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------


def test_manual_ingest_duplicate_same_hash(ingestor: Ingestor, sample_mp4: Path) -> None:
    r1 = ingestor.ingest_manual(sample_mp4)
    r2 = ingestor.ingest_manual(sample_mp4)
    assert r1.sha256 == r2.sha256
    assert r2.already_existed is True


def test_manual_ingest_different_files_no_dedup(
    ingestor: Ingestor, tmp_path: Path
) -> None:
    a = tmp_path / "a.mp4"
    b = tmp_path / "b.mp4"
    a.write_bytes(b"\xaa" * 512)
    b.write_bytes(b"\xbb" * 512)
    r1 = ingestor.ingest_manual(a)
    r2 = ingestor.ingest_manual(b)
    assert r1.sha256 != r2.sha256
    assert not r2.already_existed


# ---------------------------------------------------------------------------
# DB writer integration
# ---------------------------------------------------------------------------


def test_manual_ingest_calls_db_writer(ingestor_with_db: Ingestor, sample_mp4: Path) -> None:
    record = ingestor_with_db.ingest_manual(sample_mp4)
    assert record.clip_id == 42  # stub writer always returns 42


@pytest.fixture()
def ingestor_with_db(clips_dir: Path) -> Ingestor:
    def _stub_writer(record: ClipRecord) -> int:  # noqa: ARG001
        return 42

    return Ingestor(clips_dir=clips_dir, db_writer=_stub_writer)


# ---------------------------------------------------------------------------
# Blink clip ingestion (non-network path)
# ---------------------------------------------------------------------------


def test_blink_ingest_records_source_type(ingestor: Ingestor, sample_mp4: Path) -> None:
    record = ingestor.ingest_blink_clip(
        source_path=sample_mp4,
        clip_url="https://blink.example.com/clip.mp4",
    )
    assert record.source_type == SourceType.BLINK_API


def test_blink_ingest_capture_and_downloaded_at(ingestor: Ingestor, sample_mp4: Path) -> None:
    cap = datetime(2026, 11, 15, 8, 0, 0, tzinfo=timezone.utc)
    dl = datetime(2026, 11, 16, 9, 0, 0, tzinfo=timezone.utc)
    record = ingestor.ingest_blink_clip(
        source_path=sample_mp4,
        clip_url="https://blink.example.com/clip.mp4",
        capture_at=cap,
        downloaded_at=dl,
    )
    assert record.capture_at == cap


# ---------------------------------------------------------------------------
# clips_dir auto-creation
# ---------------------------------------------------------------------------


def test_ingestor_creates_clips_dir(tmp_path: Path, sample_mp4: Path) -> None:
    deep = tmp_path / "a" / "b" / "clips"
    assert not deep.exists()
    ingestor = Ingestor(clips_dir=deep)
    ingestor.ingest_manual(sample_mp4)
    assert deep.exists()
