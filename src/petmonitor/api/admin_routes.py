"""Admin API routes for dataset curation, sync management and training."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from starlette.responses import FileResponse

from petmonitor.api.deps import get_db
from petmonitor.storage.database import Database

router = APIRouter(prefix="/admin")

_VALID_STATUSES = {"pending", "keep", "discard", "labeled"}


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------

def _scan_frames(db: Database, root: Path | None = None) -> dict:
    """Walk datasets/images/raw/ and register new frames in the DB."""
    base = root or Path.cwd()
    raw_root = base / "datasets" / "images" / "raw"
    if not raw_root.exists():
        return {"registered": 0, "total": db.count_frames()}

    existing = db.get_frame_paths()
    batch = []
    for img in sorted(raw_root.rglob("*.jpg")):
        path_str = img.as_posix()
        if path_str in existing:
            continue
        try:
            clip_id = int(img.parent.name)
        except ValueError:
            clip_id = 0
        digits = "".join(c for c in img.stem if c.isdigit())
        frame_index = int(digits) if digits else 0
        batch.append({"clip_id": clip_id, "frame_index": frame_index, "file_path": path_str})

    registered = db.insert_frames_bulk(batch) if batch else 0
    return {"registered": registered, "total": db.count_frames()}


def _get_script(name: str) -> str:
    scripts_dir = Path(sys.executable).parent
    for candidate in [scripts_dir / name, scripts_dir / f"{name}.exe"]:
        if candidate.exists():
            return str(candidate)
    return name


def _spawn(cmd: str, args: list[str]) -> dict:
    full_cmd = [cmd] + args
    kwargs: dict = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if sys.platform == "win32":
        kwargs["creationflags"] = (
            subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        )
    else:
        kwargs["start_new_session"] = True
    try:
        proc = subprocess.Popen(full_cmd, **kwargs)
        return {"status": "triggered", "pid": proc.pid}
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"Command not found: {cmd}")


# ------------------------------------------------------------------
# Frames — dataset curation
# ------------------------------------------------------------------

@router.post("/frames/scan")
def scan_frames(db: Database = Depends(get_db)) -> dict:
    """Scan datasets/images/raw/ and register any new frames in the DB."""
    return _scan_frames(db)


@router.get("/frames/stats")
def get_frame_stats(db: Database = Depends(get_db)) -> dict:
    return db.get_frame_stats()


@router.get("/frames")
def list_frames(
    status: str | None = None,
    clip_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Database = Depends(get_db),
) -> dict:
    if status is not None and status not in _VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {_VALID_STATUSES}")
    frames = db.list_frames(limit=limit, offset=offset, status=status, clip_id=clip_id)
    total = db.count_frames(status=status, clip_id=clip_id)
    return {"frames": frames, "total": total}


@router.get("/frames/{frame_id}/image")
def get_frame_image(frame_id: int, db: Database = Depends(get_db)):
    frame = db.get_frame(frame_id)
    if frame is None:
        raise HTTPException(status_code=404, detail="Frame not found")

    file_path = Path(frame["file_path"])
    if not file_path.is_absolute():
        file_path = Path.cwd() / file_path

    # Path traversal guard: must resolve under datasets/
    datasets_root = (Path.cwd() / "datasets").resolve()
    try:
        file_path.resolve().relative_to(datasets_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(str(file_path), media_type="image/jpeg")


def _label_path(file_path: str) -> Path:
    """datasets/images/raw/X/Y.jpg → datasets/labels/raw/X/Y.txt"""
    return Path(file_path.replace("/images/", "/labels/", 1)).with_suffix(".txt")


def _resolve_label_path(file_path: str) -> Path:
    p = _label_path(file_path)
    if not p.is_absolute():
        p = Path.cwd() / p
    datasets_root = (Path.cwd() / "datasets").resolve()
    try:
        p.resolve().relative_to(datasets_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    return p


class BBoxItem(BaseModel):
    class_id: int
    cx: float
    cy: float
    w: float
    h: float


class LabelsPayload(BaseModel):
    labels: list[BBoxItem]


@router.get("/frames/{frame_id}/labels")
def get_frame_labels(frame_id: int, db: Database = Depends(get_db)) -> dict:
    frame = db.get_frame(frame_id)
    if frame is None:
        raise HTTPException(status_code=404, detail="Frame not found")
    label_path = _resolve_label_path(frame["file_path"])
    if not label_path.exists():
        return {"labels": []}
    items = []
    for line in label_path.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split()
        if len(parts) == 5:
            items.append({
                "class_id": int(parts[0]),
                "cx": float(parts[1]),
                "cy": float(parts[2]),
                "w": float(parts[3]),
                "h": float(parts[4]),
            })
    return {"labels": items}


@router.post("/frames/{frame_id}/labels")
def save_frame_labels(
    frame_id: int, body: LabelsPayload, db: Database = Depends(get_db)
) -> dict:
    frame = db.get_frame(frame_id)
    if frame is None:
        raise HTTPException(status_code=404, detail="Frame not found")
    label_path = _resolve_label_path(frame["file_path"])
    label_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"{b.class_id} {b.cx:.6f} {b.cy:.6f} {b.w:.6f} {b.h:.6f}"
        for b in body.labels
    ]
    label_path.write_text("\n".join(lines), encoding="utf-8")
    if body.labels:
        db.update_frame_status(frame_id, "labeled")
    updated = db.get_frame(frame_id)
    assert updated is not None
    return updated


class FrameUpdate(BaseModel):
    status: str


@router.patch("/frames/{frame_id}")
def update_frame(
    frame_id: int, body: FrameUpdate, db: Database = Depends(get_db)
) -> dict:
    if body.status not in _VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {_VALID_STATUSES}")
    frame = db.get_frame(frame_id)
    if frame is None:
        raise HTTPException(status_code=404, detail="Frame not found")
    db.update_frame_status(frame_id, body.status)
    updated = db.get_frame(frame_id)
    assert updated is not None
    return updated


class BulkStatusPayload(BaseModel):
    ids: list[int]
    status: str


@router.post("/frames/bulk-status")
def bulk_update_frame_status(body: BulkStatusPayload, db: Database = Depends(get_db)) -> dict:
    if body.status not in _VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {_VALID_STATUSES}")
    updated = []
    for frame_id in body.ids:
        frame = db.get_frame(frame_id)
        if frame is None:
            continue
        db.update_frame_status(frame_id, body.status)
        result = db.get_frame(frame_id)
        if result is not None:
            updated.append(result)
    return {"updated": len(updated), "frames": updated}


# ------------------------------------------------------------------
# Dataset split
# ------------------------------------------------------------------

@router.post("/dataset/split")
def run_split(train_ratio: float = 0.8, seed: int = 42) -> dict:
    result = subprocess.run(
        [sys.executable, "scripts/split_dataset.py",
         "--train", str(train_ratio), "--seed", str(seed)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or "Split failed")
    return {"message": result.stdout.strip(), "ok": True}


# ------------------------------------------------------------------
# Clips / sync
# ------------------------------------------------------------------

@router.get("/clips")
def list_admin_clips(
    limit: int = 50,
    offset: int = 0,
    db: Database = Depends(get_db),
) -> list:
    return db.list_clips(limit=limit, offset=offset)


@router.post("/sync")
def trigger_sync() -> dict:
    return _spawn(_get_script("petmonitor-sync"), [])


@router.post("/extract")
def trigger_extract() -> dict:
    return _spawn(sys.executable, ["scripts/extract_frames.py", "--sample-rate", "10"])


# ------------------------------------------------------------------
# Training runs
# ------------------------------------------------------------------

@router.get("/runs")
def list_runs() -> list:
    runs_dir = Path("runs/detect")
    if not runs_dir.exists():
        return []
    runs = []
    for run_dir in sorted(runs_dir.iterdir(), reverse=True):
        if not run_dir.is_dir():
            continue
        run: dict = {"name": run_dir.name, "has_best_weights": False, "has_metrics": False}
        weights = run_dir / "weights" / "best.pt"
        run["has_best_weights"] = weights.exists()
        results_csv = run_dir / "results.csv"
        if results_csv.exists():
            run["has_metrics"] = True
            try:
                lines = results_csv.read_text(encoding="utf-8").strip().splitlines()
                if len(lines) > 1:
                    headers = [h.strip() for h in lines[0].split(",")]
                    values = [v.strip() for v in lines[-1].split(",")]
                    run["last_epoch"] = dict(zip(headers, values))
            except Exception:
                pass
        runs.append(run)
    return runs


@router.post("/train")
def trigger_train() -> dict:
    return _spawn(sys.executable, ["scripts/train.py"])
