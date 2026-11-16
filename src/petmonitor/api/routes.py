"""REST API routes for the PetMonitor AI local server."""

from __future__ import annotations

from importlib.metadata import version as _pkg_version

from fastapi import APIRouter, Depends, HTTPException, Request

from petmonitor.api.deps import get_db
from petmonitor.storage.database import Database

try:
    _VERSION = _pkg_version("petmonitor-ai")
except Exception:
    _VERSION = "0.0.1"

router = APIRouter()


@router.get("/status")
def get_status(db: Database = Depends(get_db)) -> dict:
    stats = db.get_stats()
    stats["version"] = _VERSION
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
