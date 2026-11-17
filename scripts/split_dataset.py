"""Split raw frames that have YOLO labels into train / val sets.

Scans datasets/images/raw/ for every .jpg that has a matching .txt in
datasets/labels/raw/ at the same sub-path.  Shuffles with a fixed seed and
copies the labeled pairs to datasets/images/{train,val}/ and
datasets/labels/{train,val}/.

Usage:
    python scripts/split_dataset.py [--train 0.8] [--seed 42] [-v]
"""
from __future__ import annotations

import argparse
import logging
import random
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

IMAGES_RAW = Path("datasets/images/raw")
LABELS_RAW = Path("datasets/labels/raw")
IMAGES_BASE = Path("datasets/images")
LABELS_BASE = Path("datasets/labels")


def _labeled_pairs() -> list[tuple[Path, Path]]:
    if not IMAGES_RAW.exists():
        return []
    pairs = []
    for img in sorted(IMAGES_RAW.rglob("*.jpg")):
        rel = img.relative_to(IMAGES_RAW)
        label = LABELS_RAW / rel.with_suffix(".txt")
        if label.exists():
            pairs.append((img, label))
    return pairs


def _copy_pair(img: Path, label: Path, split_name: str) -> None:
    dst_img = IMAGES_BASE / split_name / img.name
    dst_label = LABELS_BASE / split_name / label.name
    dst_img.parent.mkdir(parents=True, exist_ok=True)
    dst_label.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(img, dst_img)
    shutil.copy2(label, dst_label)


def split(train_ratio: float = 0.8, seed: int = 42) -> dict:
    pairs = _labeled_pairs()
    if not pairs:
        logger.warning("No labeled frames found in %s", IMAGES_RAW)
        return {"total": 0, "train": 0, "val": 0}

    rng = random.Random(seed)
    rng.shuffle(pairs)
    n_train = round(len(pairs) * train_ratio)

    for img, label in pairs[:n_train]:
        _copy_pair(img, label, "train")
    for img, label in pairs[n_train:]:
        _copy_pair(img, label, "val")

    result = {"total": len(pairs), "train": n_train, "val": len(pairs) - n_train}
    logger.info(
        "Split %d labeled frames → train=%d val=%d",
        result["total"], result["train"], result["val"],
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", type=float, default=0.8, metavar="RATIO",
                        help="Fraction of data for training (default 0.8)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(message)s",
    )
    result = split(train_ratio=args.train, seed=args.seed)
    print(
        f"Done: {result['total']} labeled frames → "
        f"train={result['train']} val={result['val']}"
    )


if __name__ == "__main__":
    main()
