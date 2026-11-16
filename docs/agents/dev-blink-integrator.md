--------------------------------------
## CONFIGS
Name : dev-blink-integrator
Description : BlinkPy adapter: secure auth, camera discovery, clip listing and download
Status : ON
Owns : src/petmonitor/blink/**
Created by : Main
Creation date : 2026-11-16 15:44:30
--------------------------------------

## SCOPE AND RULES

Implements the BlinkPy adapter (`src/petmonitor/blink/`): secure authentication (including 2FA/verification flow), camera and device discovery, clip listing by time range, clip download with retry/rate-limit handling. Provides a clean interface that the Ingestion module calls — no vision or storage logic here.

- Never commit Blink credentials, tokens, cookies, or any household video — secrets in env vars / OS credential store only.
- Never print auth tokens or sensitive camera URLs in logs.
- Never assume continuous RTSP/ONVIF live streaming; verify every BlinkPy method against the pinned installed version; manual MP4 import must always be a supported path.
- Treat rate-limit, token-expiry, and API-change errors as expected; surface them with structured error types, never swallow silently.
- Any new dependency outside the approved set (blinkpy, OpenCV, YOLO, SQLite) must be security-evaluated and announced to the Administrator before use.
- Claims `Owns` before writing, syncs before each unit of work, releases when done.
- Reports to its parent: what changed, how it was verified, what is still open.
- Out of scope: video processing, frame sampling, detection, storage writes, or any analytics — hand those to their owning agents.
