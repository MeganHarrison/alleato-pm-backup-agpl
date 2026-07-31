# Task: Restrict Project Team Picker to Alleato Employees

Status: Completed
Owner: Codex SROOTPMTEAM
Created: 2026-07-29
Task ID: LOCAL-PMTEAM-20260729
Linear Issue: N/A - local production bug fix requested directly by Brandon
Related Handoff: N/A - Standard single-session task

## Objective

When an authenticated user opens the Project Team role-assignment dialog, the
default picker lists only active Alleato Group employees and does not include
generic app-user, QA, system, support, or subcontractor identities.

## Scope

- `frontend/src/components/domain/directory/AssignMemberDialog.tsx`
- Focused regression coverage for the employee-roster request contract
- Explicit exclusion: no deletion or mutation of QA, system, support, or test identities
- Explicit exclusion: the separate external-contact picker remains unchanged

## Source of Truth

- Canonical runtime/data owner: `GET /api/directory/employees/table`
- Existing shared primitives/services: `frontend/src/app/api/directory/employees/table/route.ts`
- Deprecated or parallel paths: `/api/people?type=employee` is intentionally broad and must not own the internal project-team roster

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Requested behavior is observable through the real dialog request boundary.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before final implementation.
- [x] Legacy or duplicate paths are explicitly deferred rather than mutated.

## Implementation Checklist

- [x] Files/modules to change are listed and protected by a path-scoped writer lease.
- [x] The existing company-scoped employee roster owns the behavior.
- [x] Count-backed pagination loads every roster page; any page failure clears the list and surfaces the existing load-error toast.
- [x] No database, provider, authentication, permission, or destructive contract is changed.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Authenticated same-revision browser proof shows the corrected picker.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned implementation files are published to `origin/main`.
- [x] The shared checkout's pre-existing divergence is recorded instead of being destructively rewritten to make local `HEAD` equal `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a focused dialog test fails if the component requests the generic `type=employee` alias.
- Detection path: focused Jest contract plus the existing canonical employee-route test.
- Recovery path: restore the dialog request to `/api/directory/employees/table` and rerun both focused tests.

## Incident Learning

- Failure fingerprint: `directory.project-team-employee-scope-drift`
- Root cause: The dialog requested the generic people endpoint, whose `type=employee` alias expands to both `employee` and `user` identities.
- Detection gap: The earlier picker fix had no component-level assertion tying the dialog to the company-scoped employee roster.
- Prevention: Reuse the Employees directory endpoint and lock the exact request with a dialog regression test.
- Guardrail evidence: `frontend/src/components/domain/directory/__tests__/AssignMemberDialog.test.tsx`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Authenticated production GET `/api/people?type=employee&status=active&page=1&per_page=1000` | Reproduced | Returned 42 rows: 33 employees and 9 generic users, including QA/system identities. |
| Canonical comparison | Authenticated production GET `/api/directory/employees/table?per_page=150&status=active&sort=full_name:asc` | Pass | Returned 31 active Alleato employees without the flagged identities. |
| Red regression | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/components/domain/directory/__tests__/AssignMemberDialog.test.tsx` | Expected fail | Observed `/api/people?type=employee...` instead of the company-scoped endpoint. |
| Focused tests | `npm.cmd run test:unit -- --runInBand --runTestsByPath src/components/domain/directory/__tests__/AssignMemberDialog.test.tsx src/app/api/directory/employees/table/__tests__/route.test.ts` | Pass | 2 suites, 5 tests, including a two-page/151-employee roster. |
| Targeted lint | `npx.cmd eslint src/components/domain/directory/AssignMemberDialog.tsx src/components/domain/directory/__tests__/AssignMemberDialog.test.tsx` | Pass | No diagnostics. |
| Changed-file type guard | `npm.cmd run typecheck:changed` | Pass | No new `any` debt. |
| Repository typecheck | `node scripts/run-typecheck-bounded.mjs` from `frontend/` after Windows-safe cache cleanup | Fail unrelated | Existing errors span admin, AI, scheduling, recruiting, and other modules; no diagnostic referenced either task-owned frontend file. |
| Independent review | Standards and specification review of the task diff | Pass after fixes | Review prompted full roster pagination and query-order-independent endpoint assertions; both were added and rechecked. |
| Deployment | Vercel production deployment `dpl_8iGXAVLrodLnbc5dG11YpJ9WWCmh` | Pass | Built GitHub commit `c40ecdfdcbd313e2526a09f0fdb52c610e512d33`; deployment reached `READY` and owns `projects.alleatogroup.com`. |
| Browser proof | Authenticated `https://projects.alleatogroup.com/1149/directory?proof=employee-picker-c40ecdf` plus `C:/Users/Brandon/.codex/visualizations/2026/07/29/019fafa1-f52e-7b52-b90c-c341162824d8/project-team-picker-fixed.png` | Pass | The live Architect picker returned 31 options; every option had an `@alleatogroup.com` address, and no QA, System, Support, test, `example.com`, or `megankharrison.com` identity was present. |
| Publish | Exact-file remote-main publisher | Pass | Implementation and regression files published to `origin/main` at `c40ecdfdcbd313e2526a09f0fdb52c610e512d33`. The shared checkout was not rebased or reset because it contained pre-existing unrelated divergence and worktree changes. |

## Remaining Risk

- None within the picker scope. QA/system records still exist in the database by design; this fix excludes them from the internal employee roster without deleting or mutating those records.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred data cleanup is excluded because deleting test identities is outside this task and potentially destructive.
