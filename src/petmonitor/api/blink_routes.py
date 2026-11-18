"""Blink authentication and status endpoints."""

from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/blink")

_CREDS_FILE = Path("data/.blink_creds.json")
_CAMERAS_FILE = Path("data/.blink_cameras.json")

# In-memory 2FA state for a single ongoing auth session (local server, single user).
_pending: dict = {}  # keys: "blink", "created_at"
_PENDING_TTL = 300  # 5 minutes to submit 2FA code


def _save_camera_names(blink: object) -> None:  # pragma: no cover
    try:
        names = list(getattr(blink, "cameras", {}).keys())
        _CAMERAS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _CAMERAS_FILE.write_text(json.dumps({"cameras": names}), encoding="utf-8")
    except Exception:
        pass


class AuthStartBody(BaseModel):
    email: str
    password: str


class AuthVerifyBody(BaseModel):
    code: str


@router.get("/cameras")
def get_blink_cameras() -> dict:
    """Return camera names saved from the last successful Blink auth."""
    if not _CAMERAS_FILE.exists():
        return {"cameras": []}
    try:
        data = json.loads(_CAMERAS_FILE.read_text(encoding="utf-8"))
        return {"cameras": data.get("cameras", [])}
    except Exception:
        return {"cameras": []}


@router.get("/status")
def get_blink_status() -> dict:
    if not _CREDS_FILE.exists():
        return {"status": "not_configured", "has_pending_2fa": bool(_pending)}
    try:
        data = json.loads(_CREDS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict) and data:
            return {"status": "configured", "has_pending_2fa": bool(_pending)}
    except Exception:
        pass
    return {"status": "file_invalid", "has_pending_2fa": bool(_pending)}


@router.post("/auth/start")
async def start_blink_auth(body: AuthStartBody) -> dict:  # pragma: no cover
    """Begin Blink authentication. Returns 2fa_required or authenticated."""
    try:
        from blinkpy.auth import Auth
        from blinkpy.blinkpy import Blink
    except ImportError:
        raise HTTPException(status_code=500, detail="blinkpy not installed")

    if not body.email or not body.password:
        raise HTTPException(status_code=422, detail="email and password required")

    # Load any saved credentials (for reuse of existing token).
    saved: dict = {}
    if _CREDS_FILE.exists():
        try:
            saved = json.loads(_CREDS_FILE.read_text(encoding="utf-8")) or {}
        except Exception:
            saved = {}

    auth = Auth({"username": body.email, "password": body.password, **saved})
    blink = Blink(session=None)
    blink.auth = auth

    try:
        await blink.start()
        # Auth succeeded without 2FA.
        _CREDS_FILE.parent.mkdir(parents=True, exist_ok=True)
        await blink.save(str(_CREDS_FILE))
        _pending.clear()
        _save_camera_names(blink)
        return {"status": "authenticated"}
    except Exception as exc:
        exc_name = type(exc).__name__
        if any(kw in exc_name for kw in ("TwoFA", "2FA", "Unauthorized", "LoginError")):
            _pending.clear()
            _pending["blink"] = blink
            _pending["created_at"] = time.monotonic()
            return {"status": "2fa_required"}
        raise HTTPException(status_code=401, detail="Authentication failed") from exc


@router.post("/auth/verify")
async def verify_blink_auth(body: AuthVerifyBody) -> dict:  # pragma: no cover
    """Submit the Blink 2FA code to complete authentication."""
    if not _pending or "blink" not in _pending:
        raise HTTPException(status_code=400, detail="No pending 2FA session. Start auth first.")
    if time.monotonic() - _pending.get("created_at", 0) > _PENDING_TTL:
        _pending.clear()
        raise HTTPException(status_code=408, detail="2FA session expired. Start auth again.")
    if not body.code or not body.code.strip():
        raise HTTPException(status_code=422, detail="code required")

    blink = _pending["blink"]
    try:
        ok = await blink.auth.complete_2fa_login(body.code.strip())
        if not ok:
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
        blink.setup_urls()
        await blink.setup_post_verify()
        _CREDS_FILE.parent.mkdir(parents=True, exist_ok=True)
        await blink.save(str(_CREDS_FILE))
        _pending.clear()
        _save_camera_names(blink)
        return {"status": "authenticated"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="2FA verification failed") from exc
