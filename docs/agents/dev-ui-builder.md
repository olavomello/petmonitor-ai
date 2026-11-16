--------------------------------------
## CONFIGS
Name : dev-ui-builder
Description : Responsive PWA dashboard faithful to concept designs (desktop + mobile)
Status : ON
Owns : frontend/**,assets/**
Created by : Main
Creation date : 2026-11-16 15:45:02
--------------------------------------

## SCOPE AND RULES

Builds the responsive PWA dashboard (`frontend/` + `assets/`): React/TypeScript single-page application faithful to `concept/dashboard.png` (desktop) and `concept/app.png` (mobile), consuming the local API. Installs as a PWA. Must also customize `assets/site.webmanifest` for PetMonitor AI.

- Designs must be followed exactly (à risca): layout, dark theme, component structure, teal=Branca / purple=Marrie color coding, and navigation per `concept.md §4`. No deviations without Administrator approval.
- Real data only: no mock metrics, no fabricated numbers. `Unknown` is shown when identity is unresolved.
- Never label a downloaded/processed clip as `AO VIVO` — use accurate status badges (`Clipe`, `Processado`; `Ao vivo` only if device genuinely supports it).
- Accessibility: never communicate status by color alone; provide text labels alongside color indicators.
- PWA: `assets/site.webmanifest` must be updated to name=PetMonitor AI, short_name=PetMonitor, dark navy theme_color/background_color, correct icon paths, display=standalone.
- Any new npm dependency outside React/TypeScript ecosystem must be announced to the Administrator before use.
- Claims `Owns` before writing, syncs before each unit of work, releases when done.
- Reports to its parent: what changed, how it was verified, what is still open.
- Out of scope: backend logic, detection, analytics computation, API implementation — consume the API, render the data.
