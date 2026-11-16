"""CLI entry point for petmonitor-track."""

from __future__ import annotations

import argparse
import logging
import sys
import types


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Assign track IDs and pet identity to detections."
    )
    parser.add_argument(
        "--clip-id", type=int, default=None, metavar="N",
        help="Track a specific clip (default: all clips with detections but no tracks)",
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
        f"Tracking complete: {result['clips_processed']} clips, "
        f"{result['tracks_created']} tracks"
    )
    if result.get("errors"):
        for err in result["errors"]:
            print(f"  error: {err}", file=sys.stderr)
        sys.exit(1)


def _run(args: argparse.Namespace) -> dict:  # pragma: no cover
    from pathlib import Path

    import yaml

    from petmonitor.storage.database import Database
    from petmonitor.tracking.tracker import Tracker

    with open("configs/app.yaml") as fh:
        cfg = yaml.safe_load(fh)

    db_path = Path(args.db or cfg.get("storage", {}).get("db_path", "data/petmonitor.db"))

    with Database(db_path) as db:
        db.migrate()
        tracker = Tracker.from_config(cfg)

        clips = (
            [{"id": args.clip_id}]
            if args.clip_id is not None
            else db.list_clips_without_tracks()
        )

        clips_processed = 0
        tracks_created = 0
        errors: list[str] = []

        for clip in clips:
            try:
                raw = db.list_detections_for_clip(clip["id"])
                if not raw:
                    continue
                detections = [types.SimpleNamespace(**d) for d in raw]
                results = tracker.track_clip(clip["id"], detections)
                for r in results:
                    db.insert_track(
                        clip_id=r.clip_id,
                        track_id=r.track_id,
                        identity=r.identity,
                        confidence=r.confidence,
                        frame_start=r.frame_start,
                        frame_end=r.frame_end,
                        pet_id=r.pet_id,
                    )
                tracks_created += len(results)
                clips_processed += 1
            except Exception as exc:
                errors.append(f"clip {clip['id']}: {exc}")

    return {
        "clips_processed": clips_processed,
        "tracks_created": tracks_created,
        "errors": errors,
    }
