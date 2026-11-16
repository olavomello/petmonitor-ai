"""CLI entry point for petmonitor-sync."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync Blink clips and run pet detection."
    )
    parser.add_argument("--camera", default=None, metavar="NAME",
                        help="Blink camera name to sync (default: all cameras)")
    parser.add_argument("--no-detect", action="store_true",
                        help="Download and ingest clips but skip YOLO detection")
    parser.add_argument("--clips-dir", default=None, metavar="DIR",
                        help="Override clips storage directory from config")
    parser.add_argument("--db", default=None, metavar="PATH",
                        help="Override SQLite database path from config")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Enable DEBUG logging")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s %(message)s",
    )

    try:
        result = asyncio.run(_run(args))
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(
        f"Sync complete: {result.new_clips} new, "
        f"{result.duplicate_clips} duplicates skipped, "
        f"{result.detections} detections"
    )
    if result.errors:
        for err in result.errors:
            print(f"  error: {err}", file=sys.stderr)
        sys.exit(1)


async def _run(args: argparse.Namespace) -> "SyncResult":  # pragma: no cover
    from pathlib import Path

    import yaml

    from petmonitor.blink.adapter import BlinkAdapter
    from petmonitor.ingestion.ingestor import Ingestor
    from petmonitor.storage.database import Database
    from petmonitor.sync.syncer import Syncer, SyncResult  # noqa: F401
    from petmonitor.vision.detector import Detector

    with open("configs/app.yaml") as fh:
        cfg = yaml.safe_load(fh)

    storage = cfg.get("storage", {})
    clips_dir = Path(args.clips_dir or storage.get("clips_dir", "data/clips"))
    db_path = Path(args.db or storage.get("db_path", "data/petmonitor.db"))

    db = Database(db_path)
    db.connect()
    db.migrate()

    ingestor = Ingestor(clips_dir=clips_dir, db_writer=db)
    detector = None if args.no_detect else Detector.from_config(cfg)

    async with BlinkAdapter.from_env() as adapter:
        syncer = Syncer(adapter=adapter, ingestor=ingestor, db=db, detector=detector)
        result = await syncer.run(camera_name=args.camera, detect=not args.no_detect)

    db.close()
    return result
