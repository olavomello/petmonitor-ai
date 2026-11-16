"""Tests for the Blink CLI entry point."""

from __future__ import annotations

import sys
from unittest.mock import patch

import pytest


def _run_main(args: list[str]) -> None:
    with patch.object(sys, "argv", ["petmonitor-blink"] + args):
        from petmonitor.blink import cli

        cli.main()


def test_cli_calls_run_connect_check() -> None:
    with patch("petmonitor.blink.adapter.run_connect_check") as mock_check:
        _run_main([])
        mock_check.assert_called_once_with(camera_name=None)


def test_cli_passes_camera_name() -> None:
    with patch("petmonitor.blink.adapter.run_connect_check") as mock_check:
        _run_main(["--camera", "Living Room"])
        mock_check.assert_called_once_with(camera_name="Living Room")


def test_cli_exits_on_error() -> None:
    with patch(
        "petmonitor.blink.adapter.run_connect_check",
        side_effect=Exception("network error"),
    ):
        with pytest.raises(SystemExit) as exc_info:
            _run_main([])
        assert exc_info.value.code == 1
