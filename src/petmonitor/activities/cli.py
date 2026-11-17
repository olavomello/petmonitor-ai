"""CLI entry point for petmonitor-analyse."""

from __future__ import annotations

import argparse
import logging
import sys


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Classify track activity states and store events."
    )
    parser.add_argument(
        "--clip-id", type=int, default=None, metavar="N",
        help="Analyse a specific clip (default: all tracks without activity events)",
    )
    parser.add_argument("--db", default=None, metavar="PATH",
                        help="Override SQLite database path from config")
    parser.add_argument(
        "--movement-threshold", type=float, default=None, metavar="PX",
        help="Pixel displacement to classify a track as moving (default: 30.0)",
    )
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
        f"Analysis complete: {result['tracks_processed']} tracks, "
        f"{result['events_created']} events, "
        f"{result['trajectory_points']} trajectory points"
    )
    if result.get("errors"):
        for err in result["errors"]:
            print(f"  error: {err}", file=sys.stderr)
        sys.exit(1)


def _run(args: argparse.Namespace) -> dict:  # pragma: no cover
    from pathlib import Path

    import yaml

    from petmonitor.activities.analyser import classify_track_state, extract_trajectory
    from petmonitor.storage.database import Database

    with open("configs/app.yaml") as fh:
        cfg = yaml.safe_load(fh)

    threshold = args.movement_threshold or cfg.get("activities", {}).get(
        "movement_threshold_px", 30.0
    )
    db_path = Path(args.db or cfg.get("storage", {}).get("db_path", "data/petmonitor.db"))

    with Database(db_path) as db:
        db.migrate()

        if args.clip_id is not None:
            tracks = [
                t for t in db.list_clips_without_activity_events()
                if t["clip_id"] == args.clip_id
            ]
        else:
            tracks = db.list_clips_without_activity_events()

        tracks_processed = 0
        events_created = 0
        trajectory_points = 0
        errors: list[str] = []

        for track in tracks:
            clip_id = track["clip_id"]
            track_id = track["track_id"]
            try:
                dets = db.list_detections_for_track(
                    clip_id, track["frame_start"], track["frame_end"]
                )
                state = classify_track_state(dets, threshold)
                db.insert_activity_event(
                    clip_id=clip_id,
                    track_id=track_id,
                    identity=track["identity"],
                    state=state,
                    frame_start=track["frame_start"],
                    frame_end=track["frame_end"],
                    pet_id=track["pet_id"],
                )
                traj = extract_trajectory(dets)
                if traj:
                    db.insert_trajectory_points(clip_id, track_id, traj)
                    trajectory_points += len(traj)
                events_created += 1
                tracks_processed += 1
            except Exception as exc:
                errors.append(f"clip {clip_id} track {track_id}: {exc}")

    return {
        "tracks_processed": tracks_processed,
        "events_created": events_created,
        "trajectory_points": trajectory_points,
        "errors": errors,
    }
