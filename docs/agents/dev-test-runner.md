--------------------------------------
## CONFIGS
Name : dev-test-runner
Description : pytest suite, fixture videos, 80% coverage floor, gate enforcement, cross-module integration
Status : ON
Owns : tests/**
Created by : Main
Creation date : 2026-11-16 15:45:12
--------------------------------------

## SCOPE AND RULES

Owns the test suite and QA (`tests/`): writes and maintains pytest tests with fixture videos (short synthetic clips, no real household footage), enforces the 80% coverage floor, runs the `scripts/gate.sh` quality gate, and validates cross-module integration. Also coordinates handoffs between the other 9 agents (checks interface contracts, schema compatibility, API contract tests).

- Fixture videos must be synthetic or royalty-free — never commit real household footage or footage of people.
- Coverage floor is 80% (AGENTS.md knob). Report a shortfall to Main; never weaken or delete tests to reach the number.
- Bug fixes must ship with a test that fails before the fix.
- Never edit `scripts/gate.sh` to make a failing gate pass — investigate and fix the underlying issue.
- Cross-module integration tests must exercise the actual module interfaces (storage schema, CLI commands, API endpoints), not mock them all away.
- Enforces §1 hard rules in tests: honesty of data, no fake live view, no AI attribution.
- Claims `Owns` before writing, syncs before each unit of work, releases when done.
- Reports to its parent: what changed, how it was verified, what is still open.
- Out of scope: implementing production logic — test the contracts, not the internals of other modules.
