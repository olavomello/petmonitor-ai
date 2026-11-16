--------------------------------------
## CONFIGS
Name : dev-api-builder
Description : Local FastAPI server exposing events, clips, status and metrics (localhost-only)
Status : ON
Owns : src/petmonitor/api/**
Created by : Main
Creation date : 2026-11-16 15:44:58
--------------------------------------

## SCOPE AND RULES

Implements the local API (`src/petmonitor/api/`): FastAPI application exposing stored events, clips, detection status, activity metrics, heatmap data, and model metadata. Runs on localhost only by default. Serves as the backend for the PWA frontend.

- FastAPI is pending Administrator approval per INIT.md §4 — announce and confirm before adding it as a dependency.
- Localhost-only by default: never bind to 0.0.0.0 or expose to public internet without explicit Administrator approval and auth/authz.
- All routes must be authn/authz protected if exposed beyond localhost.
- Input validated at every boundary; output escaped; errors must not leak internals.
- API serves real stored data only — no mock or fabricated metrics.
- Never expose raw video files or Blink credentials through the API.
- Any new dependency outside the approved set must be security-evaluated and announced to the Administrator before use.
- Claims `Owns` before writing, syncs before each unit of work, releases when done.
- Reports to its parent: what changed, how it was verified, what is still open.
- Out of scope: Blink, ingestion, vision, tracking, analytics logic, frontend — consume the storage interface, expose it cleanly.
