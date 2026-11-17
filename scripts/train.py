#!/usr/bin/env python3
"""Fine-tune YOLO on the PetMonitor AI 2-class dataset (Branca=0, Marrie=1).

Usage:
    python scripts/train.py [--config configs/train.yaml] [-v]

All runs use CPU only (hardware constraint: no NVIDIA GPU).  Every run writes
metadata.json to runs/<timestamp>/ so results are always reproducible.
"""

from __future__ import annotations

import argparse
import logging
import shutil
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# This script is an entry point for the ML pipeline.  The actual training
# calls are in the pragma: no cover block below so the unit tests do not need
# a GPU or labeled dataset to pass the coverage gate.
# ---------------------------------------------------------------------------


def main() -> None:  # pragma: no cover
    parser = argparse.ArgumentParser(description="Fine-tune YOLO for PetMonitor AI")
    parser.add_argument(
        "--config", default="configs/train.yaml", metavar="PATH",
        help="Training config (default: configs/train.yaml)"
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s %(message)s",
    )
    log = logging.getLogger("train")

    from petmonitor.mlops.config import TrainConfig
    from petmonitor.mlops.run_logger import RunLogger

    cfg = TrainConfig.from_file(Path(args.config))
    try:
        cfg.validate()
    except (ValueError, FileNotFoundError) as exc:
        print(f"Config error: {exc}", file=sys.stderr)
        sys.exit(1)

    logger = RunLogger(runs_dir=Path(cfg.runs_dir), kind="train")
    logger.start(config_snapshot={
        "model_base": cfg.model_base,
        "imgsz": cfg.imgsz,
        "epochs": cfg.epochs,
        "batch": cfg.batch,
        "patience": cfg.patience,
        "seed": cfg.seed,
        "device": cfg.device,
        "dataset": cfg.dataset_path,
    })
    log.info("Run %s started — output: %s", logger.run_id, logger.run_dir)

    error: str | None = None
    metrics: dict = {}
    model_path: str | None = None

    try:
        from ultralytics import YOLO

        model = YOLO(cfg.model_base)
        results = model.train(
            data=cfg.dataset_path,
            epochs=cfg.epochs,
            imgsz=cfg.imgsz,
            batch=cfg.batch,
            patience=cfg.patience,
            seed=cfg.seed,
            workers=cfg.workers,
            lr0=cfg.lr0,
            weight_decay=cfg.weight_decay,
            warmup_epochs=cfg.warmup_epochs,
            device=cfg.device,
            project=str(logger.run_dir),
            name="yolo",
            exist_ok=True,
            verbose=args.verbose,
        )

        # Copy best weights to models/
        # results.save_dir is the actual directory Ultralytics used (it may add runs/detect/ prefix)
        best_src = Path(str(results.save_dir)) / "weights" / "best.pt"
        models_dir = Path(cfg.models_dir)
        models_dir.mkdir(parents=True, exist_ok=True)
        best_dst = models_dir / "best.pt"
        if best_src.exists():
            shutil.copy2(best_src, best_dst)
            model_path = str(best_dst)
            log.info("Best weights saved to %s", best_dst)

        # Extract scalar metrics
        if hasattr(results, "results_dict"):
            rd = results.results_dict
            metrics = {
                "mAP50": round(float(rd.get("metrics/mAP50(B)", 0)), 4),
                "mAP50_95": round(float(rd.get("metrics/mAP50-95(B)", 0)), 4),
                "precision": round(float(rd.get("metrics/precision(B)", 0)), 4),
                "recall": round(float(rd.get("metrics/recall(B)", 0)), 4),
            }
        log.info("Training complete: %s", metrics)

    except Exception as exc:
        error = str(exc)
        log.error("Training failed: %s", exc)

    logger.finish(metrics=metrics, model_path=model_path, error=error)
    log.info("Run metadata saved to %s/metadata.json", logger.run_dir)
    sys.exit(1 if error else 0)


if __name__ == "__main__":
    main()  # pragma: no cover
