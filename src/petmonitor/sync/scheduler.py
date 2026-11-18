"""Background auto-sync scheduler for periodic Blink clip ingestion."""

from __future__ import annotations

import asyncio
import dataclasses
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclasses.dataclass
class SyncStatus:
    enabled: bool = False
    is_syncing: bool = False
    last_synced_at: Optional[datetime] = None
    last_new_clips: int = 0
    last_detections: int = 0
    last_errors: list[str] = dataclasses.field(default_factory=list)


# Module-level singleton — the API status endpoint reads this directly.
status = SyncStatus()


async def run_once(cfg: dict) -> None:
    """Run a single sync cycle. Updates *status* in place. Never raises."""
    import os

    from dotenv import load_dotenv

    creds_file = Path(cfg.get("blink", {}).get("credentials_file", "data/.blink_creds.json"))
    if not creds_file.exists():
        logger.debug("auto-sync: credentials file absent, skipping")
        return

    load_dotenv()
    if not os.environ.get("BLINK_USERNAME"):
        logger.debug("auto-sync: BLINK_USERNAME not set, skipping")
        return

    status.is_syncing = True
    try:
        from petmonitor.blink.adapter import BlinkAdapter
        from petmonitor.ingestion.ingestor import Ingestor
        from petmonitor.storage.database import Database
        from petmonitor.sync.syncer import Syncer
        from petmonitor.vision.detector import Detector

        storage = cfg.get("storage", {})
        clips_dir = Path(storage.get("clips_dir", "data/clips"))
        db_path = Path(storage.get("db_path", "data/petmonitor.db"))
        max_age = cfg.get("blink", {}).get("max_clip_age_hours", 0)

        db = Database(db_path)
        db.connect()
        try:
            ingestor = Ingestor(clips_dir=clips_dir, db_writer=db)
            detector = Detector.from_config(cfg)

            async with BlinkAdapter.from_env(credentials_file=creds_file) as adapter:
                syncer = Syncer(adapter=adapter, ingestor=ingestor, db=db, detector=detector)
                result = await syncer.run(max_age_hours=max_age)
        finally:
            db.close()

        status.last_synced_at = datetime.now(timezone.utc)
        status.last_new_clips = result.new_clips
        status.last_detections = result.detections
        status.last_errors = list(result.errors)

        logger.info(
            "auto-sync: %d new clip(s), %d detection(s)%s",
            result.new_clips,
            result.detections,
            f", {len(result.errors)} error(s)" if result.errors else "",
        )
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("auto-sync: unexpected error")
        status.last_errors = ["Sync failed — check server logs for details"]
    finally:
        status.is_syncing = False


async def run_loop(cfg: dict, interval_secs: int = 600) -> None:
    """Run *run_once* at startup and then every *interval_secs*. Exits on cancellation."""
    status.enabled = True
    try:
        while True:
            await run_once(cfg)
            await asyncio.sleep(interval_secs)
    except asyncio.CancelledError:
        pass
    finally:
        status.enabled = False
