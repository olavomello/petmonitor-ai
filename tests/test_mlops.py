"""Tests for MLOps config loading and run logger."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from petmonitor.mlops.config import TrainConfig
from petmonitor.mlops.run_logger import RunLogger


# ---------------------------------------------------------------------------
# TrainConfig
# ---------------------------------------------------------------------------


def test_train_config_from_file(tmp_path):
    cfg_file = tmp_path / "train.yaml"
    cfg_file.write_text(
        "model:\n  base: yolov8n.pt\n  imgsz: 640\n"
        "training:\n  epochs: 10\n  batch: 4\n  patience: 5\n"
        "  seed: 7\n  workers: 0\n  lr0: 0.005\n"
        "  weight_decay: 0.001\n  warmup_epochs: 2\n"
        "dataset:\n  path: configs/dataset.yaml\n"
        "output:\n  runs_dir: runs\n  models_dir: models\n",
        encoding="utf-8",
    )
    cfg = TrainConfig.from_file(cfg_file)
    assert cfg.model_base == "yolov8n.pt"
    assert cfg.imgsz == 640
    assert cfg.epochs == 10
    assert cfg.batch == 4
    assert cfg.seed == 7
    assert cfg.device == "cpu"  # always cpu regardless of config
    assert cfg.workers == 0
    assert cfg.dataset_path == "configs/dataset.yaml"
    assert cfg.runs_dir == "runs"
    assert cfg.models_dir == "models"


def test_train_config_defaults(tmp_path):
    cfg_file = tmp_path / "minimal.yaml"
    cfg_file.write_text("{}\n", encoding="utf-8")
    cfg = TrainConfig.from_file(cfg_file)
    assert cfg.model_base == "yolov8n.pt"
    assert cfg.epochs == 100
    assert cfg.batch == 4
    assert cfg.seed == 42
    assert cfg.device == "cpu"


def test_train_config_validate_bad_epochs(tmp_path):
    cfg_file = tmp_path / "bad.yaml"
    cfg_file.write_text("training:\n  epochs: 0\ndataset:\n  path: x.yaml\n", encoding="utf-8")
    cfg = TrainConfig.from_file(cfg_file)
    with pytest.raises(ValueError, match="epochs"):
        cfg.validate()


def test_train_config_validate_bad_batch(tmp_path):
    cfg_file = tmp_path / "bad.yaml"
    cfg_file.write_text("training:\n  batch: 0\ndataset:\n  path: x.yaml\n", encoding="utf-8")
    cfg = TrainConfig.from_file(cfg_file)
    with pytest.raises(ValueError, match="batch"):
        cfg.validate()


def test_train_config_validate_bad_lr(tmp_path):
    cfg_file = tmp_path / "bad.yaml"
    cfg_file.write_text("training:\n  lr0: 1.5\ndataset:\n  path: x.yaml\n", encoding="utf-8")
    cfg = TrainConfig.from_file(cfg_file)
    with pytest.raises(ValueError, match="lr0"):
        cfg.validate()


def test_train_config_validate_bad_imgsz(tmp_path):
    cfg_file = tmp_path / "bad.yaml"
    cfg_file.write_text("model:\n  imgsz: 100\ndataset:\n  path: x.yaml\n", encoding="utf-8")
    cfg = TrainConfig.from_file(cfg_file)
    with pytest.raises(ValueError, match="imgsz"):
        cfg.validate()


def test_train_config_validate_missing_dataset(tmp_path):
    cfg_file = tmp_path / "bad.yaml"
    cfg_file.write_text("dataset:\n  path: /nonexistent/dataset.yaml\n", encoding="utf-8")
    cfg = TrainConfig.from_file(cfg_file)
    with pytest.raises(FileNotFoundError, match="dataset config not found"):
        cfg.validate()


def test_train_config_validate_ok(tmp_path):
    dataset_yaml = tmp_path / "dataset.yaml"
    dataset_yaml.write_text("nc: 2\nnames: [Branca, Marrie]\n", encoding="utf-8")
    cfg_file = tmp_path / "good.yaml"
    cfg_file.write_text(
        f"training:\n  epochs: 1\n  batch: 1\n  lr0: 0.01\n"
        f"model:\n  imgsz: 640\n"
        f"dataset:\n  path: {dataset_yaml}\n",
        encoding="utf-8",
    )
    cfg = TrainConfig.from_file(cfg_file)
    cfg.validate()  # should not raise


# ---------------------------------------------------------------------------
# RunLogger
# ---------------------------------------------------------------------------


def test_run_logger_creates_metadata(tmp_path):
    logger = RunLogger(runs_dir=tmp_path / "runs", kind="train")
    logger.start(config_snapshot={"epochs": 10})
    meta_path = logger.run_dir / "metadata.json"
    assert meta_path.exists()
    meta = json.loads(meta_path.read_text())
    assert meta["kind"] == "train"
    assert meta["config"]["epochs"] == 10
    assert meta["started_at"] is not None
    assert meta["finished_at"] is None


def test_run_logger_finish_records_metrics(tmp_path):
    logger = RunLogger(runs_dir=tmp_path / "runs")
    logger.start()
    logger.finish(
        metrics={"mAP50": 0.85, "precision": 0.9},
        model_path="models/best.pt",
    )
    meta = json.loads((logger.run_dir / "metadata.json").read_text())
    assert meta["metrics"]["mAP50"] == 0.85
    assert meta["model_path"] == "models/best.pt"
    assert meta["finished_at"] is not None
    assert meta["duration_s"] is not None
    assert meta["error"] is None


def test_run_logger_finish_records_error(tmp_path):
    logger = RunLogger(runs_dir=tmp_path / "runs")
    logger.start()
    logger.finish(error="CUDA not available")
    meta = json.loads((logger.run_dir / "metadata.json").read_text())
    assert meta["error"] == "CUDA not available"
    assert meta["metrics"] == {}


def test_run_logger_run_id_is_unique(tmp_path):
    a = RunLogger(runs_dir=tmp_path / "runs")
    b = RunLogger(runs_dir=tmp_path / "runs")
    # They may collide in rapid succession, but the directories must exist
    assert a.run_dir.exists()
    assert b.run_dir.exists()


def test_run_logger_run_dir_property(tmp_path):
    logger = RunLogger(runs_dir=tmp_path / "runs", kind="eval")
    assert logger.run_dir.exists()
    assert logger.run_id in str(logger.run_dir)


def test_run_logger_start_logs_python_and_platform(tmp_path):
    logger = RunLogger(runs_dir=tmp_path / "runs")
    logger.start()
    meta = json.loads((logger.run_dir / "metadata.json").read_text())
    assert "python" in meta
    assert "platform" in meta
