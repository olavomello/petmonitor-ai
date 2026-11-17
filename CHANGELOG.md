# Changelog

All notable changes to this project are documented here.
The format follows Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
### Added
- Initial project structure from ai-project-starter.
- MVP 1: SQLite storage layer (`Database`) with clips and detections tables.
- MVP 1: YOLO-based `Detector` — CPU-only inference over sampled video frames.
- MVP 1: `petmonitor-sync` CLI — Blink API → download → ingest → detect in one command; duplicates skipped silently with DEBUG log.
- `Ingestor.clips_dir` property for use by the sync orchestrator.
- MVP 2: `tracks` table in SQLite schema; `insert_track`, `list_tracks_for_clip`, `list_clips_without_tracks`, `list_detections_for_clip`, `list_clips`, `get_clip`, `get_stats`, `get_identity_stats` query helpers.
- MVP 2: IoU-based `Tracker` with majority-vote pet identity resolution (Branca, Marrie, Unknown); `Tracker.from_config` reads pets from `app.yaml`.
- MVP 2: `petmonitor-track` CLI — assigns track IDs and pet identity to all untracked clips.
- MVP 2: Local REST API (`petmonitor-api`) — `GET /api/v1/status`, `/clips`, `/clips/{id}`, `/pets`; binds to 127.0.0.1 only.
- MVP 3: `activity_events` and `trajectories` tables; `insert_activity_event`, `list_activity_events`, `list_clips_without_activity_events`, `insert_trajectory_points`, `list_trajectory_points`, `list_detections_for_track` DB helpers.
- MVP 3: `ActivityAnalyser` module — `classify_track_state` (moving/stationary from bbox displacement), `extract_trajectory` (bottom-centre ground points), `compute_heatmap` (2-D density grid), `get_activity_summary`.
- MVP 3: `petmonitor-analyse` CLI — classifies all unprocessed tracks and stores activity events and trajectory points.
- MVP 3: API routes `GET /api/v1/activity` (events + summary, filterable by identity/clip) and `GET /api/v1/heatmap/{identity}` (density grid, configurable size).
