# Decisions

Append only. One line each: `YYYY-MM-DD — decision — reason`.

2026-11-16 — Stack: Python 3.11 (CPU-only) + OpenCV + Ultralytics YOLO + BlinkPy + SQLite; frontend PWA React/TypeScript + FastAPI — matches hardware constraints (i7-1065G7, Intel Iris Plus, no NVIDIA GPU) and approved libraries; local-first privacy-first design.
2026-11-16 — Agent policy: auto_agents=true, main_merge=true — owner approved autonomous spawning within hard limits (depth 3, 4 concurrent, 3 per parent); Main may auto-merge mechanical PRs (docs/tests/formatting, <400 lines, no sensitive paths).
2026-11-16 — 10-agent team covering 10 architecture modules: blink, ingestion, vision, tracking, activities, storage, api, ui, mlops, qa — one agent per module for clear ownership and testable interfaces.
2026-11-16 — FastAPI approved as backend framework for the local API (dev-api-builder, src/petmonitor/api/) — evaluado: actively maintained, MIT license, no telemetry/phone-home, well-audited, no transitive CVEs known, runs entirely locally. Localhost-only binding; authn/authz required if exposed beyond localhost.
