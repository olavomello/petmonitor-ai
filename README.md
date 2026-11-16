# PetMonitor AI

> Privacy-first local pet activity monitoring — identifies, tracks, and reports on the daily behavior of Branca and Marrie (Shih Tzus) using computer vision on Blink security camera recordings.

**Stack:** Python 3.11 · OpenCV · Ultralytics YOLO · BlinkPy · SQLite · FastAPI · React/TypeScript PWA (CPU-only, Windows 11)

---

## Table of contents

- [What it does](#what-it-does)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Verification](#verification)
- [Project layout](#project-layout)
- [How we work](#how-we-work)
- [Monitoring](#monitoring)
- [Contributing](#contributing)
- [License](#license)

---

## What it does

**PetMonitor AI** analyzes Blink camera recordings from the living room, identifies the two Shih Tzus **Branca** and **Marrie**, and produces honest, measurable reports on what each pet did during the day.

Everything runs locally: inference, storage, and dashboard. No required cloud services, no data sent to third parties.

**Current MVP:** MVP 0 — environment configured, BlinkPy adapter functional, manual MP4 import guaranteed.

---

## Prerequisites

| Requirement | Min version | Notes |
|---|---|---|
| **Python** | 3.11 | Use the `py -3.11` launcher on Windows (`py -0` lists installed versions) |
| **Git** | any | Required to clone; also ships Git Bash |
| **Git Bash** | any | **Required on Windows** for `scripts/*.sh` — the PATH `bash` in PowerShell is the WSL stub and fails with `execvpe(/bin/bash) failed` |
| **Node.js** | 18+ | Only for project tooling (`scripts/*.mjs`, `ai-dash`) — not required for the Python app |

> **Windows:** install Git for Windows (includes Git Bash). Always run shell scripts via Git Bash or `"C:\Program Files\Git\bin\bash.exe"`, never via the PowerShell `bash`.

---

## Installation

> **Agent prompt** — set up the full Python environment in one shot:
> ```
> py -3.11 -m venv .venv && .venv\Scripts\pip install --upgrade pip setuptools wheel && .venv\Scripts\pip install -e ".[dev]"
> ```

### Clone

```bash
git clone https://github.com/olavomello/petmonitor-ai.git
cd petmonitor-ai
```

### Python backend + CLI

```bash
# Create venv with Python 3.11 (Windows — use the py launcher)
py -3.11 -m venv .venv

# Activate
.venv\Scripts\activate          # PowerShell / CMD
# or: source .venv/Scripts/activate  # Git Bash

# Upgrade build tooling, then install package + dev dependencies
pip install --upgrade pip setuptools wheel
pip install -e ".[dev]"
```

> On first install, `ultralytics` automatically downloads YOLO weights (~6 MB for `yolov8n.pt`). One-time internet connection required.

### Environment variables

```bash
cp .env.example .env
# Edit .env with your Blink credentials:
#   BLINK_USERNAME=your@email.com
#   BLINK_PASSWORD=your_blink_password
```

Credentials stay **only** in the local `.env` — never committed.

### Frontend (MVP 4 — not yet implemented)

```bash
cd frontend && npm install   # pending MVP 4
```

---

## Quick start

> **Agent prompt** — import a local clip and verify the pipeline:
> ```
> .venv\Scripts\petmonitor-ingest --file <path/to/clip.mp4>
> ```

### Import an MP4 clip manually (no camera required)

The manual path is the guaranteed fallback and works without a camera or credentials:

```bash
petmonitor-ingest --file path/to/clip.mp4
# Optionally with a capture timestamp:
petmonitor-ingest --file clip.mp4 --capture-at 2026-11-16T10:00:00Z
```

### Check Blink camera connectivity

```bash
# Requires .env populated with BLINK_USERNAME and BLINK_PASSWORD
petmonitor-blink
# For a specific camera:
petmonitor-blink --camera "Living Room"
```

### Run the local API (MVP 2+)

```bash
uvicorn petmonitor.api.main:app --reload
# Open: http://127.0.0.1:8000/docs
# API binds to localhost only — not publicly exposed.
```

---

## Verification

> **Agent prompt** — run the full gate before every commit:
> ```
> "C:\Program Files\Git\bin\bash.exe" scripts/gate.sh
> ```

`scripts/gate.sh` is the single verification command: tests, coverage, and version gate in one step. Both humans and agents run it before every commit.

```bash
# Windows — always use Git Bash, never the PowerShell bash
"C:\Program Files\Git\bin\bash.exe" scripts/gate.sh

# With release checks:
"C:\Program Files\Git\bin\bash.exe" scripts/gate.sh --release
```

The gate is configured in `.agents/gate.conf` to use the pytest from `.venv`. If `.venv` does not exist, create it first (see [Installation](#installation)).

**Current state:** 32 tests, 96% coverage — ✅ gate passes.

---

## Project layout

```
petmonitor-ai/
├── src/petmonitor/           # Main Python package
│   ├── blink/                # BlinkPy adapter (auth, discovery, download)
│   ├── ingestion/            # Clip intake, SHA-256 dedup, provenance
│   ├── vision/               # OpenCV + YOLO detection (MVP 1)
│   ├── tracking/             # Tracking + Branca/Marrie identity (MVP 2)
│   ├── activities/           # Analytics, heatmaps, trajectories (MVP 3)
│   ├── storage/              # SQLite schema and data layer (MVP 1+)
│   └── api/                  # FastAPI local — localhost only (MVP 2+)
│
├── frontend/                 # React/TypeScript PWA (MVP 4)
├── tests/                    # pytest — 32 tests, 96% coverage
├── configs/
│   ├── app.yaml              # Runtime config (storage, detection, API, pets)
│   └── dataset.yaml          # YOLO dataset config (Branca=0, Marrie=1)
│
├── scripts/                  # Project tooling (gate, agents, ADR, ai-dash)
├── docs/
│   ├── agents/               # Definitions for all 10 agents
│   ├── adr/                  # Architecture Decision Records
│   ├── repo-map.md           # Repository map
│   └── decisions.md          # Architectural decision log
│
├── concept/
│   ├── concept.md            # Full product specification
│   ├── dashboard.png         # Approved design — desktop
│   └── app.png               # Approved design — mobile/PWA
│
├── assets/                   # Brand and PWA assets (logo, icons, manifest)
├── ai-dash/                  # Static agent-monitoring dashboard
├── .env.example              # Environment variable template
├── pyproject.toml            # Python package metadata and dependencies
├── AGENTS.md                 # Binding rules for all agents
├── AGENT_TEAM.md             # Policy and protocol for the 10-agent team
├── VERSION                   # SemVer source of truth
└── CHANGELOG.md              # Keep a Changelog history
```

**Git-ignored directories** (local data, never committed):

| Directory | Contents |
|---|---|
| `data/` | Downloaded clips, snapshots, `petmonitor.db` |
| `datasets/` | Training images and labels |
| `models/` | Trained model weights |
| `runs/` | Training/evaluation run artifacts |
| `.venv/` | Python virtual environment |

---

## How we work

- **Rules first.** Agents read `AGENTS.md`; they open `docs/agents/*` and `docs/guides/*` only when the task touches that area.
- **One verification path.** Nothing is "done" until `scripts/gate.sh` passes.
- **Decisions are recorded.** Architectural changes get an ADR: `node scripts/adr.mjs new "<title>"` (see `docs/adr/`).
- **SemVer.** `VERSION` and release entries in `CHANGELOG.md` are owned by the main agent; user-visible changes go under `[Unreleased]`.
- **Agents work in isolation.** Parallel agents use their own worktrees (`bash scripts/agent-team.sh list`).
- **10 specialized agents.** Each module has an owner: `@agent-dev-blink-integrator`, `@agent-dev-vision-detector`, `@agent-dev-ui-builder`, etc. See `AGENT_TEAM.md`.

---

## Monitoring

Each gate run is logged locally and aggregated for the dashboard:

```bash
node scripts/ai-dash.mjs   # Serves ai-dash/ on 127.0.0.1 with a Settings area
```

`ai-dash/` is a static site and can be published as an internal monitoring page. See `ai-dash/README.md`.

---

## Contributing

1. Branch from `main` following the model in `AGENTS.md` section 0.
2. Make a focused change and add or update tests.
3. Run `"C:\Program Files\Git\bin\bash.exe" scripts/gate.sh` until it passes.
4. Add a line under `[Unreleased]` in `CHANGELOG.md` for any user-visible change.
5. Open a pull request.

---

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center"><sub>Powered by <a href="https://github.com/olavomello/ai-project-starter"><strong>AIS</strong></a> — AI Project Starter</sub></p>
