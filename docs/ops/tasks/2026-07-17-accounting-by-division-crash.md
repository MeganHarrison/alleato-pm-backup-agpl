# Task: Accounting dashboard byDivision crash

Status: In Progress
Owner: Codex
Created: 2026-07-17
Task ID: LOCAL-2026-07-17-accounting-by-division-crash
Linear Issue: Not created; local bug-fix workflow, connector not available in this session
Related Handoff: `docs/ops/handoffs/YYYY-MM-DD-S<session>-<topic>.md`

## Objective

The canonical Accounting dashboard renders an honest empty cost-breakdown state when
the dashboard API has no cost-dimension data, instead of crashing on `byDivision`.

## Scope

- `frontend/src/app/(admin)/accounting/page.tsx`
- `frontend/src/app/api/accounting/dashboard/route.ts`
- `frontend/src/lib/accounting/dashboard-contract.ts`
- Excludes adding Acumatica division/account fields that are not present in the current sync contract.

## Source of Truth

- Canonical runtime/data owner: `/api/accounting/dashboard` and the admin Accounting page
- Existing shared primitives/services: `apiFetch`, `PageShell`, accounting dashboard route
- Deprecated or parallel paths: None identified

Verification contract: Required

Use `Required` for user-facing, scheduled, database-backed, integration, AI, or delivery work. Use `Not applicable` only when the task has no observable runtime outcome; explain why in Scope.

## Acceptance Criteria

- [ ] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy/partial response compatibility is normalized in one shared contract helper.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database/provider/auth contracts are unchanged and explicitly scoped.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Actual authenticated user-flow proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated lint warnings are pre-existing page-grid warnings.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: API response omitted `costBreakdownSeries`, while the client dereferenced `byDivision`.
- Detection path: runtime error `undefined is not an object (evaluating 'a.byDivision')`; source contract comparison; regression unit test.
- Recovery path: API returns explicit empty arrays and the client normalizes legacy/partial responses; authenticated browser retry remains required.

## Incident Learning

Use `N/A` only for work that did not discover or address a failure. Significant
bugs and repeated problems must reference an ID in
`docs/ops/learning/recurring-failures.yaml`.

- Failure fingerprint: `accounting-dashboard-missing-cost-breakdown-contract`
- Root cause: Page-only contract addition was not mirrored in the API response.
- Detection gap: No response-shape regression test or authenticated browser smoke proof.
- Prevention: Shared normalizer plus unit regression test; add authenticated Accounting smoke coverage.
- Guardrail evidence: `frontend/src/lib/accounting/dashboard-contract.unit.test.ts`

Before creating a new fingerprint, search existing lessons:

```bash
node scripts/ops/learning-registry.mjs lookup --symptom "<symptom>" --files <owned-paths>
```

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Contract fix | `frontend/src/app/api/accounting/dashboard/route.ts`, `frontend/src/app/(admin)/accounting/page.tsx`, `frontend/src/lib/accounting/dashboard-contract.ts` | Pass | API emits explicit empty breakdown arrays; client normalizes missing arrays. |
| Regression test | `cd frontend && npx jest --runInBand src/lib/accounting/dashboard-contract.unit.test.ts` | Pass | 2 tests passed. |
| Targeted lint | `cd frontend && npx eslint ...` | Pass with unrelated warnings | No errors; existing raw page-grid warnings only. |
| Browser route | `agent-browser open http://localhost:3000/accounting` | Blocked | Redirected to `/auth/login?callbackUrl=%2Faccounting`; no authenticated session available, so no canonical-route screenshot. |

## Remaining Risk

- Authenticated browser screenshot and independent visual review remain outstanding; owner: Codex; next action: run the same route with an authenticated local session.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred browser proof has cause, detection gap, prevention step, owner, and next action.
