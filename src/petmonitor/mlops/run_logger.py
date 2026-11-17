"""Run metadata logger — records every training or evaluation run to runs/<id>/."""

from __future__ import annotations

import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


class RunLogger:
    """Write structured JSON metadata for one training or evaluation run.

    Usage::

        logger = RunLogger(runs_dir=Path("runs"), kind="train")
        logger.start(config_snapshot={...})
        # ... run work ...
        logger.finish(metrics={"mAP50": 0.91}, model_path="models/best.pt")
    """

    def __init__(self, runs_dir: Path, kind: str = "train") -> None:
        self._run_id = _run_id()
        self._kind = kind
        self._run_dir = runs_dir / self._run_id
        self._run_dir.mkdir(parents=True, exist_ok=True)
        self._meta: dict[str, Any] = {}

    @property
    def run_dir(self) -> Path:
        return self._run_dir

    @property
    def run_id(self) -> str:
        return self._run_id

    def start(self, config_snapshot: dict[str, Any] | None = None) -> None:
        self._meta = {
            "run_id": self._run_id,
            "kind": self._kind,
            "started_at": _now_utc(),
            "finished_at": None,
            "duration_s": None,
            "python": sys.version,
            "platform": platform.platform(),
            "config": config_snapshot or {},
            "metrics": {},
            "model_path": None,
            "error": None,
        }
        self._start_ts = datetime.now(timezone.utc)
        self._write()

    def finish(
        self,
        metrics: dict[str, Any] | None = None,
        model_path: str | None = None,
        error: str | None = None,
    ) -> None:
        finished = datetime.now(timezone.utc)
        self._meta["finished_at"] = finished.isoformat(timespec="seconds")
        self._meta["duration_s"] = round((finished - self._start_ts).total_seconds(), 1)
        self._meta["metrics"] = metrics or {}
        self._meta["model_path"] = model_path
        self._meta["error"] = error
        self._write()

    def _write(self) -> None:
        path = self._run_dir / "metadata.json"
        path.write_text(json.dumps(self._meta, indent=2), encoding="utf-8")
