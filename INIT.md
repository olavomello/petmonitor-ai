# PetMonitor AI — Initialization Guidelines (`INIT.md`)

**Version:** 1.0
**Date:** 2026-11-16
**Status:** Initialization guide — authoritative procedure for bootstrapping the project
**Repository:** https://github.com/olavomello/petmonitor-ai
**Primary language for code & identifiers:** English
**Initial interface language:** Portuguese (Brazil), built for future localization

> This document is the single source of truth for **how to initialize PetMonitor AI**.
> It consolidates three inputs that must all be honored:
> 1. `AGENTS.md` — the `ai-project-starter` template bootstrap workflow.
> 2. `concept/concept.md` — the approved product concept and specification.
> 3. The owner's initialization directives (repo, approved libraries, agent count, UI fidelity, PWA assets).
>
> Where any guidance conflicts, the order of precedence is:
> **owner's explicit directives → `concept.md` → `AGENTS.md` template defaults.**

---

## 0. What this project is (one paragraph)

PetMonitor AI is a **privacy-first, locally operated computer-vision application** that analyzes
home security-camera recordings to identify and track two Shih Tzu dogs — **Branca** and **Marrie** —
and produce honest, measurable, timestamped reports about their observed activity in the living room.
It is also a hands-on learning laboratory for Python, OpenCV, YOLO fine-tuning, tracking, and MLOps.
See `concept/concept.md` for the full specification.

---

## 1. Hard rules (non-negotiable)

These apply to every agent, commit, file, and UI screen.

1. **No AI/tool attribution anywhere.** Never write "Claude", "Copilot", "Generated with …",
   "Co-Authored-By: <assistant>", or any AI/tool name in commit messages, PR descriptions, code
   comments, or docs. This is a hard rule of both the starter (`AGENTS.md` step 6) and the owner.
2. **Honesty of data over impressive numbers.** The UI and reports must show **only what the camera
   actually observed**. Never claim "8h monitored" when only minutes of event-triggered clips were
   analyzed. Always separate *observation coverage* from *wall-clock time*. Make uncertainty visible
   (`Unknown` is a valid, expected output).
3. **No fake live view.** A downloaded/processed clip must **never** be labeled `AO VIVO`. The approved
   mockups use `AO VIVO` illustratively; production must show accurate recording status
   (e.g. `Clipe`, `Processado`, `Ao vivo` only if the device genuinely supports it).
4. **Local-first & private.** Video, inference, and storage stay on the local machine. Never commit
   Blink credentials, cookies, tokens, household video, trained weights, or datasets. Secrets live in
   environment variables / OS credential store only.
5. **Approved libraries only (see §4).** Any library outside the approved list must be security-evaluated
   and explicitly announced to the owner **before** it is added.
6. **Follow the approved designs exactly** (see §6). The designs in `concept/` are to be followed *à risca*.
7. **Small, verifiable increments.** Start at MVP 0 + MVP 1 only (see §7). Do not pre-build future features.

---

## 2. Project identity

| Field | Value |
|---|---|
| Name | **PetMonitor AI** |
| Tagline | Intelligent Pet Activity Monitoring / *Monitoramento inteligente da Branca e da Marrie* |
| Repo | https://github.com/olavomello/petmonitor-ai |
| Pets | **Branca** (Shih Tzu) and **Marrie** (Shih Tzu) — user-provided labels; identity must be *learned* from footage |
| Platform | Windows 11, Python 3.11, CPU-only (i7-1065G7, 20 GB RAM, Intel Iris Plus, no NVIDIA GPU) |

**Brand colors:** teal = **Branca**, purple = **Marrie** (analytics only). Keep the official logo colors
consistent (dark-navy wordmark `PetMonitor`, teal `AI`, teal viewfinder corners). Dark mode is the baseline.
Never communicate status by color alone (accessibility).

---

## 3. Bootstrap workflow (from `ai-project-starter` template)

This is the procedure described in `AGENTS.md`. It has **not been executed yet** and requires owner input
(the questions below are asked **one at a time**, accepting blank → default). Run it only when the owner
confirms, because it performs irreversible actions (git init, first commit, plugin install).

### 3.1 Steps

1. **Clone** `https://github.com/olavomello/ai-project-starter.git` (branch `main`, unless a tag/ref is pinned)
   into a temporary location; copy its `template/` directory into the project directory (`petmonitor-ai`).
2. **Ask the owner** these questions one at a time (default in parentheses, blank accepts default):
   - Name (default: project directory name → `petmonitor-ai`)
   - Purpose — one line (default: blank)
   - Stack (default: blank)
   - Administrator (default: blank)
   - Test coverage floor (default: **80%**)
   - Max file lines / function lines (default: **800 / 50**)
   - Mutation allowed in hot paths — yes/no (default: **no**)
   - Branch model (default: **trunk / `main`**)
   - Release cadence (default: **on demand**)
   - Task token budget S / M / L (default: **off**)
   - Enable the in-session status mod for Claude Code? — Y/n (default: **yes**)
3. **Write answers into section 0** of the new project's `AGENTS.md` (`- Name:` / `- Purpose:` / `- Stack:` /
   `- Administrator:` lines + the `Knobs` table including the task-token-budget row). Touch nothing else.
4. **If the mod is enabled** (yes/blank): run `node scripts/mod.mjs enable` inside the project **before the
   first commit**, then install the plugin on this machine:
   `claude plugin marketplace add olavomello/ai-project-starter#main` and
   `claude plugin install ai-dash@ai-project-starter --scope project` (run inside the project; if `claude`
   is not on PATH, give the owner those two commands instead).
5. **Adopt the manifest:** `node <clone>/cli/bin.js adopt petmonitor-ai --ref <branch-or-tag-cloned>`
   → writes `.ai-project-starter.json` (needed so `ai-project-starter update` can pull starter improvements later).
   Must run before the first commit so the baseline matches what is committed.
6. **`git init`**, stage everything, first commit:
   `chore: initialize project from ai-project-starter (agent-guided)` — **no AI/tool name anywhere** (§1.1).
   If git is unavailable, skip this step, copy files, and tell the owner to init the repo themselves.
7. **`node <clone>/cli/bin.js doctor petmonitor-ai`** → report result (checks structure + Claude Code setup:
   hooks, mod pin/install, uncommitted setup files). Add `--fix` to auto-repair.
8. **`bash scripts/gate.sh`** inside the project → report result. **On Windows use Git Bash**
   (`"C:\Program Files\Git\bin\bash.exe"`), not the PATH `bash` (that is the WSL stub and fails with
   `execvpe(/bin/bash) failed`).
9. **Tell the owner the next steps:** run the starter agent (`docs/agents/sys-init-starter.md`), add a git
   remote (`petmonitor-ai`) and push, and read the rest of `AGENTS.md`.

### 3.2 Current state of the repo (as of this document)

```
petmonitor-ai/
  AGENTS.md              # starter bootstrap instructions (template workflow)
  INIT.md                # this file
  concept/
    concept.md           # full product spec
    dashboard.png        # approved desktop design
    app.png              # approved mobile / PWA design
  assets/                # brand + PWA assets (see §6.3)
    logo.png  icon.png
    favicon.ico  favicon.svg  favicon-96x96.png  apple-touch-icon.png
    web-app-manifest-192x192.png  web-app-manifest-512x512.png
    site.webmanifest     # ⚠ still the generic template default — must be customized (§6.3)
```

The source tree described in `concept.md §9` (`src/petmonitor/...`, `scripts/`, `datasets/`, `data/`,
`models/`, `runs/`, `frontend/`, `tests/`, `docs/`) does **not exist yet** and is created during MVP work.

---

## 4. Approved libraries & the evaluation rule

**Recognized / approved up front** (safe to use without a separate check):

| Library | Purpose | Reference |
|---|---|---|
| **blinkpy** | Blink camera account/device integration & clip retrieval | https://github.com/fronzbot/blinkpy |
| **YOLO** (Ultralytics) | Dog detection + fine-tuning for identity | pin & document the tested version/checkpoint |
| **OpenCV** (`opencv-python`) | Frame sampling, video I/O, annotation rendering | — |
| **SQLite** | Local metadata storage | standard library `sqlite3` |

**The rule for everything else:** any additional dependency (e.g. a tracker like ByteTrack, FastAPI,
a charting lib, a frontend framework, FFmpeg bindings, `aiohttp`) is **not pre-approved**. Before adding it,
an agent must:

1. **Evaluate it for safety** — maintenance status, license, known CVEs, transitive dependency weight,
   whether it phones home or pulls remote models at runtime.
2. **Announce it to the owner** — state the library, why it is needed, the alternative(s) considered, and
   the license — and proceed only after it is accepted.

Pin exact versions and document license obligations (`blinkpy`, Ultralytics, and any new addition) before
distribution or commercial use. Prefer the standard library and the approved set; avoid cloud/paid services.

> **Note on BlinkPy:** it uses *unofficial* Blink interfaces. Do **not** assume continuous RTSP/ONVIF live
> streaming. Verify every method against the pinned installed version. Manual MP4 import is the guaranteed
> fallback and must always work.

---

## 5. The 10 agents

The project is built and maintained by **10 specialized agents**, mapped to the architecture modules in
`concept.md §6`. Each agent owns a module, respects the boundaries, and hands off through well-defined
interfaces (storage schema, config files, CLI commands). Keep provider integration, vision, tracking,
storage, and UI **modular** — no vision code inside the Blink adapter, no Blink calls inside vision.

| # | Agent | Owns (module) | Primary responsibilities |
|---|---|---|---|
| 1 | **Blink Integration** | `src/petmonitor/blink/` | BlinkPy adapter: secure auth (incl. verification), camera discovery, clip listing/download, error/rate-limit/token-expiry reporting. Never touches vision logic. |
| 2 | **Ingestion** | `src/petmonitor/ingestion/` | Clip intake, de-duplication (source IDs/hashes), manual MP4 import fallback, provenance (capture vs download timestamps), ingestion-run records. |
| 3 | **Vision / Detection** | `src/petmonitor/vision/` | OpenCV + pretrained YOLO detection; frame sampling & quality checks; annotated MP4 + JSON/CSV detection logs; configurable model/threshold/sample-rate/CPU device. |
| 4 | **Identity / Tracking** | `src/petmonitor/tracking/` | Track IDs within clips (track ID ≠ pet identity); combine track evidence + classification + temporal consistency; emit `Branca` / `Marrie` / `Unknown`; handle identity switches at crossings. |
| 5 | **Activities / Analytics** | `src/petmonitor/activities/` | Aggregate `moving` / `stationary` / `not visible` / `unknown`; observed-duration math with clearly defined denominators; events, trajectories (bottom-center ground point), heatmaps. |
| 6 | **Storage / Data** | `src/petmonitor/storage/` | SQLite schema (`concept.md §10`), snapshots, model artifacts; UTC timestamps with local-time UI conversion; retention policy. |
| 7 | **API** | `src/petmonitor/api/` | Local API (FastAPI, pending approval per §4) exposing stored events/clips/status/metrics; localhost-only by default; never expose to public internet. |
| 8 | **Frontend / PWA** | `frontend/` + `assets/` | Responsive dashboard faithful to `concept/dashboard.png` & `concept/app.png`; real data only; PWA (manifest, icons, installable). Distinguish clip vs live. |
| 9 | **ML / Training & Evaluation (MLOps)** | `scripts/train.py`, `scripts/evaluate.py`, `datasets/`, `runs/`, `models/` | Dataset versioning, fine-tuning, reproducible runs (seed, hyperparams, env, duration), metrics (precision/recall/mAP50/mAP50-95, confusion matrix, abstention rate), baseline-vs-personalized comparison. |
| 10 | **QA / Testing & Orchestration** | `tests/`, CI, `scripts/gate.sh` | pytest + fixture videos, coverage floor, the `gate.sh` quality gate, cross-module integration, enforcing §1 hard rules. Coordinates handoffs between the other 9 agents. |

Agents collaborate through the shared **SQLite schema**, **config files** (`configs/app.yaml`,
`configs/dataset.yaml`), and **CLI commands** — not by reaching into each other's code.

---

## 6. UI / design fidelity (follow *à risca*)

### 6.1 Source of truth
The approved designs live in `concept/`:
- **`concept/dashboard.png`** — desktop dashboard.
- **`concept/app.png`** — mobile / PWA app.

These are to be followed **exactly** in layout, dark theme, components, and the teal(Branca)/purple(Marrie)
color coding. Reproduce the structure from `concept.md §4`:

- **Desktop:** left sidebar (logo + nav: Dashboard, Atividades, Eventos, Trajetórias, Heatmap, Câmera,
  Modelos (AI), Configurações); title + date selector; two pet summary cards (Branca, Marrie); camera
  footage panel with detection boxes + confidence + status; "Atividades do dia" comparison chart;
  "Mapa de circulação (Heatmap)" panel; "Eventos recentes" with thumbnails; "Resumo do dia" stats;
  camera connection indicator (`Blink – Living Room`).
- **Mobile/PWA:** same visual language adapted to narrow screens; compact header (logo + bell + settings);
  touch-optimized pet cards; footage card; chart + heatmap; recent events; summary; **bottom navigation**
  (Dashboard, Atividades, Eventos, Trajetórias, Modelos).

### 6.2 Honesty overrides the mockup
The mockups contain **illustrative** numbers, example pet photos, and a simulated live view. Production must:
- Show **real stored data** only.
- Replace the illustrative `AO VIVO` badge with accurate status for downloaded/processed clips (§1.3).
- Base every count/percentage on actually processed footage with defined denominators.

### 6.3 Brand & PWA assets
Assets are in `assets/`: `logo.png`, `icon.png`, `favicon.ico`, `favicon.svg`, `favicon-96x96.png`,
`apple-touch-icon.png`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`, `site.webmanifest`.

⚠ **Action item:** `assets/site.webmanifest` is still the generic template default
(`"name": "MyWebSite"`, white theme). The Frontend/PWA agent must customize it for PetMonitor AI:
`name` = "PetMonitor AI", `short_name` = "PetMonitor", dark `theme_color`/`background_color` matching the
design (navy), correct icon `src` paths, and `display: "standalone"`. Wire the favicons and
`apple-touch-icon` into the app head.

---

## 7. MVP sequencing

Build in order; **start with MVP 0 + MVP 1 only**, then stop and present results, limitations, and next steps.

| MVP | Goal | Acceptance |
|---|---|---|
| **0** | Environment + Blink connectivity | One locally stored, playable video with documented provenance (Blink download *or* manual MP4). |
| **1** | Baseline detection | A reproducible command produces an annotated MP4 + machine-readable (JSON/CSV) detection log; CPU speed benchmarked. |
| **2** | Personalized identification | Model outputs `Branca` / `Marrie` / `Unknown` with measured performance on held-out footage + reproducible training command. |
| **3** | Movement & basic analytics | Event timeline + activity report (visible/moving/stationary/unknown) with per-pet trajectories & preliminary heatmaps, from real footage. |
| **4** | Responsive dashboard | Approved desktop + mobile UI on real stored data, date/pet filters, clips clearly distinguished from live — no fictional metrics. |

Do not fabricate camera connections, accuracy, speed, or live-view support. If credentials/camera/footage
are missing, deliver the offline sample-video workflow and clearly name the missing prerequisite.

---

## 8. Privacy, security & reliability checklist

- Local-first storage and inference; no mandatory cloud inference.
- Secrets in env vars / OS credential store — **never** in source control.
- Never print auth tokens or sensitive camera URLs in logs.
- `.gitignore` must exclude `datasets/`, `data/`, `models/`, `runs/`, clips, snapshots, `.env`, credentials.
- Configurable clip/snapshot retention; minimize retention of footage containing people.
- Protect the local API/dashboard if exposed beyond localhost; never public by default.
- Handle partial downloads, duplicate clips, malformed video, outages, and API changes gracefully.
- Document dependency versions + license obligations before distribution.

---

## 9. Immediate next steps

1. **Confirm scope** with the owner: run the §3 template bootstrap now, or go straight to MVP 0 + MVP 1
   scaffolding under the existing folder.
2. If bootstrapping: execute §3 steps 1–9 (ask the questions one at a time; no AI attribution in the commit).
3. Create the `concept.md §9` source tree and `.gitignore`/`.env.example`/`pyproject.toml`.
4. Pin and document approved library versions (§4); announce any new dependency before adding it.
5. Begin MVP 0 (Blink adapter + manual MP4 fallback) → MVP 1 (OpenCV + YOLO baseline detection).
6. Customize `assets/site.webmanifest` and wire PWA assets when the Frontend/PWA agent starts (MVP 4).

---

**Guiding principle:** Build an application that measures what the camera actually observes, explains what
the model inferred, and makes its uncertainty visible — useful for Branca and Marrie while teaching the
complete practical lifecycle of a computer-vision model.
