"""Tests for Blink API routes — no network calls required."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from fastapi import HTTPException


# ------------------------------------------------------------------
# GET /cameras
# ------------------------------------------------------------------

def test_get_cameras_no_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    from petmonitor.api.blink_routes import get_blink_cameras
    result = get_blink_cameras()
    assert result == {"cameras": []}


def test_get_cameras_with_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / ".blink_cameras.json").write_text(
        json.dumps({"cameras": ["Cam1", "Cam2"]}), encoding="utf-8"
    )
    from petmonitor.api.blink_routes import get_blink_cameras
    result = get_blink_cameras()
    assert result["cameras"] == ["Cam1", "Cam2"]


def test_get_cameras_invalid_json(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / ".blink_cameras.json").write_text("not_json", encoding="utf-8")
    from petmonitor.api.blink_routes import get_blink_cameras
    result = get_blink_cameras()
    assert result == {"cameras": []}


# ------------------------------------------------------------------
# GET /status
# ------------------------------------------------------------------

def test_get_status_not_configured(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    from petmonitor.api.blink_routes import get_blink_status
    result = get_blink_status()
    assert result["status"] == "not_configured"
    assert result["has_pending_2fa"] is False


def test_get_status_configured(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / ".blink_creds.json").write_text(
        json.dumps({"token": "abc123", "uid": "xyz"}), encoding="utf-8"
    )
    from petmonitor.api.blink_routes import get_blink_status
    result = get_blink_status()
    assert result["status"] == "configured"


def test_get_status_invalid_creds_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / ".blink_creds.json").write_text("bad_json", encoding="utf-8")
    from petmonitor.api.blink_routes import get_blink_status
    result = get_blink_status()
    assert result["status"] == "file_invalid"


# ------------------------------------------------------------------
# GET /snapshot/{camera_name}
# ------------------------------------------------------------------

def test_snapshot_no_creds_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    from petmonitor.api.blink_routes import get_blink_snapshot
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_blink_snapshot("TestCamera"))
    assert exc_info.value.status_code == 404
    assert "not configured" in exc_info.value.detail.lower()


def test_snapshot_invalid_creds_json(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / ".blink_creds.json").write_text("not_json", encoding="utf-8")
    from petmonitor.api.blink_routes import get_blink_snapshot
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_blink_snapshot("TestCamera"))
    assert exc_info.value.status_code == 503


def test_snapshot_empty_creds(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / ".blink_creds.json").write_text("{}", encoding="utf-8")
    from petmonitor.api.blink_routes import get_blink_snapshot
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_blink_snapshot("TestCamera"))
    assert exc_info.value.status_code == 503
