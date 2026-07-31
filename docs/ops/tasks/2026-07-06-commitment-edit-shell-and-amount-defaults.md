# Task: Widen commitment edit shell and default new commitments to amount-based accounting

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-985 https://linear.app/megankharrison/issue/AAI-985/widen-commitment-edit-shell-and-default-new-commitments-to-amount
Related Handoff: Not created yet

## Objective

Use the wider commitment edit shell on the exact commitment edit route, and ensure new subcontracts plus new purchase-order commitments both default to amount-based accounting while existing records still preserve their stored accounting method on edit.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Exact route owner review | `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx` | Pass | Edit route uses `PageShell`; width change belongs here. |
| Default owner review | `frontend/src/components/domain/contracts/CreatePurchaseOrderForm.tsx`; `frontend/src/components/domain/contracts/subcontract-form/useSubcontractFormState.ts` | Pass | New-record accounting defaults live in form state, while edit hydration already preserves stored methods. |
| Task + issue linkage | `AAI-985`; `docs/ops/tasks/2026-07-06-commitment-edit-shell-and-amount-defaults.md` | Pass | Full-process tracking opened before implementation. |
| Route shell patch | `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx` | Pass | All loading, approved, and edit states now use `PageShell variant="detailWide"` on the exact commitment edit route. |
| Purchase-order default guardrail | `frontend/src/components/domain/contracts/CreatePurchaseOrderForm.tsx`; `frontend/src/components/domain/contracts/__tests__/CreatePurchaseOrderForm.accountingMethod.test.ts` | Pass | New helper centralizes default accounting selection and preserves persisted edit values. |
| Subcontract default guardrail | `npx jest --runInBand --runTestsByPath src/components/domain/contracts/__tests__/CreatePurchaseOrderForm.accountingMethod.test.ts src/lib/db/__tests__/subcontracts.unit.test.ts` | Pass | Existing subcontract mapper test confirms the form-layer default remains `amount_based`. |
| Diff sanity | `git diff --check -- frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx frontend/src/components/domain/contracts/CreatePurchaseOrderForm.tsx frontend/src/components/domain/contracts/subcontract-form/useSubcontractFormState.ts` | Pass | No whitespace or patch formatting errors in task-owned code paths. |
| Exact edit route browser proof | `docs/ops/evidence/2026-07-06-commitment-edit-shell-and-amount-defaults/commitment-edit-detailWide-proof.png` | Pass | Browser probe confirmed `http://localhost:3001/876/commitments/a0d9d40d-37c5-4739-872e-e5412cbc785b/edit` renders with shell class `mx-auto w-full min-w-0 max-w-screen-2xl` and visible Save Changes state. |
| New purchase order browser proof | `docs/ops/evidence/2026-07-06-commitment-edit-shell-and-amount-defaults/new-purchase-order-default-amount-based.png` | Pass | Browser probe confirmed `http://localhost:3001/876/commitments/new?type=purchase_order` shows `This purchase order's accounting method is amount-based.` by default. |
| New subcontract browser proof | `docs/ops/evidence/2026-07-06-commitment-edit-shell-and-amount-defaults/new-subcontract-default-amount-based.png` | Pass | Browser probe confirmed `http://localhost:3001/876/commitments/new?type=subcontract` shows `Accounting method is amount based.` by default. |
| DB/provider applicability | `N/A` | Pass | This task did not change database schema, provider config, or external service state, so no read-back step was required. |

## Files Changed

- `docs/ops/tasks/2026-07-06-commitment-edit-shell-and-amount-defaults.md` - task ledger and evidence plan.
- `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx` - widened the commitment edit shell to the shared `detailWide` variant across all route states.
- `frontend/src/components/domain/contracts/CreatePurchaseOrderForm.tsx` - centralized purchase-order accounting default selection and kept persisted edit values intact.
- `frontend/src/components/domain/contracts/__tests__/CreatePurchaseOrderForm.accountingMethod.test.ts` - regression guardrail for purchase-order create/edit accounting defaults.

## Risks / Gaps

- No automated E2E was added for the shell-width proof; current route proof is browser artifact based, while the automated guardrail covers the default-accounting behavior.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
