# Task: Job Planner Vermillion Rise drawings sync

Status: Partial
Owner: Codex
Created: 2026-06-24
Linear Issue: Not created yet - blocked by unavailable Linear connector in this turn
Related Handoff: None

## Objective

Import the live Job Planner drawing log for Vermillion Rise into Alleato project `67` in an idempotent way, using the confirmed Job Planner drawing/version API surface rather than manual exports.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `docs/ops/tasks/2026-06-24-jobplanner-vermillion-drawings-sync.md`
- `scripts/jobplanner/import-drawings-lib.mjs`
- `scripts/jobplanner/import-drawings.mjs`
- `scripts/jobplanner/__tests__/import-drawings.test.mjs`
- `package.json`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| API surface discovery | Job Planner API key + access-key session tracing | Pass | Confirmed drawing metadata endpoint `GET /projects/5296/versions` and direct PDF path `GET /drawings/{guid}/download` |
| Static/type/lint | `node --check scripts/jobplanner/import-drawings.mjs` + `node --check scripts/jobplanner/import-drawings-lib.mjs` | Pass | Syntax verified for importer and mapping lib |
| Targeted tests | `npm run test:jobplanner-drawings-import` | Pass | 5 focused mapping/current-revision guardrail tests passed |
| Browser/user-flow | `agent-browser --session-name jobplanner-vermillion ...` on live drawings route | Pass | Confirmed drawing UI loads against access-key session and traced real endpoint usage, including thumbnails and drawing settings |
| DB/provider read-back | direct Supabase service-role read-back after import | Pass | Project 67 now has 60 synced Job Planner drawings, 109 synced Job Planner revisions, 60 current revision pointers, and 0 leftover legacy human-named duplicate revisions |
| End-to-end proof | `npm run jobplanner:import-drawings -- --jp=5296 --app=67` followed by dry-run rerun | Pass | Live import converged after schema-guardrail fixes; final pass reported 0 drawing inserts, 109 revision updates, and deleted 107 obsolete duplicate revisions from failed earlier attempts |
| Known unrelated failures | first live pass hit `drawing_sets_status_check`; second hit `drawing_revisions.revision_number varchar(10)`; third hit joined revision count read-back | Documented | All three failures were task-related importer contract gaps and were fixed in the importer before final convergence rerun |

## Risks / Gaps

- Linear issue creation is blocked in this turn because no Linear connector/tool has been used yet.
- Direct external `file_url` references are used for this transition sync; this imports the drawing log and live file links, not a full re-host into Alleato-managed storage.
- No contract-style integration test was added yet for the Job Planner drawing payload boundary; current coverage is mapping/unit tests plus live provider import/read-back.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
