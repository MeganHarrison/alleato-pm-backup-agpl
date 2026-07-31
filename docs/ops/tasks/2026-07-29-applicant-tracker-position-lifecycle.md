# Task: Applicant Tracker Position Lifecycle

Status: Complete
Owner: Codex
Created: 2026-07-29
Task ID: ALL-42
Linear Issue: ALL-42
Related Handoff: `docs/ops/handoffs/2026-07-29-S20260729-applicant-tracker-production.md`

## Objective

Recruiting administrators and recruiters can create positions, close or cancel
active positions, and recruiting administrators can permanently delete only
unused draft positions from the production Applicant Tracker.

## Scope

- Own the requisition lifecycle in the recruiting database command layer, API,
  client controller, and Requisitions tab.
- Preserve candidate, application, approval, offer, task, event, and audit
  history by prohibiting permanent deletion after a requisition is used.
- Exclude editing existing position fields and provider integrations.

## Source of Truth

- Canonical runtime/data owner: `public.recruiting_requisitions`
- Existing shared primitives/services:
  `frontend/src/features/recruiting/ApplicantTrackerWorkspace.tsx`,
  `frontend/src/hooks/use-recruiting/use-production-recruiting-workspace.ts`,
  `frontend/src/lib/recruiting/service.ts`,
  `frontend/src/lib/recruiting/production-contracts.ts`
- Deprecated or parallel paths: local prototype repository; not used by the
  production workspace

Delivery lane: High-risk

Verification contract: Required

## Attention Brief

- Primary user: Recruiting coordinator or recruiting administrator
- Primary job: Keep the list of open and planned positions accurate
- Primary decision: Create, close, cancel, or remove a position
- Tier 1: Position identity, current status, and permitted lifecycle action
- Tier 2: Department, headcount, location, and jobsite
- Tier 3: Confidential flag
- Hide until requested: Create-position fields and destructive confirmation
- Remove: Duplicate calls to action, lifecycle dashboards, and helper panels
- Primary action: Add position
- Failure-loudly behavior: Preserve entered values and show the database or
  validation cause with a direct recovery instruction
- Canonical owner: Requisitions tab in `ApplicantTrackerWorkspace`

## Acceptance Criteria

- [x] A recruiting administrator or recruiter can create a draft position.
- [x] A recruiting administrator or recruiter can close or cancel a position.
- [x] Closing or canceling preserves all related recruiting history.
- [x] Only a recruiting administrator can permanently delete a draft.
- [x] A draft with any linked recruiting record cannot be permanently deleted.
- [x] Every mutation is idempotent, audited, concurrency checked, and reloaded.
- [x] Invalid or conflicting mutations fail with a specific recovery message.
- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database and permission contracts are handled.

Planned files:

- `supabase/migrations/20260729210000_recruiting_requisition_lifecycle.sql`
- `supabase/tests/recruiting_core.sql`
- `frontend/src/lib/recruiting/production-contracts.ts`
- `frontend/src/lib/recruiting/service.ts`
- `frontend/src/hooks/use-recruiting/use-production-recruiting-workspace.ts`
- `frontend/src/features/recruiting/ApplicantTrackerWorkspace.tsx`
- Focused contract, component, and production E2E tests

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Authenticated browser preflight succeeds before implementation.
- [x] Production database readback proves lifecycle guardrails.
- [x] Desktop and mobile screenshots show the final workflow.
- [x] Actual user-flow proves create, close/cancel, and safe delete.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: Field-level validation or a lifecycle-specific API error
- Detection path: Component tests, pgTAP, authenticated browser run, and
  production database readback
- Recovery path: Correct invalid fields, reload a stale position, or close or
  cancel a used position instead of deleting it

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Lifecycle constraints are enforced by security-definer database
  commands and focused regression tests.
- Guardrail evidence: Pending

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | High-risk scope and done gate captured before implementation. |
| Authenticated preflight | `npm.cmd run verify:browser -- --url "https://projects.alleatogroup.com/recruiting" --name "applicant-tracker-position-lifecycle-auth-preflight"` | Pass | `tests/agent-browser-runs/2026-07-29T20-34-50-132Z-applicant-tracker-position-lifecycle-auth-preflight` |
| Focused frontend suite | `npx.cmd jest --runInBand --runTestsByPath ...ApplicantTrackerWorkspace.test.tsx ...production-contracts.test.ts ...use-production-recruiting-workspace.test.ts` | Pass | 13 of 13 tests passed. |
| Focused lint | `npx.cmd eslint` on the changed recruiting and shared-dialog files | Pass | Zero errors and zero warnings. |
| Core database contract | `npx.cmd supabase db query --linked --file supabase/tests/recruiting_core.sql` | Pass | 64 of 64 pgTAP assertions passed. |
| Lifecycle database behavior | `npx.cmd supabase db query --linked --file supabase/tests/recruiting_requisition_lifecycle.sql` | Pass | Transaction rolled back after proving replay, concurrency, audit, terminal direct/indirect task guards, reason length, linked draft protection, and safe deletion. |
| Production migrations | Exact-file query plus migration-history repair for `20260729210000`, `20260729211000`, and `20260729212000` | Pass | All three versions are present locally and remotely. |
| Independent release review | `recruiting_release_review` final review | Pass | Retry and indirect-task findings were corrected before approval. |
| Full repository typecheck | `NODE_OPTIONS=--max-old-space-size=7168 npx.cmd tsc --noEmit --pretty false` | Fail unrelated | Existing errors span admin, scheduling, AI tooling, and other non-recruiting owner files; a filtered readback found no task-owned recruiting or shared-dialog errors. |
| Production deployment | Vercel deployment `dpl_Ax2rps9T4Pj9cuHLVfvcBbNcE3Ms` | Pass | Commit `2d42a83d5` reached Ready in the canonical `project-management-agent` project. |
| Production browser proof | `npm.cmd run verify:browser -- --url "https://projects.alleatogroup.com/recruiting" --name "applicant-tracker-position-lifecycle-production"` | Pass | `tests/agent-browser-runs/2026-07-29T21-17-42-265Z-applicant-tracker-position-lifecycle-production`; live page shows Add position. |
| Production create/delete smoke | Authenticated Playwright create, Requisitions readback, and Delete draft | Pass | Created `E2E-POS-1785359940566`, observed it in the live Requisitions tab, deleted it, and confirmed zero database rows remain. |
| Test cleanup | Exact production database readback | Pass | Temporary recruiting-admin role removed; zero temporary roles and zero synthetic lifecycle/smoke positions remain. |

## Remaining Risk

- No known task-owned release risk remains. The repository-wide typecheck still
  contains unrelated pre-existing errors outside the recruiting-owned files.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
