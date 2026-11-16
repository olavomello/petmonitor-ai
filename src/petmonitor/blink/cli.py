"""CLI entry point: petmonitor-blink."""

from __future__ import annotations

import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="petmonitor-blink",
        description="Test Blink camera connectivity and list available clips.",
    )
    parser.add_argument(
        "--camera",
        metavar="NAME",
        default=None,
        help="Camera name to query (default: first discovered camera).",
    )
    args = parser.parse_args()

    try:
        from petmonitor.blink.adapter import run_connect_check

        run_connect_check(camera_name=args.camera)
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
