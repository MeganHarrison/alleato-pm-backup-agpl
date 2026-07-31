# Task: Billing Period Management Parity

Status: Pending Review
Owner: Codex S189
Created: 2026-07-17
Task ID: AAI-1146
Linear Issue: [AAI-1146](https://linear.app/megankharrison/issue/AAI-1146/implement-procore-parity-billing-period-management)
Related Handoff: `docs/ops/handoffs/2026-07-17-S189-billing-period-management-parity.md`

## Objective

On the canonical project Invoices Billing Periods tab, invoice administrators can create, edit, open, close, and safely retain billing periods with the same observable workflow and invariants documented by Procore.

## Scope

- Project-level Billing Periods UI, hooks, API routes, persistence contracts, invoice-date integration, and focused regression/evidence artifacts.
- Manual billing periods, automatic monthly/weekly/never configuration, one-open-period behavior, unique date ranges, inline editing, and linked-period deletion protection.
- Explicit exclusion: unrelated owner/subcontractor invoice calculations and company-level billing-period management.

## Source of Truth

- Canonical runtime/data owner: `billing_periods` rows scoped by `project_id`, served through `/api/projects/[projectId]/invoicing/billing-periods` and rendered at `/[projectId]/invoices?tab=billing-periods`.
- Existing shared primitives/services: `frontend/src/app/(main)/[projectId]/invoices/page.tsx`, `frontend/src/hooks/use-billing-periods.ts`, shared table/form/modal primitives, and the existing `invoicing_settings` project row.
- Deprecated or parallel paths: `/[projectId]/billing-periods`, `/billing-periods`, and `/api/projects/[projectId]/billing-periods` must redirect to or be removed in favor of the canonical Invoicing owners.

Verification contract: Required

## Acceptance Criteria

- [x] The canonical `/[projectId]/invoices?tab=billing-periods` route lists From, To, Due Date, and Open/Closed status and exposes one primary Create Billing Period action.
- [x] Manual creation persists From, To, and Due Date, opens the new period, and atomically closes the previously open period.
- [x] Editing dates/status persists and opening a period closes any other open period.
- [x] Duplicate date ranges and invalid date ordering fail loudly with actionable messages.
- [x] Automatic setup supports Monthly, Weekly, and Never semantics without creating a parallel billing-period owner.
- [x] Linked historical periods cannot be deleted, while an unlinked period follows the documented safe-delete contract.
- [x] Invoice creation/read paths consistently consume the current open period dates.
- [x] Failure-loudly behavior is defined for auth, validation, uniqueness, update, and invoice-linkage failures.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are finalized after canonical-owner audit and recorded in the handoff.
- [x] Fresh Supabase types are generated and the live table contract is inspected before database edits.
- [x] Cross-cutting open/close and uniqueness invariants have one durable server/database owner.
- [x] UI reuses the canonical billing-period page, shared primitives, and Alleato noise-gate constraints.
- [x] Errors are specific, actionable, and surfaced in the UI.
- [x] Permission and invoice-linkage contracts are handled at the server boundary.

## Integration and Verification

- [x] Targeted unit/API checks pass.
- [x] Fresh authenticated browser flow proves create, automatic close, edit/reload, and negative paths.
- [x] Database readback proves persisted dates/status and the one-open-period invariant.
- [x] Desktop, tablet, and mobile screenshots are captured from the canonical route and independently reviewed.
- [x] Verification manifest/result and evidence-judge review pass `npm run verify:contract`.
- [x] Handoff passes Linear and strict review-queue validation.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: field-level validation or a specific server error naming the conflicting period/invoice dependency.
- Detection path: canonical route error state/toast, targeted API test, database invariant check, and browser negative-path artifact.
- Recovery path: correct the dates, intentionally activate/close the target period, or retain a linked historical period.

## Incident Learning

- Failure fingerprint: automatic-catchup-wrong-open-period; invoice-create-no-open-period-silent-null; toast-error-description-low-contrast
- Root cause: Current behavior diverges from Procore by blocking new/open period transitions instead of applying the documented close-previous invariant.
- Detection gap: Existing tests validate blocking behavior rather than the upstream workflow contract.
- Prevention: Replace the blocking contract with one atomic owner and regression coverage for create/open transitions and duplicate ranges.
- Guardrail evidence: atomic RPCs and unique indexes; follow-up catch-up migration; owner/subcontractor 409 tests; toast foreground regression; live transactional database proofs.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Procore source | `manage`, `create automatic`, `create manual`, and `edit billing periods` support tutorials | Reviewed | Defines one-open invariant, automatic close, fields, edit behavior, and deletion caution. |
| Database migrations | `20260717055656` and `20260717114820` | PASS | Both are applied and ledger-verified; cron is active. |
| Focused tests | Five Jest suites, 15 tests | PASS | Billing-period CRUD, invoice defaults/no-open failure, and toast contrast contract. |
| Targeted ESLint | Task-owned TS/TSX paths | PASS | No task-owned lint errors. |
| Route gate | `npm run check:routes` | PASS | No dynamic route conflicts. |
| Complexity audit | Impeccable surface audit on three changed page owners | PASS | Noise-gate structure passed. |
| Browser proof | `docs/ops/evidence/2026-07-17-billing-period-management-parity/` | PASS | Authenticated desktop/tablet/mobile/dialog/negative-path proof and video. |
| Database readback | `database-readback.json` plus live transactional assertions | PASS | Zero multiple-open projects, zero duplicate ranges, catch-up and deletion contracts proved. |
| Independent review | `independent-review.md`; `visual-review.md` | PASS | Functional and visual reviewers approved after rework. |
| Verification contract | `npm run verify:contract ... --require-pass` | PASS | Declared evidence supports PASS. |
| Full typecheck | `cd frontend && npm run typecheck` | Unrelated failure | No AAI-1146/shared-primitive errors; existing Outlook-rules and PrimeContractInvoicesTab errors remain. |
| DB inventory | `npm run db:inventory` | Unrelated failure | Existing new executive/daily-deep-read tables are missing from `tables.yaml`; no billing-period drift reported. |

## Remaining Risk

- Eleven legacy billing-period rows still have null due dates. They remain readable under a NOT VALID check; editing requires a due date.
- The read-only legacy billing-period GET adapter remains temporarily for an active prime-invoice consumer; legacy POST now fails with 410. Removal owner: prime-invoice workflow follow-up after consumer migration.
- Full typecheck and DB inventory remain red only on unrelated repo debt recorded above.

## Final Status

- [ ] All required checklist items are complete. Publication remains.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
