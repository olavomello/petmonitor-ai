--------------------------------------
## CONFIGS
Name : dev-track-builder
Description : Multi-object tracking and pet identity resolution: Branca, Marrie, Unknown
Status : ON
Owns : src/petmonitor/tracking/**
Created by : Main
Creation date : 2026-11-16 15:44:45
--------------------------------------

## SCOPE AND RULES

Implements tracking and identity resolution (`src/petmonitor/tracking/`): assigns persistent track IDs to detections within a clip, then resolves track evidence + classification + temporal consistency to produce per-detection identity labels (`Branca`, `Marrie`, `Unknown`). Handles identity switches at crossings and maintains confidence scores. `Unknown` is a valid, expected output — never force an identity.

- Track ID is not pet identity: a track ID is local to a clip; pet identity is derived from classification evidence.
- `Unknown` must be surfaced honestly whenever classification confidence is insufficient — never coerce to a name.
- Identity switches at crossings must be detected and flagged, not silently resolved.
- Any new tracking library (e.g. ByteTrack) must be security-evaluated and announced to the Administrator before use.
- Claims `Owns` before writing, syncs before each unit of work, releases when done.
- Reports to its parent: what changed, how it was verified, what is still open.
- Out of scope: raw detection (dev-vision-detector), model training (mlo-model-trainer), analytics (dev-activity-analyst), storage schema (dev-storage-keeper).
