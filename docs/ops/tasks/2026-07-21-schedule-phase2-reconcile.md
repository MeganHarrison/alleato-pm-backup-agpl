# Task: Reconcile Schedule Phase 2 Calendar and Lead Support

Status: Pending Review
Owner: Codex
Created: 2026-07-21
Task ID: LOCAL-2026-07-21-SCHEDULE-PHASE2-RECONCILE
Linear Issue: Unavailable; this session exposes no Linear read/write tool. Connected-source search is not a Linear issue writer.
Related Handoff: `docs/ops/handoffs/2026-07-21-S212-schedule-phase2-reconcile.md`

## Objective

Consolidate the empty duplicate schedule-calendar schema into the canonical project calendar, enable bounded dependency lead time on the current schedule editor/API, preserve named calendar exceptions, and prove the behavior on the authenticated production schedule route.

## Scope

- Preserve the already-applied `20260721210000` migration unchanged in source control, then remove its empty duplicate objects through a new forward migration.
- Reuse `project_schedule_calendars`, `project_schedule_calendar_exceptions`, `replace_project_schedule_calendar`, `schedule-calendar.ts`, and `schedule-impact-preview.ts` as the canonical owners.
- Enable negative `lag_days` values from -365 through 365 and label negative values as lead time.
- Enforce project-scoped dependency access, the lead/lag bound, and cycle prevention at the database boundary.
- Round-trip optional exception reasons through the existing calendar API and dialog.
- Fail closed when an existing project calendar cannot be loaded, and bound calendar exception reasons and collection size in both the API and canonical RPC.
- Make the live type generator work on Windows and regenerate authoritative types after reconciliation.
- Exclude new project-wide preview, new calendar tables, apply/undo logic, resource calendars, and resource leveling; current impact preview, audit, and revision owners remain unchanged.

## Source of Truth

- Canonical runtime/data owner: `public.project_schedule_calendars`, `public.project_schedule_calendar_exceptions`, and `public.replace_project_schedule_calendar`.
- Existing shared primitives/services: `frontend/src/lib/scheduling/schedule-calendar.ts`, `frontend/src/lib/scheduling/schedule-impact-preview.ts`, `CalendarSettingsDialog`, and `TaskDependenciesEditor`.
- Deprecated or parallel paths: empty `public.schedule_project_calendars`, `public.schedule_calendar_exceptions`, and `public.save_schedule_project_calendar` from migration `20260721210000`.

Verification contract: Required

## Acceptance Criteria

- [x] Requested calendar-reason and dependency-lead behavior is covered through the canonical API/UI path.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Duplicate schedule-calendar paths are removed through a ledgered forward migration.
- [x] Canonical calendar rows and existing schedule data remain unchanged by cleanup.
- [x] Negative lead values affect all four dependency relationships through the existing impact engine.

## Planned Files

- `docs/ops/tasks/2026-07-21-schedule-phase2-reconcile.md`
- `docs/ops/handoffs/2026-07-21-S212-schedule-phase2-reconcile.md`
- `docs/ops/orchestration/session-board.md`
- `docs/ops/orchestration/review-queue.md`
- `docs/ops/verification/schedule-phase2-manifest.json`
- `docs/ops/verification/schedule-phase2-result.json`
- `docs/ops/verification/schedule-phase2-independent-review.md`
- `supabase/migrations/20260721210000_create_schedule_project_calendars.sql`
- `supabase/migrations/20260722020000_reconcile_schedule_project_calendars.sql`
- `supabase/migrations/20260722021500_harden_schedule_dependency_boundary.sql`
- `scripts/generate-db-types.mjs`
- `frontend/src/types/database.types.ts`
- `frontend/src/components/dev-tools/page-schema-fk.generated.ts`
- Canonical calendar API/dialog and predecessor API/editor files with focused tests.
- `frontend/src/lib/scheduling/__tests__/schedule-impact-preview.test.ts`

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared canonical abstractions own calendar and impact calculations.
- [x] Errors are specific and actionable.
- [x] Database, authentication, and permission contracts are preserved.
- [x] RED tests demonstrate negative lead and named-exception gaps before implementation.

## Integration and Verification

- [x] Migration applies and remote ledger readback passes.
- [x] Authoritative generated types match the reconciled live schema.
- [x] Focused scheduling tests pass.
- [x] Targeted lint and changed-type guard pass.
- [x] Authenticated browser proof covers the named-exception editor without mutating production; API round-trip and negative-lead behavior are covered by the 32 focused tests.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned feature blobs are published exactly to `origin/main`; deployment and blob readback pass.

## Failure-Loudly Contract

- Cause surfaced as: invalid project ID, empty/duplicate working week, invalid or duplicate exception date, overlong exception reason, out-of-range lead/lag, cross-project relationship, dependency cycle, migration drift, or non-empty duplicate tables.
- Detection path: API validation, canonical RPC authorization, RLS, focused unit tests, migration preflight/readback queries, generated-type check, and authenticated browser errors.
- Recovery path: leave canonical calendar/task rows untouched, identify the exact bad input or migration state, correct it, and retry through the same API or forward migration.

## Incident Learning

- Failure fingerprint: `session.checkout-ownership-drift` and `database.duplicate-migration-version` are the nearest registry matches; this incident combines stale-checkout ownership drift with an overlapping schema migration that used a different version.
- Root cause: Work began from a stale dirty checkout while newer calendar migrations already existed on `origin/main` and in the remote ledger.
- Detection gap: The initial full migration-list output was truncated and was not filtered to recent scheduling migration names before applying the local file.
- Prevention: Require latest-main fetch plus a filtered recent migration-name and overlapping-object preflight before every linked migration apply.
- Guardrail evidence: latest-main reconciliation identified the canonical owner; the forward migration aborts on either non-empty duplicate table; live readback proves the canonical row count stayed at one and all three duplicate objects were removed.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope, canonical owner, failure contract, and done gate captured before reconciliation edits. |
| Supabase login | `supabase migration list` | Pass | Linked project `lgveqfnpkxvzbnnwuled` is accessible. |
| Applied migration | Single-file `supabase db query` plus `migration repair` | Pass | `20260721210000` applied and ledger-recorded; no blanket push was used. |
| Overlap readback | Live tables, migration statements, and row counts | Pass | Canonical calendar has one row; duplicate tables have zero rows. |
| Checkout gate | Clean clone, bootstrap, S212 path claim | Pass | Canonical local checkout is `C:\Users\Brandon\Documents\Codex\pm-main` on `main`. |
| RED scheduling tests | Focused Jest run before product edits | Expected failure | 4 suites failed, 1 passed; 7 tests exposed missing exception reasons and rejected/mislabeled negative lead while all four engine relationship calculations already passed. |
| GREEN scheduling tests | Focused Jest run after independent-review remediation | Pass | 5 suites, 32 tests, including create/edit lead persistence, reason reload, save rejection, failed-load save disablement, and all four dependency relationship types with negative lead. |
| Cleanup preflight | Linked row-count query | Pass | Canonical calendars 1; canonical exceptions 0; duplicate calendars 0; duplicate exceptions 0. |
| Cleanup migration | `20260722020000_reconcile_schedule_project_calendars.sql` | Pass | Single-file apply succeeded; ledger repair recorded the exact version. |
| Cleanup readback | Linked object/count/ledger query | Pass | Canonical calendars remained 1; both duplicate tables and duplicate RPC absent; migration recorded. |
| Dependency-boundary preflight | Linked row-count query | Pass | Dependency rows 0 and canonical exception rows 0 before adding constraints and governed access. |
| Dependency-boundary migration | `20260722021500_harden_schedule_dependency_boundary.sql` | Pass | Forward apply and ledger repair succeeded; RLS, four project-scoped policies, lag check, cycle trigger, reason constraint, and bounded canonical RPC are live. |
| Dependency-boundary readback | Linked RLS/grant/constraint/trigger/ledger query | Pass | RLS true; four policies; anon SELECT/INSERT false; authenticated scoped access retained; checks and trigger present; ledger recorded; row counts remain 0/0. |
| Database types | `npm run db:types` and `npm run db:types:check` | Pass | Windows runner generated via Supabase CLI; authoritative types match live schema. |
| Changed guards | changed-type, unsafe-pattern, route guardrail | Pass | No new `any`, no unsafe patterns, and the root route guard validated two changed routes with `raw_error_routes=0`. |
| Targeted ESLint | Exact changed scheduling files | Pass with unrelated warnings | Zero errors; existing schedule-page warnings remain at lines 746 and 1435 outside the changed hunks. |
| Full frontend typecheck | `node scripts/run-typecheck-bounded.mjs` | Unrelated failure | Existing errors span admin, AI, daily briefs, and older scheduling owners; none of the task-owned source files appear in the error set. |
| Production build wrapper | `npm run build:production` | Environment blocked | Route contracts and inventory passed; the wrapper then failed before Next started with Windows `spawn pnpm ENOENT`. |
| Direct Next build | `node node_modules/next/dist/bin/next build --turbopack` | Inconclusive | Compiler remained silent beyond the repository's normal eight-minute guard; only the two verified build PIDs were stopped. |
| Independent re-review | `docs/ops/verification/schedule-phase2-independent-review.md` | Approved | Database boundary, failure recovery, 32 focused tests, type generation, and both changed routes were independently re-verified; production/browser gates remain. |
| Verification contract | Manifest/result contract validator with required PASS | Pass | Result covers all five claims and references the approved independent review artifact. |
| Exact-file publication | Remote main compare-and-swap publish plus blob readback | Pass | Reviewed source `a1ec5145f` is published on `origin/main` at `08d0469f0`; all 24 task-owned blobs match exactly (`published-file-drift-count=0`). |
| Publisher recovery | `scripts/ops/remote-main-publish.mjs` mixed text/binary dry run and exact-byte readback | Pass | Raised the bounded child-output buffer to 64 MiB, removed destructive text trimming, and now publishes raw Git blob bytes through base64 so large text and image artifacts both remain byte-exact; independently approved. |
| Exact deployment | GitHub commit status for `08d0469f0b97d4d50da887bb8dac3b5700f6d727` | Pass | Vercel reports `Deployment has completed` for the exact-byte publication. |
| Authenticated production proof | `docs/ops/verification/schedule-phase2-calendar-desktop.png` | Pass | Signed-in `/1144/schedule` loaded the deployed Calendar control; an unsaved `12/25/2030` exception accepted the optional reason `Production verification only`, then the dialog was closed without saving or creating production data. Project 1144 currently has zero schedule tasks, so dependency-editor behavior is proved by focused API/editor/impact tests rather than a live-data mutation. |

## Remaining Risk

- This phase is implemented, deployed, and verified. The authenticated project used for production proof has zero schedule tasks, so no dependency was created solely for evidence; bounded lead/lag persistence, labeling, validation, and all four relationship calculations are covered by the focused regression suites. Owner: next scheduling phase; next action: select a seeded non-production project before adding browser evidence for future dependency-editor changes.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
