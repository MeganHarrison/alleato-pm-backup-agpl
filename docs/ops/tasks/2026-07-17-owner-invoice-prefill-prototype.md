# Task: Owner Invoice Prefill Prototype

Status: Accepted
Owner: Codex S191
Created: 2026-07-17
Task ID: AAI-1148
Linear Issue: [AAI-1148](https://linear.app/megankharrison/issue/AAI-1148/prototype-owner-invoice-billing-period-prefill-workflow)
Related Handoff: `docs/ops/handoffs/2026-07-17-S191-owner-invoice-prefill-prototype.md`

## Objective

On a clearly labeled, non-persisting prototype route, an accounting operator can select Procore-style owner-invoice prefill options, inspect included and excluded source records, and see the resulting Schedule of Values before a draft preview is created.

## Scope

- Interactive product prototype using representative subcontractor invoices, direct costs, commitment change orders, retainage, and attachment backup.
- Authenticated route: `/knowledge/app/prototype/owner-invoice-prefill`.
- Explicit exclusion: production owner-invoice APIs, database schema, live financial records, and persistence behavior.
- Shared guardrail: canonical app shells reserve end-of-scroll clearance for fixed global launchers so form actions remain usable.

## Source of Truth

- Canonical runtime/data owner: production owner-invoice creation remains `frontend/src/app/(main)/[projectId]/invoices/new/page.tsx`; this task does not alter it.
- Existing shared primitives/services: `PageShell`, `FormSection`, `Checkbox`, `Select`, `Button`, and the existing invoice inline-table vocabulary.
- Prototype pattern: `frontend/src/app/(main)/knowledge/app/prototype/prime-contract/page.tsx` plus a feature-owned interactive component.
- Deprecated or parallel paths: none; the route is explicitly labeled prototype and never writes data.

Verification contract: Required

## Surface And Attention Brief

- Surface: full-page form prototype.
- One purpose: understand the result of selected owner-invoice prefill rules.
- Primary user/job: accounting operator deciding what source costs should populate an owner invoice.
- Primary decision: which prefill options to enable before previewing the SOV.
- Tier 1: billing period, three prefill options, resulting SOV, primary preview action.
- Tier 2: eligible source rows, source type, status, budget code, amount, retainage.
- Tier 3: exclusion reasons and attachment lineage, disclosed on request.
- Hidden until requested: detailed source lineage and excluded records.
- Removed: stat cards, decorative icons, helper panels, duplicate CTA, production-save language.
- Failure-loudly behavior: retainage is disabled when cost prefill is off; previewing without a billing period produces a specific recoverable error.
- Blessed pattern: `PageShell variant="form"` with open `FormSection` groups and a bounded data table.
- Complexity budget: full page; no dropdown, popover, or dialog is used as a workspace.

## Acceptance Criteria

- [x] The authenticated prototype route renders inside the normal Alleato app shell and clearly states that no data is saved.
- [x] Turning cost prefill on includes eligible subcontractor invoice, direct cost, and commitment change order amounts for the selected billing period.
- [x] Retainage is disabled and reset when cost prefill is off, then independently changes the SOV when enabled.
- [x] Backup prefill independently adds eligible source attachments to the preview.
- [x] Included and excluded sources are inspectable, with exact status/date/budget-code reasons for exclusions.
- [x] `Create draft preview` produces a non-persisted result state and exposes a clear correction/reset path.
- [x] Keyboard, desktop, tablet, and mobile behavior pass without horizontal page overflow or launcher/action intersection.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared form, control, table, and layout abstractions own the visual vocabulary.
- [x] Mock calculation logic is deterministic, typed, and covered by focused tests.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are explicitly out of scope.

Owned product paths:

- `frontend/src/app/(main)/knowledge/app/prototype/owner-invoice-prefill/page.tsx`
- `frontend/src/features/invoicing/owner-invoice-prefill-prototype.tsx`
- `frontend/src/features/invoicing/__tests__/owner-invoice-prefill-prototype.test.tsx`
- `frontend/src/app/(main)/layout.tsx`
- `frontend/src/app/(tables)/layout.tsx`
- `frontend/src/app/(admin)/admin-layout-client.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/app/__tests__/global-overlay-safe-zone.test.ts`

## Integration and Verification

- [x] Targeted unit and lint checks pass.
- [x] Authenticated browser flow proves option dependency, source disclosure, preview creation, and reset/correction.
- [x] Desktop, tablet, and mobile screenshots are captured and visually reviewed.
- [x] Independent functional verifier, visual verifier, and evidence judge review the result.
- [x] Verification contract and strict review-queue checks pass.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: inline text naming the missing billing period or option dependency.
- Detection path: focused unit test plus authenticated browser negative-path capture.
- Recovery path: select a billing period, enable cost prefill before retainage, or reset the prototype.

## Incident Learning

- Failure fingerprint: `global-launcher-overlaps-end-of-form-action`
- Root cause: fixed global launchers and app-shell route content did not share an end-of-scroll safe-zone contract.
- Detection gap: the first responsive captures did not include lower mobile actions; the collision was found by independent visual review.
- Prevention: every canonical app shell now renders the shared `global-overlay-safe-zone` after route content, with a source-contract test and lower mobile browser proof.
- Guardrail evidence: `frontend/src/app/__tests__/global-overlay-safe-zone.test.ts` and `docs/ops/evidence/2026-07-17-owner-invoice-prefill-prototype/08-created-preview-mobile-375.png`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, design gate, and evidence contract recorded before product edits. |
| Procore rule review | Support FAQ reviewed 2026-07-17 | Pass | Three creation-time options and eligibility rules mapped into acceptance criteria. |
| Focused regression | Prototype and safe-zone Jest suites | Pass | 9 tests across 2 suites. |
| Changed-file quality | targeted ESLint, Prettier, `npm run typecheck:changed`, route check | Pass | No changed-file lint, format, type-debt, or route issue. |
| Surface complexity | Impeccable audit script | Pass | No nested cards, one-off popovers, or forbidden temporary workspace patterns. |
| Browser flow | `docs/ops/evidence/2026-07-17-owner-invoice-prefill-prototype/verification.md` | Pass | Authenticated calculations, dependencies, disclosures, create/reset, July, and negative path verified. |
| Responsive | `responsive-*.png` plus `08-created-preview-mobile-375.png` | Pass | 375/414/768/1024/1440 have no page overflow; final action/launcher intersection is false at every width. |
| Full frontend typecheck | `docs/ops/evidence/2026-07-17-owner-invoice-prefill-prototype/full-typecheck-report.md` | Unrelated fail | No task-owned file appears in broad repo error output. |
| Independent review | Functional, visual, and evidence review artifacts | Pass | Evidence judge accepted AC1–AC7 and calculation correctness. |
| Verification contract | `verification-contract.mjs` | Pass | Declared `PASS` is supported by the evidence result. |

## Remaining Risk

- Representative data can explain behavior but cannot prove production query correctness; production implementation remains a separate task.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
