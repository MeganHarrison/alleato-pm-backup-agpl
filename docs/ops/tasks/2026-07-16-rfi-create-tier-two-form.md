# Task: Make RFI creation a compliant Tier 2 form

Status: Done
Owner: Codex S159
Created: 2026-07-16
Task ID: AAI-1118
Linear Issue: AAI-1118 https://linear.app/megankharrison/issue/AAI-1118/make-rfi-creation-a-compliant-tier-2-form
Related Handoff: `docs/ops/handoffs/2026-07-16-S159-rfi-create-tier-two-form.md`

## Objective

Make the canonical RFI create workflow retain its primary action while scrolling and show only the essential information required to create an open RFI.

## Scope

- Canonical route: `frontend/src/app/(main)/[projectId]/rfis/new/page.tsx`.
- Shared RFI form owner: `frontend/src/components/rfis/rfi-form-fields.tsx`.
- Existing layout/form primitives only: `PageShell`, RHF wrappers, `FormSection`, `FormGrid`, and `FormActions`.
- Excludes RFI schema/API changes and the drawing-pin creation surface unless shared-component parity requires it.

## Source of Truth

- Canonical runtime/data owner: `/[projectId]/rfis/new` and `RfiFormFields`.
- Existing shared primitives/services: `PageShell`, `FormSection`, `FormGrid`, `FormActions`, RHF field wrappers.
- Deprecated or parallel paths: `ProjectFormPageLayout` is deprecated; no route-local form primitive may be introduced.

Verification contract: Required

## Acceptance Criteria

- [x] Essential fields lead the creation flow: subject, question, due date, and assignees.
- [x] Optional RFI metadata is hidden until requested without creating a duplicate field owner.
- [x] Save as Draft, Create as Open, and Cancel remain usable after scrolling, with unsaved-state visibility.
- [x] Required-field and failed-save states are specific and actionable.
- [x] Targeted automated checks pass.
- [x] Authenticated browser proof and canonical-route screenshots are recorded.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] No one-off controls or duplicate field definitions are introduced.
- [x] Failure-loudly behavior is implemented and tested.

## Failure-Loudly Contract

- Cause surfaced as: inline field validation for missing open-RFI requirements and a persistent save-state/error message for failed submission.
- Detection path: focused test plus browser submission on the canonical route.
- Recovery path: correct the marked field or retry after the displayed save failure.

## Incident Learning

- Failure fingerprint: `process.passive-incident-memory`
- Root cause: form behavior drift was not checked against the Tier 2 create-form contract.
- Detection gap: structural component audits passed while progressive disclosure and persistent actions were not asserted.
- Prevention: focused component tests must assert disclosure and action-bar behavior.
- Guardrail evidence: targeted RFI create-form test.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1118 | Pass | Scope and done gate captured before implementation. |
| Static surface audit | `audit-surface-complexity.mjs` | Pass | Baseline passed before behavior changes. |
| Focused unit tests | `npm run test:unit -- --runInBand --runTestsByPath src/components/forms/FormActions.unit.test.tsx src/components/rfis/rfi-form-fields.unit.test.ts` | Pass | 2 suites, 4 tests. |
| Targeted lint / changed-type guard | `npx eslint ...`; `npm run typecheck:changed` | Pass | No lint output; no new `any` debt. |
| Impeccable complexity audit | `audit-surface-complexity.mjs` | Pass | Page, shared RFI fields, and shared action bar all pass. |
| Impeccable noise-gate CLI | `npx impeccable noise-gate ...` | Unavailable | Installed CLI reports `Unknown command: noise-gate`; repo-local equivalent audit passed. |
| Authenticated browser proof | `agent-browser auth login alleato-test`; `/1142/rfis/new` | Pass | Authenticated local route verified at 1440px and 375px. Disclosure expands, sticky submit button remained at y=944px before and after scroll, and invalid Open submission shows the specific recovery message. |
| Desktop screenshot | `docs/ops/evidence/2026-07-16-rfi-create-tier-two-form/rfi-create-desktop.png` | Pass | Attached to Linear AAI-1118 as attachment `273e1f1d-ef2d-4aa4-9f9a-f961b5fa1d0a`. |
| Mobile screenshot | `docs/ops/evidence/2026-07-16-rfi-create-tier-two-form/rfi-create-mobile.png` | Pass | Attached to Linear AAI-1118 as attachment `aef1e778-9959-4a14-96ca-e9d955113d22`; all action buttons measured 343x44px. |
| Independent review | `docs/ops/evidence/2026-07-16-rfi-create-tier-two-form/independent-review.md` | Pass | Approved source review found no blocking defect. |
| Verification contract | `verification-manifest.json`; `verification-result.json` | Pass | Required PASS contract verified with browser, visual, regression, and independent-review evidence. |
| Publication read-back | `7c9048a85` | Pass | `HEAD` and `origin/main` both resolve to `7c9048a85e8c94b28e5fd7af14b36af4fd750f12`. |

## Remaining Risk

- Production host visual parity was not re-captured after publication; the approved canonical-route evidence is from the same published source revision.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
