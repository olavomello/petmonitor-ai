"""Tests for the auto-sync background scheduler."""

from __future__ import annotations

import asyncio
import importlib
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fresh_status():
    """Reload the scheduler module to reset the module-level status singleton."""
    if "petmonitor.sync.scheduler" in sys.modules:
        del sys.modules["petmonitor.sync.scheduler"]
    import petmonitor.sync.scheduler as mod
    return mod


def _make_mock_modules(tmp_path: Path, new_clips: int = 0, detections: int = 0, errors=None):
    """Return a sys.modules injection dict and the matching fake SyncResult."""
    fake_result = MagicMock(new_clips=new_clips, detections=detections, errors=errors or [])

    mock_syncer_instance = MagicMock()
    mock_syncer_instance.run = AsyncMock(return_value=fake_result)

    mock_adapter_cm = AsyncMock()
    mock_adapter_cm.__aenter__ = AsyncMock(return_value=MagicMock())
    mock_adapter_cm.__aexit__ = AsyncMock(return_value=None)

    mock_adapter_cls = MagicMock()
    mock_adapter_cls.from_env.return_value = mock_adapter_cm

    mock_blink_mod = MagicMock()
    mock_blink_mod.BlinkAdapter = mock_adapter_cls

    mock_db_instance = MagicMock()
    mock_db_cls = MagicMock(return_value=mock_db_instance)
    mock_db_mod = MagicMock()
    mock_db_mod.Database = mock_db_cls

    mock_syncer_cls = MagicMock(return_value=mock_syncer_instance)
    mock_syncer_mod = MagicMock()
    mock_syncer_mod.Syncer = mock_syncer_cls

    mock_ingestor_mod = MagicMock()
    mock_detector_mod = MagicMock()

    mocks = {
        "petmonitor.blink.adapter": mock_blink_mod,
        "petmonitor.ingestion.ingestor": mock_ingestor_mod,
        "petmonitor.storage.database": mock_db_mod,
        "petmonitor.sync.syncer": mock_syncer_mod,
        "petmonitor.vision.detector": mock_detector_mod,
    }
    return mocks, fake_result


# ---------------------------------------------------------------------------
# run_once — no credentials file
# ---------------------------------------------------------------------------

def test_run_once_skips_when_no_creds(tmp_path: Path) -> None:
    mod = _fresh_status()
    cfg = {
        "blink": {"credentials_file": str(tmp_path / "missing.json")},
        "storage": {"db_path": str(tmp_path / "pm.db"), "clips_dir": str(tmp_path / "clips")},
    }
    asyncio.run(mod.run_once(cfg))
    assert mod.status.last_synced_at is None
    assert mod.status.is_syncing is False


# ---------------------------------------------------------------------------
# run_once — successful sync
# ---------------------------------------------------------------------------

def test_run_once_updates_status_on_success(tmp_path: Path) -> None:
    mod = _fresh_status()

    creds = tmp_path / ".blink_creds.json"
    creds.write_text("{}")
    cfg = {
        "blink": {"credentials_file": str(creds), "max_clip_age_hours": 0},
        "storage": {
            "db_path": str(tmp_path / "pm.db"),
            "clips_dir": str(tmp_path / "clips"),
        },
    }
    mock_modules, _ = _make_mock_modules(tmp_path, new_clips=3, detections=7)

    with patch.dict(sys.modules, mock_modules):
        asyncio.run(mod.run_once(cfg))

    assert mod.status.last_new_clips == 3
    assert mod.status.last_detections == 7
    assert mod.status.last_errors == []
    assert mod.status.last_synced_at is not None
    assert mod.status.is_syncing is False


# ---------------------------------------------------------------------------
# run_once — exception during sync
# ---------------------------------------------------------------------------

def test_run_once_handles_exception_gracefully(tmp_path: Path) -> None:
    mod = _fresh_status()

    creds = tmp_path / ".blink_creds.json"
    creds.write_text("{}")
    cfg = {
        "blink": {"credentials_file": str(creds), "max_clip_age_hours": 0},
        "storage": {
            "db_path": str(tmp_path / "pm.db"),
            "clips_dir": str(tmp_path / "clips"),
        },
    }

    # Inject a Database whose connect() raises
    mock_db_instance = MagicMock()
    mock_db_instance.connect.side_effect = RuntimeError("boom")
    mock_db_cls = MagicMock(return_value=mock_db_instance)
    mock_db_mod = MagicMock()
    mock_db_mod.Database = mock_db_cls

    mocks = {
        "petmonitor.blink.adapter": MagicMock(),
        "petmonitor.ingestion.ingestor": MagicMock(),
        "petmonitor.storage.database": mock_db_mod,
        "petmonitor.sync.syncer": MagicMock(),
        "petmonitor.vision.detector": MagicMock(),
    }

    with patch.dict(sys.modules, mocks):
        asyncio.run(mod.run_once(cfg))  # must not raise

    assert mod.status.is_syncing is False
    assert mod.status.last_errors != []


# ---------------------------------------------------------------------------
# run_once — errors reported in result
# ---------------------------------------------------------------------------

def test_run_once_records_errors_from_result(tmp_path: Path) -> None:
    mod = _fresh_status()

    creds = tmp_path / ".blink_creds.json"
    creds.write_text("{}")
    cfg = {
        "blink": {"credentials_file": str(creds), "max_clip_age_hours": 0},
        "storage": {"db_path": str(tmp_path / "pm.db"), "clips_dir": str(tmp_path / "clips")},
    }
    mock_modules, _ = _make_mock_modules(tmp_path, errors=["camera offline"])

    with patch.dict(sys.modules, mock_modules):
        asyncio.run(mod.run_once(cfg))

    assert mod.status.last_errors == ["camera offline"]
    assert mod.status.last_synced_at is not None


# ---------------------------------------------------------------------------
# run_loop — exits cleanly on cancellation
# ---------------------------------------------------------------------------

def test_run_loop_cancels_cleanly(tmp_path: Path) -> None:
    mod = _fresh_status()
    cfg = {
        "blink": {"credentials_file": str(tmp_path / "missing.json")},
        "storage": {"db_path": str(tmp_path / "pm.db"), "clips_dir": str(tmp_path / "clips")},
    }

    async def _cancel_after_start():
        task = asyncio.create_task(mod.run_loop(cfg, interval_secs=9999))
        await asyncio.sleep(0.01)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    asyncio.run(_cancel_after_start())
    assert mod.status.enabled is False


# ---------------------------------------------------------------------------
# run_loop — sets enabled flag while running
# ---------------------------------------------------------------------------

def test_run_loop_enabled_flag(tmp_path: Path) -> None:
    mod = _fresh_status()
    cfg = {
        "blink": {"credentials_file": str(tmp_path / "missing.json")},
        "storage": {"db_path": str(tmp_path / "pm.db"), "clips_dir": str(tmp_path / "clips")},
    }

    seen_enabled: list[bool] = []
    original_run_once = mod.run_once

    async def _spy(c: dict) -> None:
        seen_enabled.append(mod.status.enabled)
        await original_run_once(c)

    async def _run() -> None:
        with patch.object(mod, "run_once", side_effect=_spy):
            task = asyncio.create_task(mod.run_loop(cfg, interval_secs=9999))
            await asyncio.sleep(0.05)
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    asyncio.run(_run())
    assert True in seen_enabled


# ---------------------------------------------------------------------------
# get_sync_status — returns expected shape
# ---------------------------------------------------------------------------

def test_get_sync_status_returns_expected_shape() -> None:
    mod = _fresh_status()
    # Directly call the same logic the endpoint uses
    s = mod.status
    result = {
        "enabled": s.enabled,
        "is_syncing": s.is_syncing,
        "last_synced_at": s.last_synced_at.isoformat() if s.last_synced_at else None,
        "last_new_clips": s.last_new_clips,
        "last_detections": s.last_detections,
        "last_errors": s.last_errors,
    }
    assert result["enabled"] is False
    assert result["last_synced_at"] is None
    assert result["last_new_clips"] == 0
    assert isinstance(result["last_errors"], list)
