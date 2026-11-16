"""Tests for the petmonitor-sync CLI entry point."""

from __future__ import annotations

import sys
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from petmonitor.sync.syncer import SyncResult


def _run_main(args: list[str]) -> None:
    with patch.object(sys, "argv", ["petmonitor-sync"] + args):
        from petmonitor.sync import cli
        cli.main()


def test_cli_prints_summary_on_success(capsys) -> None:
    result = SyncResult(new_clips=3, duplicate_clips=1, detections=5)
    with patch("asyncio.run", return_value=result):
        _run_main([])
    out = capsys.readouterr().out
    assert "3 new" in out
    assert "1 duplicates skipped" in out
    assert "5 detections" in out


def test_cli_no_detect_flag_accepted(capsys) -> None:
    result = SyncResult(new_clips=0, duplicate_clips=0, detections=0)
    with patch("asyncio.run", return_value=result):
        _run_main(["--no-detect"])
    out = capsys.readouterr().out
    assert "Sync complete" in out


def test_cli_camera_flag_accepted(capsys) -> None:
    result = SyncResult(new_clips=1, duplicate_clips=0, detections=0)
    with patch("asyncio.run", return_value=result):
        _run_main(["--camera", "Living Room"])
    out = capsys.readouterr().out
    assert "1 new" in out


def test_cli_exits_1_on_errors(capsys) -> None:
    result = SyncResult(new_clips=0, duplicate_clips=0, detections=0, errors=["timeout"])
    with patch("asyncio.run", return_value=result):
        with pytest.raises(SystemExit) as exc_info:
            _run_main([])
    assert exc_info.value.code == 1


def test_cli_exits_1_on_exception() -> None:
    with patch("asyncio.run", side_effect=Exception("connection refused")):
        with pytest.raises(SystemExit) as exc_info:
            _run_main([])
    assert exc_info.value.code == 1
