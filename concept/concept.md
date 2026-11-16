# PetMonitor AI

## Complete Product Concept and Implementation Prompt

**Version:** 1.0  
**Date:** 2026-11-16  
**Status:** Product concept, approved visual direction, MVP not yet implemented  
**Repository name:** `petmonitor-ai`  
**Primary language for code and identifiers:** English  
**Initial interface language:** Portuguese (Brazil), designed for future localization

---

## 1. Executive summary

PetMonitor AI is a privacy-first, locally operated computer vision application that analyzes home security camera recordings to identify and track two Shih Tzu dogs, **Branca** and **Marrie**, and produce understandable reports about their observed activity in the living room.

The project is also a hands-on learning laboratory for Python, OpenCV, object detection, YOLO fine-tuning, data annotation, model evaluation, object tracking, event processing, and MLOps.

The initial camera is a **Blink** device. Use **BlinkPy** for camera account/device integration and retrieval of accessible clips. Do not assume that BlinkPy provides reliable, continuous RTSP/ONVIF video streaming. The exact camera model and its supported BlinkPy capabilities remain to be confirmed.

**Core value proposition:** turn available video observations into per-pet, timestamped, measurable, searchable activity information, with honest reporting of uncertainty and gaps in recording coverage.

## 2. Project goals

1. Integrate with the user's Blink camera through BlinkPy.
2. Download or ingest accessible video clips automatically where supported, with a manual MP4 import fallback.
3. Detect dogs in frames with a pretrained YOLO model.
4. Build a custom labeled dataset of Branca and Marrie.
5. Fine-tune and evaluate a model for individual dog identification.
6. Track each dog within video clips, with explicit handling of identity uncertainty.
7. Derive basic observed activity indicators: visible, moving, stationary, and not visible.
8. Save events, timestamps, source clips, thumbnails, model versions, and confidence values.
9. Display a responsive dashboard for desktop and mobile.
10. Progress toward movement trajectories, room occupancy heatmaps, and behavioral summaries.

### Non-goals for MVP

- Diagnosing medical conditions or asserting that a dog is sleeping based only on stillness.
- Continuous live monitoring unless the particular Blink model and integration demonstrably support it.
- Guaranteed recognition of the dogs in every lighting, grooming, or occlusion condition.
- Inferring whole-day activity from incomplete motion-triggered clips.
- Cloud-hosted video analysis or mandatory third-party inference services.

## 3. Users and subjects

**Initial user:** a household owner who wants to understand what two dogs do while in the living room.

**Monitored pets:**

- Branca, Shih Tzu.
- Marrie, Shih Tzu.

Names are user-provided labels. Actual identification must be learned and validated from footage. Do not assume physical appearance from illustrative mockups. The application should allow reference photos and correction of mistaken identities.

**Environment:** indoor living room, viewed by a Blink security camera. The camera may capture people or private household details; footage and credentials must remain protected.

## 4. Approved product identity

**Name:** PetMonitor AI  
**Tagline (optional):** Intelligent Pet Activity Monitoring

**Approved logo:** minimalist horizontal lockup with a dark navy paw icon, a camera lens in the central paw pad, teal viewfinder corners, a subtle vertical separator, and the wordmark `PetMonitor AI`, with `PetMonitor` in dark navy and `AI` in teal. Use the previously approved logo asset as the source of truth; do not redraw it differently without approval.

**Design language:** modern, premium, minimal, readable, rounded cards, clear status labels, subtle borders, dark mode. Use teal for Branca and purple for Marrie in analytics, while keeping the official logo colors consistent. Use accessible contrast and do not communicate status using color alone.

### Approved desktop dashboard concept

- Left sidebar with logo and navigation.
- Dashboard title, description, and date selector.
- Two pet summary cards, Branca and Marrie.
- Camera footage panel with detection boxes, confidence, and clip/live status.
- Daily activity comparison chart.
- Living room heatmap panel.
- Recent events with thumbnails.
- Daily summary statistics.
- Camera connection indicator.

### Approved mobile dashboard concept

- Same dark visual language and components, adapted to narrow screens.
- Compact header with logo and actions.
- Pet cards optimized for touch and small screens.
- Camera footage card.
- Activity chart, heatmap, recent events, and summary.
- Bottom navigation for the primary destinations.

**Important:** existing designs are conceptual mockups with illustrative numbers, example pet photos, and a simulated live view. Production UI must show actual observed data and accurate recording status. Avoid labeling a downloaded clip as `AO VIVO`.

## 5. Information architecture

1. **Dashboard:** pet presence, activity summary, latest processed clip, trends, recent events.
2. **Activities:** timeline and per-pet activity categories, filters by date/time.
3. **Events:** searchable detection events and linked video snapshots.
4. **Trajectories:** movement paths over a camera image or calibrated room map.
5. **Heatmap:** location and dwell-time distributions, per dog and combined.
6. **Camera:** Blink connection, clip availability, synchronization, ingestion diagnostics.
7. **AI Models:** datasets, training runs, model versions, evaluation metrics, and active model.
8. **Settings:** pets, camera, local storage, retention, privacy, confidence thresholds.

For mobile, prioritize Dashboard, Activities, Events, Trajectories, and Models in bottom navigation; place other destinations in a menu or settings.

## 6. Technical architecture

```text
Blink camera / Blink account
          |
       BlinkPy
          |
   Clip discovery/download   <--- Manual MP4 import fallback
          |
   Local video storage
          |
     OpenCV / FFmpeg
          |
  Frame sampling and quality checks
          |
   YOLO dog detection
          |
 Custom identity model / YOLO fine-tuning
          |
  Object tracking and temporal rules
          |
  Event and activity aggregation
          |
   SQLite + snapshots + artifacts
          |
       Local API
          |
  Responsive web dashboard
```

### Proposed stack

- **Runtime:** Python 3.11 on Windows 11.
- **Blink integration:** `blinkpy`, `aiohttp`.
- **Vision:** `opencv-python`, Ultralytics YOLO (pin and document a tested version/model checkpoint).
- **Tracking:** ByteTrack or a comparable tracker supported by the chosen pipeline.
- **Annotation:** CVAT or another YOLO-compatible bounding-box annotation tool.
- **Storage:** SQLite for metadata, local filesystem for clips, frames, datasets, model weights.
- **API:** FastAPI, if a separate frontend is adopted.
- **Frontend:** responsive React/TypeScript app for fidelity to approved designs, or Streamlit for a deliberately smaller proof of concept. Decide before implementation and document tradeoffs.
- **Charts:** an accessible frontend charting library.
- **Tests:** pytest and sample fixture videos.

**Hardware baseline:** Windows laptop with Intel i7-1065G7, 20 GB RAM, Intel Iris Plus graphics, no NVIDIA GPU. Default to CPU inference/training with small models, limited image size and batch size. Treat runtime as an empirical benchmark, not a promised speed. Optional accelerator support can be added later.

## 7. BlinkPy integration requirements

Implement an adapter rather than mixing BlinkPy calls into vision code.

**Required operations:**

- Authenticate securely, including verification steps when requested.
- Discover account cameras and their identifiers.
- Select the living room camera.
- List/retrieve available clips where the account and library support this.
- Download clips to a configurable local directory.
- Avoid reprocessing previously ingested clips using source IDs and/or hashes.
- Record capture timestamp, download timestamp, source, camera ID, and clip duration.
- Report missing clips, API failures, token expiration, rate limits, and unsupported features.
- Support manual MP4 import at all times.

**Constraints:** BlinkPy uses unofficial Blink interfaces; verify actual APIs against the pinned installed library and avoid assumptions about continuous streaming. Avoid excessive polling, and handle authentication and service changes gracefully. Never commit Blink credentials, cookies, tokens, or household video.

## 8. Computer vision strategy

### Stage A: baseline dog detection

Use a small pretrained YOLO object detector to locate dogs. This proves ingestion, inference, and annotation rendering before attempting pet-specific recognition.

### Stage B: custom identity dataset

Collect varied frames of Branca and Marrie, including:

- Both dogs together and each dog alone.
- Different postures, distances, directions, lighting conditions, and backgrounds.
- Changes in grooming and occlusion where available.
- Negative frames without dogs.

Target approximately 200 to 400 *diverse* annotated images for the first experiment, not a guarantee of accuracy. Avoid thousands of nearly identical consecutive frames. Label each dog with a bounding box and class ID. Use `Branca` and `Marrie` as the first two classes.

Separate train, validation, and test by recording session or time period, not by random neighboring frames. Reserve a held-out test set that is not used for tuning.

### Stage C: fine-tuning

Start from a small pretrained detector and fine-tune for two individual classes. Log dataset version, hyperparameters, model checkpoint, seed, environment, training duration, and evaluation metrics. Test whether direct two-class detection is sufficient. If not, move to dog detection plus cropped-image identity classification or embedding-based re-identification.

### Stage D: tracking

Use tracking IDs within each clip. Tracking IDs are temporary and are not pet identities. Combine track evidence with visual classification and temporal consistency. If the evidence is insufficient, report `Unknown` instead of inventing an identity.

### Stage E: activity inference

For the first activity model, distinguish:

- **Moving:** observed spatial movement across successive frames.
- **Stationary:** detected but little apparent movement within an observation window.
- **Not visible:** dog not reliably detected in the frame.
- **Unknown:** insufficient evidence or poor image quality.

Later investigate posture estimation and temporal classification for standing, lying down, playing, and interactions. Do not equate stationary with sleeping or assign precise behaviors without validated labels.

## 9. Dataset layout

```text
petmonitor-ai/
  README.md
  concept.md
  .env.example
  .gitignore
  pyproject.toml
  configs/
    app.yaml
    dataset.yaml
  src/petmonitor/
    blink/
    ingestion/
    vision/
    tracking/
    activities/
    storage/
    api/
  scripts/
    blink_connect.py
    download_clips.py
    extract_frames.py
    detect.py
    train.py
    evaluate.py
  datasets/                 # gitignored
    images/train/
    images/val/
    images/test/
    labels/train/
    labels/val/
    labels/test/
  data/                     # gitignored
    clips/
    snapshots/
    petmonitor.db
  models/                   # gitignored
  runs/                     # gitignored
  frontend/
  tests/
  docs/
```

Example YOLO dataset config:

```yaml
path: ../datasets
train: images/train
val: images/val
test: images/test
names:
  0: Branca
  1: Marrie
```

Resolve relative paths according to the selected YOLO library's documented behavior; validate them before training.

## 10. Data model

Suggested entities:

- `pets`: ID, name, reference images, notes, active flag.
- `cameras`: ID, name, provider, connection status, last successful sync.
- `clips`: ID, source ID, camera ID, timestamps, duration, file path, hash, processing status.
- `detections`: clip ID, frame timestamp, bounding box, predicted class, confidence, model version.
- `tracks`: clip ID, track ID, associated pet ID or unknown, start/end timestamps.
- `activity_segments`: pet ID, clip ID, start/end, activity label, confidence, evidence type.
- `events`: timestamp, pet, event type, snapshot/clip reference, confidence.
- `model_versions`: training run, dataset version, metrics, weight path, active flag.
- `ingestion_runs`: provider sync times, counts, errors, and completion state.

Store timestamps in UTC, with local time conversion in the UI. Preserve capture timestamps separately from download timestamps.

## 11. Heatmaps and trajectories

Track the bottom-center of each bounding box as an approximate ground contact point, or use pose/keypoint estimates when reliable. Map positions to camera coordinates. A calibrated room-plane homography can be added if sufficient fixed landmarks exist.

Generate separate occupancy and motion heatmaps for Branca and Marrie. Label the distinction clearly: a dwell-time heatmap is not identical to a movement-path heatmap. Note camera perspective distortions, occlusions, and regions outside the camera field of view.

## 12. Analytics and reporting

Show:

- Clips available and clips processed.
- Total **observed** video duration.
- Per-pet visible duration within processed footage.
- Observed moving and stationary time, with uncertainty.
- Detection and classification confidence.
- Event counts and selected snapshots.
- Per-pet trajectories and heatmaps when supported.
- Coverage gaps and time without footage.

Never claim `8 hours monitored` if only 15 minutes of event-triggered video were analyzed. Distinguish observation coverage from wall-clock elapsed time. Counts and percentages must be based on actual processed footage and clearly defined denominators.

## 13. Model evaluation

Track:

- Detection precision, recall, mAP50, and mAP50-95.
- Per-pet confusion matrix and identification accuracy on held-out clips.
- Unknown/abstention rate.
- False positives and missed detections.
- Identity switches during crossings or occlusion.
- Inference speed on the target laptop.
- Results by lighting and camera viewpoint.

Compare pretrained baseline versus personalized model on the same untouched test videos. Record failures with reproducible examples and propose targeted dataset improvements.

## 14. MVP delivery plan

### MVP 0: environment and Blink connectivity

- Create Python environment and install pinned dependencies.
- Authenticate with BlinkPy using a secure local configuration.
- Enumerate cameras and select living room.
- Download one accessible clip, or import MP4 manually.
- Confirm timestamps and playable video.

**Acceptance:** one locally stored, playable video with documented provenance.

### MVP 1: baseline detection

- Open clip with OpenCV.
- Run pretrained YOLO dog detection.
- Save annotated video and detection metadata.
- Benchmark CPU processing speed.

**Acceptance:** a reproducible command generates an annotated output video and a machine-readable detection log.

### MVP 2: personalized identification

- Sample and label diverse frames.
- Split sessions into train/validation/test.
- Train first personalized model.
- Evaluate on held-out footage.
- Identify and document failure cases.

**Acceptance:** model outputs `Branca`, `Marrie`, or `Unknown`, with measured performance and a reproducible training command.

### MVP 3: movement and basic analytics

- Track pets within clips.
- Aggregate visible, moving, stationary, and unknown time.
- Save events and snapshots.
- Build per-pet trajectories and preliminary heatmaps.

**Acceptance:** an event timeline and activity report derived from actual footage.

### MVP 4: responsive dashboard

- Implement the approved desktop and mobile UI.
- Show real stored events, clips, statuses, charts, and heatmaps.
- Provide date and pet filters.
- Clearly distinguish downloaded clips from live footage.

**Acceptance:** responsive application usable on Windows desktop and a mobile browser, without fictional metrics.

## 15. Privacy, security, and reliability

- Local-first video storage and inference.
- Secrets in environment variables or an OS-backed credential store; never in source control.
- Avoid printing auth tokens or sensitive camera URLs in logs.
- Use least-privilege network access where possible.
- Define configurable clip and snapshot retention.
- Protect local API/dashboard if exposed beyond localhost.
- Do not expose the dashboard directly to the public internet by default.
- Handle partial downloads, duplicate clips, malformed video, outages, and API changes.
- Document dependency versions and license obligations for BlinkPy, Ultralytics, and any other libraries before distribution or commercial use.
- Household members and visitors may appear in the footage; minimize unnecessary retention and display.

## 16. Development principles

- Implement in small, verifiable increments.
- Keep provider integration, vision, tracking, storage, and UI modular.
- Prefer simple code over premature distributed architecture.
- Use type hints, structured logging, configuration files, and tests.
- Do not hide uncertain detections or recording gaps.
- Keep sample videos and trained weights out of the Git repository unless intentionally licensed and safe to share.
- Make every experiment reproducible and compare it against a baseline.
- Avoid unnecessary cloud dependencies and paid services.

## 17. Implementation instructions for an AI coding agent

You are a senior Python engineer, computer vision engineer, and product-minded full-stack developer. Build **PetMonitor AI** as a maintainable, privacy-first local application using this concept as the product specification.

Start with **MVP 0 and MVP 1 only**. Do not prematurely implement every future dashboard feature.

1. Inspect the development environment and installed Python version.
2. Create a clean repository structure, README, `.env.example`, `.gitignore`, and dependency configuration.
3. Implement a BlinkPy adapter with camera discovery and available clip ingestion. Verify BlinkPy methods against the installed version; do not assume RTSP/live streaming.
4. Implement manual MP4 import as a guaranteed fallback.
5. Build an OpenCV + pretrained YOLO detection pipeline with configurable model, confidence threshold, sampling rate, and CPU device.
6. Save an annotated MP4 and structured JSON or CSV detection records.
7. Add clear CLI commands, unit tests for non-network logic, error handling, and user-facing setup instructions for Windows PowerShell.
8. Demonstrate how to validate output on a real sample clip without requiring cloud inference.
9. Stop after the MVP acceptance criteria are satisfied and present results, limitations, and the exact next steps for dataset labeling and fine-tuning.

Do not fabricate successful camera connections, model accuracy, processing speed, or live-view support. If Blink credentials, camera model, or footage are unavailable, provide a working offline sample-video workflow and clearly identify the missing prerequisite.

## 18. Open decisions and prerequisites

- Exact Blink camera model and capabilities.
- Availability of cloud/local clip storage through the account.
- Actual sample video showing Branca and Marrie.
- Preferred frontend implementation after the initial computer vision MVP.
- Required clip retention duration and desired local access policy.
- Whether future live view can be obtained reliably and compliantly for this device.
- Availability of enough distinct footage to train robust individual recognition.

## 19. Product vision beyond MVP

PetMonitor AI may evolve into a general-purpose pet activity platform supporting additional animals, cameras, daily behavior comparisons, customizable observation zones, interaction analysis, notifications, long-term trends, and optional local AI-generated daily summaries. All future claims should remain tied to observed evidence and validated models.

---

**Guiding principle:** Build an application that measures what the camera actually observes, explains what the model inferred, and makes its uncertainty visible. The project should be useful for Branca and Marrie while teaching the complete practical lifecycle of a computer vision model.
