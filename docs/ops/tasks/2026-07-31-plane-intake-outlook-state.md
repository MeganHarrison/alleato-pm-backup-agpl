# Task: Plane Intake Outlook state projection

Status: Complete
Owner: Codex S20260731-PLANE-INTAKE-OUTLOOK-STATE
Created: 2026-07-31
Task ID: AAI-PLANE-INTAKE-OUTLOOK-STATE

Delivery lane: Standard

## Objective

Expose the persisted Plane Intake decision and snooze state already stored in
Outlook Intake metadata so the replacement Intake client can render the correct
actions after refresh.

## Scope

- `frontend/src/app/api/outlook-intake/route.ts`
- `frontend/src/app/api/outlook-intake/__tests__/route.test.ts`

## Acceptance Contract

- [x] The API projects only validated Plane Intake state fields.
- [x] Missing or malformed state returns `null` rather than an unsafe value.
- [x] Existing Outlook Intake authorization and filtering are unchanged.
- [x] Focused route tests pass.

## Failure-Loudly Contract

Malformed historic metadata is excluded at the API serialization boundary. The
client receives `null` and retains pending-state behavior instead of crashing.

## Evidence

- Focused Jest route test: pass.
- Targeted ESLint: pass.
- Diff integrity: pass.
