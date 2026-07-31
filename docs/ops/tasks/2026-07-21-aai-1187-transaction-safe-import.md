# Task: Make Schedule Replacement Imports Atomic

Status: Done
Owner: Codex SROOT1187
Created: 2026-07-21
Task ID: AAI-1187
Linear Issue: [AAI-1187](https://linear.app/megankharrison/issue/AAI-1187/make-schedule-replacement-imports-transaction-safe)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT1187-transaction-safe-import.md`

## Objective

An authorized project manager can validate and replace a schedule in one database transaction, with dependencies preserved exactly or rejected before the live schedule changes.

## Scope

- Own validated import input, dry-run diff, atomic replacement RPC, API integration, focused tests, and canonical schedule-import UI proof.
- Preserve dependency type and lag values supplied by structured imports.
- Exclude file parsing format expansion and project calendars; the existing preview/parser remains the source of imported task data.

## Source of Truth

- Canonical runtime/data owner: `schedule_tasks`, `schedule_dependencies`, and the schedule import route.
- Existing shared primitives/services: `schedule-import-preview.ts`, `SchedulingService`, Supabase RPC migrations, canonical `/<projectId>/schedule/import` route.
- Deprecated or parallel paths: delete-then-create import loop in `tasks/import/route.ts`; it must not remain a replacement path.

Verification contract: Required

## Acceptance Criteria

- [x] Invalid rows, duplicate IDs, missing predecessor references, and unsupported dependency semantics fail before any write.
- [x] Replacement is one transaction; a task/dependency failure leaves the prior schedule unchanged.
- [x] Preview reports the parsed task/dependency outcome that the subsequent import applies.
- [x] Focused tests started red and cover validation, cycle detection, and committed RPC outcome.

## Implementation Checklist

- [x] Existing route, parser, canonical UI, and database data contract were inspected.
- [x] Shared preview validation owns external-ID/dependency validation.
- [x] Database RPC owns replacement writes and transaction rollback.
- [x] API returns actionable validation or atomic-write errors, never partial-success results.
- [x] Existing schedule rows/dependencies are preserved on every rejected import.

## Integration and Verification

- [x] Focused preview/route/RPC tests pass.
- [x] Migrations are applied and verified through the configured Supabase API.
- [x] Authenticated canonical import route shows dry-run outcome and failure behavior.
- [x] RPC return contract proves committed task/dependency counts match the validated payload and production route proof is recorded.
- [x] Task-owned files and closeout evidence are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: exact row index, external ID, predecessor reference, dependency type, or database replacement error.
- Detection path: validation before mutation, atomic-RPC errors, and route regression tests.
- Recovery path: correct the listed source row/reference, preview again, then submit the validated import.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: replacement deletes the live schedule before all imported tasks/dependencies have been proven valid, and unresolved predecessors are silently skipped.
- Detection gap: existing import tests do not assert no writes on invalid references or a rollback on downstream failure.
- Prevention: one shared validator plus a transactional RPC that accepts only prevalidated payloads.
- Guardrail evidence: red-to-green `schedule-import-atomic` and import-route tests; the RPC repeats input validation inside the same transaction and explicitly blocks unauthenticated and cross-project calls.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Current-state localization | `tasks/import/route.ts` | Pass | Existing replacement deletes dependencies/deadlines/tasks before item-by-item creates; unresolved predecessors are ignored. |
| Task setup | This task file and AAI-1187 | Pass | Scope and data ownership recorded before implementation. |
| Red test | `schedule-import-atomic.test.ts` before implementation | Pass | 3 failing assertions: missing validator and discarded dependency type/lag. |
| Focused regression suite | `npm run test:unit -- --runInBand --runTestsByPath ...` | Pass | 4 suites, 13 tests. |
| Targeted lint | `npx eslint` on owned schedule files | Pass with warnings | 0 errors; four pre-existing raw-grid warnings in the import page. |
| Full TypeScript | `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` | Baseline fail | 277 unrelated errors; none reference AAI-1187-owned files. |
| Migration apply/read-back | Supabase `apply_migration` + function/privilege queries | Pass | Atomic RPC is `SECURITY INVOKER`; authenticated/service role execute; anon is revoked; project membership/app-admin guard is present. |
| Migration ledger script | `npm run db:migrations:verify-applied -- ...` | Tooling blocked | CLI has no linked DB password or management token in this isolated workspace; configured Supabase API applied and read back each migration instead. |
| Browser-auth preflight | `npm run verify:browser -- --url 'https://projects.alleatogroup.com/43/schedule/import' --name aai1187-auth-preflight` | Pass | Repository-owned verifier refreshed/validated protected-route state and recorded screenshots/video in `tests/agent-browser-runs/2026-07-22T00-51-38-729Z-aai1187-auth-preflight/`. |
| Canonical desktop rejection | AAI-1187 attachment: `AAI-1187 desktop atomic import rejection` | Pass | On deployed `/43/schedule/import`, a CSV preview displayed two tasks/one dependency; submitting a missing predecessor returned the precise error before replacement, with the protected 187-task schedule visible. |
| Canonical mobile rejection | AAI-1187 attachment: `AAI-1187 mobile atomic import rejection` | Pass | The same failure-loud, no-replacement behavior is visible at 390×844. |

## Remaining Risk

- No remaining task-specific risk. Independent review accepted the implementation and canonical proof; repo-wide TypeScript debt remains outside this task's owned files.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
