# Task: Integrate Plane Intake actions

Status: Ready for Re-review
Owner: Codex S20260731-PLANE-INTAKE-INTEGRATION
Created: 2026-07-31
Task ID: AAI-PLANE-INTAKE-INTEGRATION

Delivery lane: High-risk

## Objective

Replace the legacy Outlook Ignore/Restore control in the Plane-derived Intake
surface with the reviewed Plane action controller for task and Outlook rows.

## Scope

- Plane Intake client and focused tests
- Plane Intake action controller and endpoint
- Outlook Intake persisted-state projection
- Intake adapter resolution view model
- No production data mutation, migration, publication, or legacy-route removal

## Acceptance Contract

- [x] Accept, decline, snooze, unsnooze, and duplicate actions are exposed from
  the selected Intake row.
- [x] Action requests use the real task or Outlook row identifier and active
  project ID.
- [x] Duplicate candidates come from the current permitted task query.
- [x] Persisted decisions and snooze state survive query refreshes.
- [x] Outlook actions remain disabled without strict app-admin access.
- [x] The legacy Ignore/Restore mutation path is removed from this replacement
  client.
- [x] Focused integration and API tests pass.
- [x] Targeted lint and changed-code guardrails pass.
- [x] Non-admin task actions enforce the same mine/all assignment policy on the
  server for both source and duplicate-target rows.
- [x] Task acceptance preserves multi-project scope, reports already-scoped
  acceptance as idempotent, and uses optimistic scope/version checks.
- [x] Outlook claim finalization and cleanup re-read current JSON metadata and
  use version CAS so unrelated metadata cannot be overwritten.
- [x] Every post-task-creation Outlook finalization failure uses the shared
  compensation path to remove the created task and release the acceptance
  claim; rollback failure returns an explicit cross-database error.
- [x] Public failures redact persistence-provider messages while server logs
  retain diagnostic causes.
- [x] Source IDs are discriminated: task IDs are UUIDs and Outlook IDs are
  canonical positive safe-integer strings.
- [ ] Independent review passes.

## Failure-Loudly Contract

The shared action controller reports the failing action and API error, preserves
the current selection, and leaves server state authoritative until a successful
refresh. The route independently verifies authentication, project permission,
source ownership, and Outlook administrator access.

## Remaining Release Gates

- Authenticated browser proof at desktop and mobile widths.
- Mocked interaction proof for every action.
- Live-data readback and mutation verification only during an explicitly
  approved release checkpoint.

## Evidence

- Jest action and Outlook API contracts: 3 suites, 24 tests passed.
- Vitest Intake adapter/template/access/source contracts: 4 files, 15 tests
  passed.
- Vitest action interaction controller: 1 file, 3 tests passed across accept,
  decline, snooze, unsnooze, and duplicate actions.
- Targeted ESLint: passed.
- Focused correction regressions: 2 suites, 31 tests passed.
- Full TypeScript verification was intentionally stopped after the machine
  pressure gate reported only 1.08 GB free; no broad build or suite was run.
- `quality:changed`: passed with no new `any`, unsafe patterns, raw errors, or
  unguarded changed routes.
