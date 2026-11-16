"""Tests for the ingestion CLI entry point."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest


def _run_main(args: list[str]) -> None:
    """Call petmonitor.ingestion.cli.main with the given argv."""
    import sys

    with patch.object(sys, "argv", ["petmonitor-ingest"] + args):
        from petmonitor.ingestion import cli

        cli.main()


@pytest.fixture()
def sample_mp4(tmp_path: Path) -> Path:
    p = tmp_path / "test.mp4"
    p.write_bytes(b"\x00" * 512)
    return p


def test_cli_manual_ingest_ok(sample_mp4: Path, tmp_path: Path, capsys) -> None:
    clips_dir = tmp_path / "clips"
    _run_main(["--file", str(sample_mp4), "--clips-dir", str(clips_dir)])
    out = capsys.readouterr().out
    assert "Ingested" in out


def test_cli_manual_ingest_duplicate(sample_mp4: Path, tmp_path: Path, capsys) -> None:
    clips_dir = tmp_path / "clips"
    _run_main(["--file", str(sample_mp4), "--clips-dir", str(clips_dir)])
    _run_main(["--file", str(sample_mp4), "--clips-dir", str(clips_dir)])
    out = capsys.readouterr().out
    assert "Already ingested" in out


def test_cli_capture_at_valid(sample_mp4: Path, tmp_path: Path, capsys) -> None:
    clips_dir = tmp_path / "clips"
    _run_main(
        [
            "--file", str(sample_mp4),
            "--clips-dir", str(clips_dir),
            "--capture-at", "2026-11-16T10:00:00Z",
        ]
    )
    out = capsys.readouterr().out
    assert "captured" in out


def test_cli_capture_at_invalid(sample_mp4: Path, tmp_path: Path) -> None:
    clips_dir = tmp_path / "clips"
    with pytest.raises(SystemExit) as exc_info:
        _run_main(
            [
                "--file", str(sample_mp4),
                "--clips-dir", str(clips_dir),
                "--capture-at", "not-a-date",
            ]
        )
    assert exc_info.value.code == 1


def test_cli_missing_file_exits(tmp_path: Path) -> None:
    with pytest.raises(SystemExit) as exc_info:
        _run_main(["--file", str(tmp_path / "missing.mp4")])
    assert exc_info.value.code == 1


def test_cli_prints_sha256(sample_mp4: Path, tmp_path: Path, capsys) -> None:
    clips_dir = tmp_path / "clips"
    _run_main(["--file", str(sample_mp4), "--clips-dir", str(clips_dir)])
    out = capsys.readouterr().out
    assert "sha256" in out


def test_cli_prints_source_type(sample_mp4: Path, tmp_path: Path, capsys) -> None:
    clips_dir = tmp_path / "clips"
    _run_main(["--file", str(sample_mp4), "--clips-dir", str(clips_dir)])
    out = capsys.readouterr().out
    assert "manual_mp4" in out
