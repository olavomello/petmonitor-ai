"""CLI entry point: petmonitor-ingest."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="petmonitor-ingest",
        description="Ingest a local MP4 file into PetMonitor AI (manual import).",
    )
    parser.add_argument("--file", "-f", required=True, metavar="PATH", help="Path to the .mp4 file.")
    parser.add_argument(
        "--clips-dir",
        default="data/clips",
        metavar="DIR",
        help="Directory where clips are stored (default: data/clips).",
    )
    parser.add_argument(
        "--capture-at",
        default=None,
        metavar="ISO8601",
        help="Capture timestamp in ISO-8601 format, e.g. 2026-11-16T10:00:00Z (optional).",
    )
    args = parser.parse_args()

    from petmonitor.ingestion.ingestor import Ingestor, IngestorError

    capture_at = None
    if args.capture_at:
        from datetime import datetime

        try:
            capture_at = datetime.fromisoformat(args.capture_at.replace("Z", "+00:00"))
        except ValueError:
            print(f"Invalid --capture-at value: {args.capture_at}", file=sys.stderr)
            sys.exit(1)

    try:
        ingestor = Ingestor(clips_dir=Path(args.clips_dir))
        record = ingestor.ingest_manual(source_path=Path(args.file), capture_at=capture_at)
    except IngestorError as exc:
        print(f"Ingestion failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if record.already_existed:
        print(f"Already ingested (duplicate): {record.local_path}")
    else:
        print(f"Ingested: {record.local_path}")
    print(f"  sha256  : {record.sha256}")
    print(f"  source  : {record.source_type.value}")
    if record.capture_at:
        print(f"  captured: {record.capture_at.isoformat()}")
    print(f"  stored  : {record.ingested_at.isoformat()}")


if __name__ == "__main__":
    main()
