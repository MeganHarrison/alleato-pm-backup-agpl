# Task: Schedule lookaheads and reporting

Status: In Progress
Owner: SROOT1192A
Created: 2026-07-22
Task ID: AAI-1192
Linear Issue: [AAI-1192](https://linear.app/megankharrison/issue/AAI-1192/deliver-construction-lookaheads-and-schedule-reporting)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT1192A-lookaheads-reporting.md`

## Objective

An authorized project member can inspect a 2-, 3-, or 6-week lookahead derived only from the published schedule revision, including traceable dependency, field-forecast, submittal-risk, and constraint context, then export that exact selected state.

## Scope

- Canonical Schedule route and a guarded consolidated report API built from immutable published revision snapshots.
- Selected-state export contract and focused API/domain/E2E coverage.
- Excludes PDF/XLSX rendering implementation until the selected-state JSON contract and user flow are proved; no export may silently substitute draft/live task data.

## Source of Truth

- Canonical runtime/data owner: `schedule_revisions` + immutable task/dependency snapshots; `/api/projects/[projectId]/scheduling/revisions/current` is the published-revision guard.
- Existing shared primitives/services: `frontend/src/app/(main)/[projectId]/schedule/page.tsx`, `frontend/src/app/api/projects/[projectId]/scheduling/reports/route.ts`, `frontend/src/components/scheduling/schedule-revision-controls.tsx`, `frontend/src/lib/api-client.ts`.
- Deprecated or parallel paths: `import-export-modal.tsx` only exports live task data and cannot be reused for an authoritative lookahead.

Verification contract: Required

## Acceptance Criteria

- [ ] Lookaheads never fall back to a draft or live task state when no published revision exists.
- [ ] A selected window reports activities and traceable dependency, field-forecast, linked-submittal-risk, and constraint context.
- [ ] An export request rejects missing/invalid selected state and returns the same revision and filters as the rendered lookahead.
- [ ] Canonical route proof, database/API readback, focused tests, independent review, and screenshot are recorded before closeout.

## Implementation Checklist

- [x] Files/modules and canonical ownership identified before behavior edits.
- [ ] Add a failing focused domain/API test for unpublished revision rejection and selected-state integrity.
- [ ] Implement shared lookahead projection from immutable revision snapshots.
- [ ] Add guarded API and canonical Schedule Planning UI without parallel page-local data ownership.
- [ ] Implement faithful PDF/XLSX exports from that projection.
- [ ] Add end-to-end user-flow coverage for report and export paths.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual user-flow and live-system readback prove the requested outcome.
- [ ] Evidence artifacts and Linear screenshot are recorded.
- [ ] Known unrelated failures name exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a clear no-published-revision, invalid-window, or selected-state mismatch error; never an empty or substituted report.
- Detection path: focused negative tests, guarded API response, canonical route alert, and export contract test.
- Recovery path: publish an approved revision, select a valid 2/3/6-week window, then retry.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: immutable revision input plus selected-state validation.
- Guardrail evidence: test-first matrix in AAI-1192 and guarded current-revision endpoint.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, canonical owner, failure-loudly contract, and TDD gate set before behavior work. |

## Remaining Risk

- AAI-1191 canonical-route production evidence is queued in Vercel; lookahead implementation must not treat that as published-product proof until browser verification completes.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A; prevention guardrail is documented.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
