#!/usr/bin/env python3
"""Extract frames from ingested clips for manual labeling.

Writes JPEGs to datasets/images/raw/<clip_id>/<frame_index>.jpg.
Label them with LabelImg (YOLO format) or Roboflow, then split into
datasets/images/{train,val,test} and matching datasets/labels/ directories.

Usage:
    python scripts/extract_frames.py [--clip-id N] [--sample-rate 10] [-v]
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path


def main() -> None:  # pragma: no cover
    parser = argparse.ArgumentParser(description="Extract frames for labeling")
    parser.add_argument("--clip-id", type=int, default=None, metavar="N",
                        help="Extract from one clip only (default: all clips)")
    parser.add_argument("--sample-rate", type=int, default=10, metavar="N",
                        help="Save every N-th frame (default: 10)")
    parser.add_argument("--out", default="datasets/images/raw", metavar="DIR",
                        help="Output directory (default: datasets/images/raw)")
    parser.add_argument("--db", default=None, metavar="PATH")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s %(message)s",
    )
    log = logging.getLogger("extract_frames")

    import cv2
    import yaml

    with open("configs/app.yaml") as fh:
        cfg = yaml.safe_load(fh)

    from pathlib import Path as _Path
    from petmonitor.storage.database import Database

    db_path = _Path(args.db or cfg["storage"]["db_path"])
    out_root = _Path(args.out)

    with Database(db_path) as db:
        db.migrate()
        clips = db.list_clips()
        if args.clip_id is not None:
            clips = [c for c in clips if c["id"] == args.clip_id]

    total_frames = 0
    for clip in clips:
        clip_path = Path(clip["local_path"])
        if not clip_path.exists():
            log.warning("Clip not found on disk: %s", clip_path)
            continue

        cap = cv2.VideoCapture(str(clip_path))
        if not cap.isOpened():
            log.warning("Cannot open video: %s", clip_path)
            continue

        out_dir = out_root / str(clip["id"])
        out_dir.mkdir(parents=True, exist_ok=True)

        frame_index = 0
        saved = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_index % args.sample_rate == 0:
                out_file = out_dir / f"{frame_index:06d}.jpg"
                cv2.imwrite(str(out_file), frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
                saved += 1
            frame_index += 1
        cap.release()

        log.info("clip %d: %d frames → %d saved to %s", clip["id"], frame_index, saved, out_dir)
        total_frames += saved

    log.info("Done: %d frames extracted total", total_frames)
    print(f"Extracted {total_frames} frames to {out_root}")


if __name__ == "__main__":
    main()  # pragma: no cover
