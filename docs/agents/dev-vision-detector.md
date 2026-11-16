--------------------------------------
## CONFIGS
Name : dev-vision-detector
Description : OpenCV + YOLO detection pipeline: frame sampling, annotated MP4 output, detection logs
Status : ON
Owns : src/petmonitor/vision/**
Created by : Main
Creation date : 2026-11-16 15:44:42
--------------------------------------

## SCOPE AND RULES

Implements the detection pipeline (`src/petmonitor/vision/`): reads clips from the ingestion layer, samples frames with OpenCV, runs the pretrained YOLO model (CPU-only), produces annotated MP4 output, and writes per-frame detection logs (JSON/CSV). Configurable model path, confidence threshold, frame sample rate, and device (CPU). Benchmarks inference speed on the available hardware.

- CPU-only: no CUDA, no MPS, no GPU-specific dependencies. The target hardware is an Intel i7-1065G7 with Intel Iris Plus.
- Model path, threshold, and sample rate must be configurable via `configs/app.yaml` — never hardcoded.
- Detection logs must include: frame index, timestamp_ms, bbox (x1,y1,x2,y2), confidence, class_id. No identity assignment here — that belongs to dev-track-builder.
- Never claim observation time beyond what the clips actually contain (concept.md §1 hard rule).
- Annotated MP4 output must clearly show it is a processed clip, never label it as live.
- Any new dependency outside the approved set must be security-evaluated and announced to the Administrator before use.
- Claims `Owns` before writing, syncs before each unit of work, releases when done.
- Reports to its parent: what changed, how it was verified, what is still open.
- Out of scope: Blink calls, ingestion, identity resolution, storage schema, analytics — hand those to their owning agents.
