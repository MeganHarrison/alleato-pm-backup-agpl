# Task: Simplify RFI Detail Hierarchy and Number Ownership

Status: In Progress
Owner: Codex S164
Created: 2026-07-16
Task ID: AAI-1129
Linear Issue: AAI-1129 — https://linear.app/megankharrison/issue/AAI-1129/simplify-the-canonical-rfi-detail-header-and-status-placement
Related Handoff: `docs/ops/handoffs/2026-07-16-S164-rfi-detail-header-simplification.md`

## Objective

Make the canonical RFI detail page quieter and correctly identify the record: subject-first title, editable per-project RFI number with auto-number fallback, and one status pill in Details.

## Scope

- Canonical route: `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/**`.
- Canonical RFI API/schema owner: `frontend/src/app/api/projects/[projectId]/rfis/**` and `frontend/src/lib/schemas/rfi-schema.ts`.
- Reuse the shared `StatusBadge`, `InspectorSection`, and `PropertyRow` primitives.
- The active AAI-1128 form-layout task owns the shared `RfiFormFields` placement for the new number field; this task owns its data contract and record-detail presentation.
- Excludes RFI status behavior and unrelated inspector sections.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx` and `rfi-detail.tsx`.
- Existing shared primitives/services: `PageShell`, `StatusBadge`, `InspectorSection`, `PropertyRow`.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [x] The RFI title has no created-date subtitle or status badge.
- [x] Details has no heading-to-content divider.
- [x] Details includes the RFI status as the shared pill-style `StatusBadge`.
- [x] The page title uses the RFI subject, with a number-only fallback for incomplete legacy rows.
- [ ] An RFI number is auto-assigned when absent and may be intentionally set by the user on create or edit. Shared form field placement is owned by active AAI-1128.
- [x] Duplicate, zero, fractional, or non-numeric requested numbers fail with a specific recovery message.
- [x] Details displays and supports inline editing of the RFI number.
- [ ] Existing RFI content, inspector rows, and header actions remain usable on desktop and mobile.
- [x] Failure-loudly behavior is defined.
- [ ] Relevant existing guardrails are identified before implementation.
- [ ] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits: `page.tsx`, `rfi-detail.tsx`, RFI API/schema, shared form owner coordination, focused regression test, task/handoff/evidence files.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: An invalid or duplicate RFI number returns a specific validation/conflict response; hierarchy regressions fail focused tests.
- Detection path: Focused RFI schema/API/detail regression tests and exact-route desktop/mobile browser evidence.
- Recovery path: Enter a positive whole number unused in the project, or leave it empty to use automatic numbering.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Focused structural regression coverage plus visual evidence on the exact RFI route.
- Guardrail evidence: Pending focused regression test.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Linear kickoff | AAI-1129 | Pass | In Progress issue created before implementation. |
| Focused regression | `cd frontend && npx jest --runTestsByPath ...rfi-detail-hierarchy.test.tsx ...rfi-detail-status.test.tsx --runInBand` | Pass | 2 suites, 2 tests. |
| Targeted lint | `cd frontend && npx eslint ...rfi-detail-hierarchy.test.tsx ...rfi-detail-status.test.tsx ...rfi-detail.tsx ...inspector.tsx` | Pass | No findings. |
| Surface complexity | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs ...` | Pass | `rfi-detail.tsx` and `inspector.tsx` passed. |
| RFI number regression | `cd frontend && npx jest --runTestsByPath ...rfi-number.unit.test.ts ...rfi-detail-*.test.tsx --runInBand` | Pass | 3 suites, 7 tests. |
| Changed guardrails | `cd frontend && npm run guardrails:changed` | Pass | 2 changed routes, no raw error routes. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` debt. |
| Authenticated-route preflight | `npm run verify:browser-auth -- --base-url https://projects.alleatogroup.com --route /1142/rfis/1df9c180-b5df-4afd-99b6-3da27289086a --session aai-1129-proof` | Pass | Refreshes env-backed Playwright auth state, restarts `agent-browser`, loads the state, and rejects a login redirect. |
| Preflight guardrail validation | `node --check scripts/verification/prepare-authenticated-browser.mjs` and missing-argument check | Pass | Syntax and required-input failure behavior verified. |
| Authenticated route artifact | `docs/ops/evidence/2026-07-16-rfi-detail-header-simplification/authenticated-production-route-preflight.png` | Pass | Proves authenticated access to the exact production RFI route. This is pre-deploy evidence only. |

## Remaining Risk

- Shared `RfiFormFields` placement is owned by active AAI-1128; its owner has the required integration contract. Authenticated desktop/mobile screenshot proof of the deployed revision and publication remain required. Owner: Codex. Next action: integrate the shared field, publish, then run `verify:browser-auth` before capturing canonical desktop/mobile evidence.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
