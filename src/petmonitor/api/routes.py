"""REST API routes for the PetMonitor AI local server."""

from __future__ import annotations

from importlib.metadata import version as _pkg_version
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.responses import FileResponse

from petmonitor.activities.analyser import compute_heatmap, get_activity_summary
from petmonitor.api.deps import get_db
from petmonitor.storage.database import Database

_CLIPS_ROOT = Path("data").resolve()
_THUMB_DIR = Path("data/thumbnails")

try:
    _VERSION = _pkg_version("petmonitor-ai")
except Exception:
    _VERSION = "0.0.1"

router = APIRouter()


@router.get("/status")
def get_status(db: Database = Depends(get_db)) -> dict:
    stats = db.get_stats()
    stats["version"] = _VERSION
    stats["blink_connected"] = Path("data/.blink_creds.json").exists()
    return stats


@router.get("/clips")
def list_clips(
    limit: int = 50,
    offset: int = 0,
    db: Database = Depends(get_db),
) -> list:
    return db.list_clips(limit=limit, offset=offset)


@router.get("/clips/{clip_id}")
def get_clip(clip_id: int, db: Database = Depends(get_db)) -> dict:
    clip = db.get_clip(clip_id)
    if clip is None:
        raise HTTPException(status_code=404, detail="Clip not found")
    return clip


@router.get("/pets")
def get_pets(request: Request, db: Database = Depends(get_db)) -> list:
    cfg = getattr(request.app.state, "config", {})
    pets = cfg.get("pets", [])
    identity_stats = {row["identity"]: row for row in db.get_identity_stats()}
    result = []
    for pet in pets:
        stat = identity_stats.get(pet["name"], {"track_count": 0, "clip_count": 0})
        result.append(
            {
                "id": pet["id"],
                "name": pet["name"],
                "class_id": pet["class_id"],
                "track_count": stat["track_count"],
                "clip_count": stat["clip_count"],
            }
        )
    return result


@router.get("/activity")
def get_activity(
    identity: str | None = None,
    clip_id: int | None = None,
    db: Database = Depends(get_db),
) -> dict:
    events = db.list_activity_events(identity=identity, clip_id=clip_id)
    summary = get_activity_summary(events)
    return {
        "events": events,
        "summary": summary,
        "note": "Counts reflect individual track events from processed footage.",
    }


@router.get("/clips/{clip_id}/thumbnail")
def get_clip_thumbnail(clip_id: int, db: Database = Depends(get_db)):  # pragma: no cover
    """Extract and serve the first frame of a clip as JPEG, cached to disk."""
    import cv2

    clip = db.get_clip(clip_id)
    if clip is None:
        raise HTTPException(status_code=404, detail="Clip not found")

    local_path = Path(clip["local_path"])
    try:
        local_path.resolve().relative_to(_CLIPS_ROOT)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    if not local_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    _THUMB_DIR.mkdir(parents=True, exist_ok=True)
    thumb_path = _THUMB_DIR / f"{clip['sha256'][:16]}.jpg"

    if not thumb_path.exists():
        cap = cv2.VideoCapture(str(local_path))
        ok, frame = cap.read()
        cap.release()
        if not ok:
            raise HTTPException(status_code=500, detail="Cannot extract frame")
        cv2.imwrite(str(thumb_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 70])

    return FileResponse(str(thumb_path), media_type="image/jpeg")


@router.get("/clips/{clip_id}/video")
def get_clip_video(clip_id: int, db: Database = Depends(get_db)):  # pragma: no cover
    """Serve the raw MP4 clip file."""
    clip = db.get_clip(clip_id)
    if clip is None:
        raise HTTPException(status_code=404, detail="Clip not found")

    local_path = Path(clip["local_path"])
    try:
        local_path.resolve().relative_to(_CLIPS_ROOT)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    if not local_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    return FileResponse(str(local_path), media_type="video/mp4")


@router.get("/heatmap/{identity}")
def get_heatmap(
    identity: str,
    grid_w: int = 50,
    grid_h: int = 50,
    db: Database = Depends(get_db),
) -> dict:
    if not identity or identity.strip() == "":
        raise HTTPException(status_code=400, detail="identity must not be empty")
    points = db.list_trajectory_points(identity=identity)
    grid = compute_heatmap(points, grid_w=grid_w, grid_h=grid_h)
    return {
        "identity": identity,
        "grid_w": grid_w,
        "grid_h": grid_h,
        "point_count": len(points),
        "grid": grid,
        "note": "Grid values are sample counts from processed footage, not minutes.",
    }
