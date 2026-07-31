# Task: Project Creation Attribution Audit

Status: Complete
Owner: Codex SROOT-PCREATE-0722
Created: 2026-07-22
Task ID: LOCAL-2026-07-22-project-creation-attribution
Linear Issue: N/A — single-session local task; external tracking was not requested.
Related Handoff: N/A — single-session task with no review handoff.

## Objective

Every newly created project records immutable actor, source, and correlation evidence, and app admins can inspect that evidence from a dedicated Company Settings table.

## Scope

- Add and apply the project creation attribution database contract and scoped audit projection.
- Update all known production, integration, and test project writers to satisfy the contract.
- Add an app-admin-only project creation log API and table page using the shared table owner.
- Exclude general-purpose raw audit-log expansion and retrospective guessing of missing historical actors.

## Source of Truth

- Canonical runtime/data owner: `public.projects` immutable creation columns plus `public.db_audit_log` INSERT events.
- Existing shared primitives/services: `frontend/src/components/tables/unified/UnifiedTablePage.tsx`, `frontend/src/lib/guardrails/api.ts`, and `frontend/src/lib/auth/require-app-admin.ts`.
- Deprecated or parallel paths: The owner-only generic `/db-audit-log` page remains separate because it exposes broader raw audit data.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Request-driven creation records the authenticated user and request ID.
- [x] Acumatica and automation creation records a stable run ID and explicit source.
- [x] Missing or mutable attribution fails loudly at the database boundary.
- [x] Existing projects are labeled from evidence or explicitly marked `legacy_unknown`; no actor is guessed.
- [x] App admins can search and filter a read-only creation log without access to raw audit JSON.
- [x] `GW Excel Playground` remains an explicit historical attribution gap unless source evidence identifies an actor.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, authentication, permission, and delivery contracts are handled.

Owned paths: the task migration; project creation API/bootstrap routes; Acumatica sync; project-creation helpers/tests; scoped audit API/page/feature/hook; Company Settings registry; app-admin access map/tests; project-writing test helpers; generated database types; this task file.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Remote migration ledger and live SQL readback prove the database contract.
- [x] Authenticated browser evidence proves the admin table and a project link.
- [x] Independent review passes or its findings are resolved.
- [x] Task-owned files are published to `origin/main` through the exact-file remote-main flow.

## Failure-Loudly Contract

- Cause surfaced as: PostgreSQL `23514` with a specific missing-source, missing-actor, missing-correlation, or immutable-attribution message.
- Detection path: migration contract checks, focused writer tests, and the UI `Legacy gap` state.
- Recovery path: fix the originating writer to supply authenticated request or integration run evidence; do not rewrite historical attribution.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: Service-role project writers removed `auth.uid()` context, while `projects` had no explicit creator/source/correlation contract.
- Detection gap: The generic audit trigger recorded a null actor without request or integration-run context, so later investigation could not identify the creator.
- Prevention: Immutable attribution columns, a fail-closed database trigger, updated writers, and a scoped audit table.
- Guardrail evidence: Applied migration assertions, rollback trigger probes, focused writer tests, and live readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, acceptance contract, and failure behavior captured before product edits. |
| Supabase types gate | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Pass | Current remote schema generated before database code. |
| Current security guidance | Supabase RLS documentation | Pass | Security-invoker view plus explicit least-privilege grants selected. |
| Migration ledger | `npm run db:migrations:verify-applied -- <migration>` for `20260722155223`, `20260722155508`, and `20260722164000` | Pass | All three task migration versions are present in the remote ledger. |
| Database coverage assertion | `20260722164000_verify_project_creation_audit_coverage.sql` applied to PM Supabase | Pass | 120 current projects, 120 current-project log rows, 0 missing rows, and 0 mislabeled legacy rows. The log retains 152 rows including deleted-project evidence. |
| Database access | `has_table_privilege` live readback | Pass | `anon=false`, `authenticated=false`, `service_role=true` for the scoped view. |
| Historical evidence | Live `project_creation_audit_log` readback | Pass | Project 1145 `GW Excel Playground` is retained after deletion with null actor, `legacy_unknown`, correlation `legacy-audit:0e6672d8-79e6-4562-81a1-b26b5a0cdf42`, and `legacy_gap`. Project 1146 is the current Acumatica-synced record with run evidence. |
| Frontend unit/regression tests | Focused Jest command for six task suites | Pass | 6 suites and 33 tests passed, including spoof resistance and specific database-attribution failure handling. |
| Backend writer regression | `pytest -q tests/test_acumatica_project_creation_attribution.py` | Pass | Acumatica source/run evidence is recorded without guessing a human actor; 1 test passed. |
| Targeted lint | `npx eslint <task frontend files>` | Pass | 0 errors; eight existing `any` warnings remain in the bootstrap response type. |
| Repository typecheck | `npm run typecheck` | Unrelated debt | Verification agent found zero diagnostics in project-creation files; the command still fails on existing daily-brief, feedback, observability, drawing, executive, progress-report, submittal, and task errors. |
| UI complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs <changed UI files>` | Pass | Both project-creation table UI files passed. |
| Authenticated desktop proof | `project-creation-log-desktop.png` | Pass | Search returns the retained legacy gap and current Acumatica record; the current-project link navigates to `/1146/home`. |
| Authenticated mobile proof | `project-creation-log-mobile.png` | Pass | Responsive record cards preserve project, actor, created time, source, and attribution evidence. |
| Independent review | Re-review after Acumatica, error, and SQL assertion fixes | Pass | No concrete remaining blocker. |
| Verification contract | `node scripts/verification/verification-contract.mjs --manifest ... --result ... --require-pass --task-id LOCAL-2026-07-22-project-creation-attribution` | Pass | High-risk manifest/result evidence is task-bound and independently approved. |
| Publication | `npm run codex:finish -- --delivery-lane high --session SROOT-PCREATE-0722 --files <exact task paths>` | Pass | Exact task-owned files published through the remote-main compare-and-swap publisher. |

## Remaining Risk

- Historical null actors cannot be reconstructed without an independent correlated source; owner is Operations, and the safe next action is to retain `legacy_gap` unless evidence appears.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action (N/A; no task work is deferred).
