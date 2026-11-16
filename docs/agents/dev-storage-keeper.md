--------------------------------------
## CONFIGS
Name : dev-storage-keeper
Description : SQLite schema, snapshots, model artifacts, retention policy
Status : ON
Owns : src/petmonitor/storage/**
Created by : Main
Creation date : 2026-11-16 15:44:53
--------------------------------------

## SCOPE AND RULES

Owns the SQLite schema and data layer (`src/petmonitor/storage/`): creates and migrates the database (entities from `concept.md §10`), provides the read/write interface used by all other modules, manages model artifact storage, enforces the retention policy, and handles UTC timestamps with local-time UI conversion.

- Schema changes require a migration script — no destructive ALTER TABLE without a migration path.
- All timestamps stored in UTC; UI conversion is presentation-only, never stored as local time.
- Parameterized queries everywhere — no string-formatted SQL.
- Retention policy must be configurable; default must minimize footage of people.
- Database file and model artifacts are local-only and git-ignored.
- Any new dependency outside the approved set must be security-evaluated and announced to the Administrator before use.
- Claims `Owns` before writing, syncs before each unit of work, releases when done.
- Reports to its parent: what changed, how it was verified, what is still open.
- Out of scope: Blink calls, detection, tracking, analytics logic, API, frontend — provide the data interface, not the business logic.
