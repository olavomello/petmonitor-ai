"""CLI entry point for petmonitor-detect — runs YOLO detection on pending clips."""

from __future__ import annotations

import argparse
import logging
import sys


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run YOLO detection on clips that have no detections yet."
    )
    parser.add_argument(
        "--clip-id", type=int, default=None, metavar="N",
        help="Detect a specific clip (default: all clips without detections)",
    )
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
        result = _run(args)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(
        f"Detection complete: {result['clips_processed']} clips, "
        f"{result['detections_stored']} detections stored"
    )
    if result.get("errors"):
        for err in result["errors"]:
            print(f"  error: {err}", file=sys.stderr)
        sys.exit(1)


def _run(args: argparse.Namespace) -> dict:  # pragma: no cover
    from pathlib import Path

    import yaml

    from petmonitor.storage.database import Database
    from petmonitor.vision.detector import Detector

    with open("configs/app.yaml") as fh:
        cfg = yaml.safe_load(fh)

    db_path = Path(args.db or cfg.get("storage", {}).get("db_path", "data/petmonitor.db"))
    detector = Detector.from_config(cfg)

    with Database(db_path) as db:
        db.migrate()

        if args.clip_id is not None:
            clip = db.get_clip(args.clip_id)
            clips = [clip] if clip else []
        else:
            clips = db.list_clips_without_detections()

        clips_processed = 0
        detections_stored = 0
        errors: list[str] = []

        for clip in clips:
            try:
                local_path = Path(clip["local_path"])
                if not local_path.exists():
                    errors.append(f"clip {clip['id']}: file not found {local_path}")
                    continue
                dets = detector.detect_clip(local_path, clip["id"])
                for det in dets:
                    db.insert_detection(det)
                detections_stored += len(dets)
                clips_processed += 1
            except Exception as exc:
                errors.append(f"clip {clip['id']}: {exc}")

    return {
        "clips_processed": clips_processed,
        "detections_stored": detections_stored,
        "errors": errors,
    }
