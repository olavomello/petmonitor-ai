#!/usr/bin/env python3
"""Evaluate a trained model on the held-out test split and report metrics.

Usage:
    python scripts/evaluate.py --weights models/best.pt [--split test] [-v]

Always reports abstention rate (Unknown tracks / total tracks) alongside the
standard YOLO metrics — hiding uncertainty is not acceptable (AGENTS.md §mlo).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path


def main() -> None:  # pragma: no cover
    parser = argparse.ArgumentParser(description="Evaluate a PetMonitor AI YOLO model")
    parser.add_argument(
        "--weights", default="models/best.pt", metavar="PATH",
        help="Path to .pt weights file (default: models/best.pt)"
    )
    parser.add_argument(
        "--split", default="test", choices=["train", "val", "test"],
        help="Dataset split to evaluate on (default: test)"
    )
    parser.add_argument(
        "--db", default=None, metavar="PATH",
        help="DB path to compute abstention rate from tracking results"
    )
    parser.add_argument(
        "--config", default="configs/train.yaml",
        help="Training config for dataset and output paths"
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s %(message)s",
    )
    log = logging.getLogger("evaluate")

    from petmonitor.mlops.config import TrainConfig
    from petmonitor.mlops.run_logger import RunLogger

    cfg = TrainConfig.from_file(Path(args.config))
    weights = Path(args.weights)
    if not weights.exists():
        print(f"Weights not found: {weights}", file=sys.stderr)
        sys.exit(1)

    logger = RunLogger(runs_dir=Path(cfg.runs_dir), kind="eval")
    logger.start(config_snapshot={"weights": str(weights), "split": args.split})
    log.info("Evaluating %s on split=%s", weights, args.split)

    error: str | None = None
    metrics: dict = {}

    try:
        from ultralytics import YOLO

        model = YOLO(str(weights))
        results = model.val(
            data=cfg.dataset_path,
            split=args.split,
            device=cfg.device,
            imgsz=cfg.imgsz,
            verbose=args.verbose,
        )

        if hasattr(results, "results_dict"):
            rd = results.results_dict
            metrics = {
                "mAP50": round(float(rd.get("metrics/mAP50(B)", 0)), 4),
                "mAP50_95": round(float(rd.get("metrics/mAP50-95(B)", 0)), 4),
                "precision": round(float(rd.get("metrics/precision(B)", 0)), 4),
                "recall": round(float(rd.get("metrics/recall(B)", 0)), 4),
            }

        # Abstention rate from DB tracks (Unknown / total)
        if args.db:
            import yaml
            import sqlite3
            conn = sqlite3.connect(args.db)
            total = conn.execute("SELECT COUNT(*) FROM tracks").fetchone()[0]
            unknown = conn.execute(
                "SELECT COUNT(*) FROM tracks WHERE identity = 'Unknown'"
            ).fetchone()[0]
            conn.close()
            metrics["abstention_rate"] = round(unknown / max(total, 1), 4)
            metrics["total_tracks"] = total
            metrics["unknown_tracks"] = unknown
            log.info(
                "Abstention: %d/%d = %.1f%%",
                unknown, total, metrics["abstention_rate"] * 100
            )

        log.info("Eval metrics: %s", json.dumps(metrics, indent=2))

    except Exception as exc:
        error = str(exc)
        log.error("Evaluation failed: %s", exc)

    logger.finish(metrics=metrics, model_path=str(weights), error=error)
    report_path = logger.run_dir / "metadata.json"
    log.info("Report saved to %s", report_path)
    print(json.dumps(metrics, indent=2))
    sys.exit(1 if error else 0)


if __name__ == "__main__":
    main()  # pragma: no cover
