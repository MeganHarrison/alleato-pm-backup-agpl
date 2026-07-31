# Change Event Line Item Delete Permission

Date: 2026-07-06
Linear: [AAI-969](https://linear.app/megankharrison/issue/AAI-969/audit-remaining-brandon-feedback-inbox-items-not-marked-verified-with)
Status: In Progress

## Objective

Fix the exact Change Event detail edit workflow on
`/876/change-events/927f077e-3883-441c-b275-58b55a4f9db9` so deleting an
existing line item no longer fails for ordinary users who already have write
access to create and edit line items.

## Scope

- Verify the exact delete path used by the change-event edit form.
- Document the root cause with code evidence before changing behavior.
- Align change-event line-item delete permission with the existing create/edit
  contract.
- Add a focused regression test for the exact line-item delete route.
- Run narrow verification and record the evidence.

## Out Of Scope

- Broad change-event detail loading issues unrelated to line-item deletion.
- New auth roles or permission models.
- Route-wide UX redesign beyond making the failure contract less generic if
  needed for this bug.

## Current Repo Truth

- The edit page deletes removed persisted line items through
  `DELETE /api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]`.
- The same line-item workflow currently allows POST and PATCH with
  `requirePermission(projectIdNum, "change_orders", "write")`.
- The DELETE route alone requires
  `requirePermission(projectIdNum, "change_orders", "admin")`, which is a
  stricter permission boundary than the rest of the workflow.

## Done Checklist

- [x] Create task markdown before implementation.
- [x] Create session/handoff ownership artifacts before implementation.
- [x] Capture code-level root cause evidence for the exact delete path.
- [x] Align line-item DELETE permission with the change-event write workflow.
- [x] Add a focused regression test that fails on the old permission mismatch.
- [x] Run focused verification and record outcomes.
- [x] Post Linear progress/update evidence.
- [ ] Verify the exact route behavior locally or with direct route/API proof.

## Evidence

- Root cause evidence:
  - `frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/edit/page.tsx`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]/route.ts`
- Implementation:
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]/route.ts`
  - `frontend/src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]/__tests__/route.test.ts`
- Focused checks:
  - `cd frontend && npx jest --runInBand --runTestsByPath 'src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]/__tests__/route.test.ts'`
    - Pass: 1 suite, 2 tests.
  - `cd frontend && npx eslint 'src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]/route.ts' 'src/app/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]/__tests__/route.test.ts' --no-warn-ignored`
    - Pass.
- Browser verification artifact:
  - `docs/ops/evidence/2026-07-06-change-event-line-item-delete-permission/edit-route-auth-full.png`
    - Blocked proof: authenticated local edit route still hangs on `Loading...` before line-item interaction.

## Failure Contract

- Cause: the delete path for persisted change-event line items is guarded with
  `admin` permission while the matching create/edit paths use `write`.
- Detection gap: there was no route test asserting permission parity across the
  same line-item workflow, so the stricter delete guard shipped silently.
- Prevention: keep the permission boundary consistent across POST/PATCH/DELETE
  for the same workflow and add a focused regression test on the delete route.
