"""BlinkPy adapter for PetMonitor AI.

Provides camera discovery and clip download via the unofficial Blink API.

Important constraints:
- Uses *unofficial* Blink interfaces via blinkpy. Method availability depends on
  the pinned blinkpy version; verify before each release.
- Do NOT assume continuous RTSP/ONVIF live-streaming. Treat live-view as unavailable
  unless confirmed for the specific camera model and blinkpy version in use.
- Never log or expose auth tokens, session tokens, or sensitive camera URLs.
- Credentials come from environment variables only — never hardcoded.

Requires blinkpy>=0.22.0.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy import — blinkpy may not be installed in all test environments.
try:
    from blinkpy.blinkpy import Blink
    from blinkpy.auth import Auth
    from blinkpy.helpers.util import json_load

    BLINKPY_AVAILABLE = True
except ImportError:  # pragma: no cover
    BLINKPY_AVAILABLE = False


@dataclass
class ClipInfo:
    """Metadata for a single Blink clip."""

    camera_name: str
    clip_url: str
    created_at: datetime
    downloaded_at: Optional[datetime] = None
    local_path: Optional[Path] = None


@dataclass
class CameraInfo:
    """Discovered Blink camera."""

    name: str
    network_id: str
    device_id: str
    is_online: bool
    extra: dict = field(default_factory=dict)


class BlinkError(Exception):
    """Base error for Blink adapter failures."""


class BlinkAuthError(BlinkError):
    """Authentication failed or credentials are missing."""


class BlinkCameraNotFoundError(BlinkError):
    """Named camera not found in the account."""


class BlinkDownloadError(BlinkError):
    """Clip download failed."""


class BlinkUnavailableError(BlinkError):
    """blinkpy is not installed."""


class BlinkAdapter:
    """Adapter for the BlinkPy library.

    Usage::

        adapter = BlinkAdapter.from_env()
        async with adapter:
            cameras = await adapter.list_cameras()
            clips = await adapter.list_clips(cameras[0].name, max_age_hours=24)
            for clip in clips[:1]:
                await adapter.download_clip(clip, dest_dir=Path("data/clips"))

    All network calls are async. The adapter does not hold persistent state between
    ``async with`` blocks; authenticate each time.
    """

    def __init__(
        self,
        username: str,
        password: str,
        credentials_file: Optional[Path] = None,
    ) -> None:
        if not username or not password:
            raise BlinkAuthError(
                "Blink credentials are missing. "
                "Set BLINK_USERNAME and BLINK_PASSWORD in your .env file."
            )
        self._username = username
        self._password = password
        self._credentials_file = credentials_file
        self._blink: Optional["Blink"] = None

    @classmethod
    def from_env(cls, credentials_file: Optional[Path] = None) -> "BlinkAdapter":
        """Create an adapter from BLINK_USERNAME / BLINK_PASSWORD env vars."""
        username = os.environ.get("BLINK_USERNAME", "")
        password = os.environ.get("BLINK_PASSWORD", "")
        return cls(username=username, password=password, credentials_file=credentials_file)

    async def __aenter__(self) -> "BlinkAdapter":  # pragma: no cover
        await self._connect()
        return self

    async def __aexit__(self, *_: object) -> None:  # pragma: no cover
        self._blink = None

    async def _connect(self) -> None:  # pragma: no cover
        """Authenticate with Blink and start the session.

        Handles Two-Factor Authentication interactively: if Blink requires a
        verification code, the user is prompted on stdout/stdin, then the code
        is submitted and credentials are saved to ``credentials_file`` so that
        subsequent runs skip 2FA.
        """
        if not BLINKPY_AVAILABLE:
            raise BlinkUnavailableError(
                "blinkpy is not installed. Run: pip install blinkpy"
            )

        logger.info("Connecting to Blink API…")
        creds: dict = {}
        if self._credentials_file and self._credentials_file.exists():
            creds = json_load(str(self._credentials_file)) or {}

        auth = Auth(
            {
                "username": self._username,
                "password": self._password,
                **creds,
            }
        )
        blink = Blink(session=None)
        blink.auth = auth

        try:
            await blink.start()
        except Exception as exc:
            exc_name = type(exc).__name__
            # blinkpy raises *TwoFA* or *Unauthorized* variants when 2FA is required.
            if any(kw in exc_name for kw in ("TwoFA", "2FA", "Unauthorized")):
                blink = await self._handle_two_fa(blink)
            else:
                # Sanitize: never surface passwords or tokens in the error.
                raise BlinkAuthError(f"Blink authentication failed: {exc_name}") from exc

        self._blink = blink
        await self._save_credentials(blink)
        logger.info("Blink session started. Networks: %s", list(blink.networks.keys()))

    async def _handle_two_fa(self, blink: "Blink") -> "Blink":  # pragma: no cover
        """Prompt the user for a 2FA code and complete authentication (blinkpy 0.22+)."""
        print(
            "\nBlink requires two-factor authentication.\n"
            "A verification code was sent to your registered email or phone.\n",
            flush=True,
        )
        code = input("Enter 2FA code: ").strip()
        try:
            ok = await blink.auth.complete_2fa_login(code)
            if not ok:
                raise BlinkAuthError("Blink 2FA verification failed — wrong code?")
            # setup_urls must be called before setup_post_verify because
            # blink.start() raised before reaching it during the 2FA flow.
            blink.setup_urls()
            await blink.setup_post_verify()
        except BlinkAuthError:
            raise
        except Exception as exc:
            raise BlinkAuthError(f"Blink 2FA failed: {type(exc).__name__}") from exc
        return blink

    async def _save_credentials(self, blink: "Blink") -> None:  # pragma: no cover
        """Persist auth state so the next run skips 2FA."""
        if not self._credentials_file:
            return
        self._credentials_file.parent.mkdir(parents=True, exist_ok=True)
        await blink.save(str(self._credentials_file))
        logger.debug("Credentials saved → %s", self._credentials_file)

    async def list_cameras(self) -> list[CameraInfo]:  # pragma: no cover
        """Return all cameras found in the account."""
        self._require_connected()
        assert self._blink is not None
        cameras: list[CameraInfo] = []
        for name, cam in self._blink.cameras.items():
            cameras.append(
                CameraInfo(
                    name=name,
                    network_id=str(getattr(cam, "network_id", "")),
                    device_id=str(getattr(cam, "id", "")),
                    is_online=bool(getattr(cam, "online", False)),
                )
            )
        logger.info("Found %d camera(s): %s", len(cameras), [c.name for c in cameras])
        return cameras

    async def list_clips(  # pragma: no cover
        self,
        camera_name: Optional[str] = None,
        max_age_hours: int = 24,
    ) -> list[ClipInfo]:
        """Return available clips for a camera.

        Args:
            camera_name: Camera to query; uses the first discovered camera if None.
            max_age_hours: Only return clips newer than this many hours (0 = no limit).

        Note:
            blinkpy's clip listing depends on the camera model and account configuration.
            If the camera does not expose clip URLs, this returns an empty list and
            the caller should fall back to manual MP4 import.
        """
        self._require_connected()
        assert self._blink is not None

        cam = self._resolve_camera(camera_name)
        clips: list[ClipInfo] = []

        # blinkpy 0.22+ exposes `camera.clips` as a list of dicts with 'url'/'created_at'.
        raw_clips = getattr(cam, "clips", None) or []
        if not raw_clips:
            # Some accounts expose clips through the network homescreen endpoint.
            raw_clips = getattr(self._blink, "homescreen", {}).get("clips", [])

        cutoff = None
        if max_age_hours > 0:
            cutoff = datetime.now(timezone.utc).timestamp() - max_age_hours * 3600

        for entry in raw_clips:
            if isinstance(entry, dict):
                url = entry.get("url", "")
                ts_str = entry.get("created_at", "")
            else:
                url = getattr(entry, "url", "")
                ts_str = getattr(entry, "created_at", "")

            if not url:
                continue

            try:
                created_at = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                created_at = datetime.now(timezone.utc)

            if cutoff and created_at.timestamp() < cutoff:
                continue

            clips.append(ClipInfo(camera_name=cam.name, clip_url=url, created_at=created_at))

        logger.info(
            "Found %d clip(s) for camera '%s' (max_age_hours=%d)",
            len(clips),
            cam.name,
            max_age_hours,
        )
        return clips

    async def download_clip(self, clip: ClipInfo, dest_dir: Path) -> Path:  # pragma: no cover
        """Download a clip to *dest_dir* and update ``clip.local_path``.

        Returns the local path to the downloaded file.
        Raises :exc:`BlinkDownloadError` on failure.
        """
        self._require_connected()
        assert self._blink is not None

        dest_dir.mkdir(parents=True, exist_ok=True)
        # Build a safe filename from the clip URL (last path segment).
        filename = Path(clip.clip_url.split("?")[0]).name or "clip.mp4"
        dest = dest_dir / filename

        logger.info("Downloading clip to %s…", dest)
        try:
            # blinkpy 0.22+: use the session's authenticated request.
            async with self._blink.auth.session.get(clip.clip_url) as resp:
                if resp.status != 200:
                    raise BlinkDownloadError(
                        f"HTTP {resp.status} downloading clip from Blink"
                    )
                content = await resp.read()

            dest.write_bytes(content)
            clip.local_path = dest
            clip.downloaded_at = datetime.now(timezone.utc)
            logger.info("Saved %d bytes → %s", len(content), dest)
            return dest
        except BlinkDownloadError:
            raise
        except Exception as exc:
            raise BlinkDownloadError(
                f"Download failed: {type(exc).__name__}"
            ) from exc

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _require_connected(self) -> None:
        if self._blink is None:
            raise BlinkError(
                "Not connected. Use 'async with BlinkAdapter(...) as adapter:'"
            )

    def _resolve_camera(self, name: Optional[str]):  # noqa: ANN001  # pragma: no cover
        """Return a blinkpy camera object by name, or the first camera if name is None."""
        assert self._blink is not None
        if not self._blink.cameras:
            raise BlinkCameraNotFoundError("No cameras found in this Blink account.")

        if name is None:
            cam = next(iter(self._blink.cameras.values()))
            logger.info("No camera name specified; using '%s'", cam.name)
            return cam

        cam = self._blink.cameras.get(name)
        if cam is None:
            available = list(self._blink.cameras.keys())
            raise BlinkCameraNotFoundError(
                f"Camera '{name}' not found. Available: {available}"
            )
        return cam


def run_connect_check(camera_name: Optional[str] = None) -> None:  # pragma: no cover
    """Synchronous wrapper for a one-shot connectivity check (CLI use)."""

    async def _check() -> None:
        from dotenv import load_dotenv

        load_dotenv()
        adapter = BlinkAdapter.from_env()
        async with adapter:
            cameras = await adapter.list_cameras()
            if not cameras:
                print("No cameras found in this account.")
                return
            for cam in cameras:
                status = "ONLINE" if cam.is_online else "offline"
                print(f"  {cam.name} [{status}] — network_id={cam.network_id}")
            target = camera_name or cameras[0].name
            print(f"\nListing clips for: {target}")
            clips = await adapter.list_clips(target, max_age_hours=0)
            if clips:
                for clip in clips[:5]:
                    print(f"  {clip.created_at.isoformat()}  {clip.clip_url[:60]}…")
            else:
                print(
                    "  No clips available via API. "
                    "Use manual MP4 import: petmonitor-ingest --file <path.mp4>"
                )

    asyncio.run(_check())
