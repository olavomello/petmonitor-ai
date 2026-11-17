"""Training configuration loader and validator."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class TrainConfig:
    model_base: str
    imgsz: int
    epochs: int
    batch: int
    patience: int
    seed: int
    workers: int
    lr0: float
    weight_decay: float
    warmup_epochs: int
    device: str
    dataset_path: str
    runs_dir: str
    models_dir: str

    @classmethod
    def from_file(cls, path: Path) -> "TrainConfig":
        import yaml

        with open(path) as fh:
            raw = yaml.safe_load(fh)

        m = raw.get("model", {})
        t = raw.get("training", {})
        d = raw.get("dataset", {})
        o = raw.get("output", {})

        return cls(
            model_base=m.get("base", "yolov8n.pt"),
            imgsz=int(m.get("imgsz", 640)),
            epochs=int(t.get("epochs", 100)),
            batch=int(t.get("batch", 4)),
            patience=int(t.get("patience", 20)),
            seed=int(t.get("seed", 42)),
            workers=int(t.get("workers", 0)),
            lr0=float(t.get("lr0", 0.01)),
            weight_decay=float(t.get("weight_decay", 0.0005)),
            warmup_epochs=int(t.get("warmup_epochs", 3)),
            device="cpu",  # hardware constraint — never read from config
            dataset_path=str(d.get("path", "configs/dataset.yaml")),
            runs_dir=str(o.get("runs_dir", "runs")),
            models_dir=str(o.get("models_dir", "models")),
        )

    def validate(self) -> None:
        """Raise ValueError for obviously wrong values."""
        if self.epochs < 1:
            raise ValueError(f"epochs must be >= 1, got {self.epochs}")
        if self.batch < 1:
            raise ValueError(f"batch must be >= 1, got {self.batch}")
        if not (0.0 < self.lr0 < 1.0):
            raise ValueError(f"lr0 must be in (0, 1), got {self.lr0}")
        if self.imgsz < 32 or self.imgsz % 32 != 0:
            raise ValueError(f"imgsz must be a positive multiple of 32, got {self.imgsz}")
        dataset_yaml = Path(self.dataset_path)
        if not dataset_yaml.exists():
            raise FileNotFoundError(f"dataset config not found: {self.dataset_path}")
