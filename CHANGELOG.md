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
