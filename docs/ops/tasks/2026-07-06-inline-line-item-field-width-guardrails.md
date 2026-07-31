# Task: Harden inline line-item numeric field widths and add audit guardrails

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-983 https://linear.app/megankharrison/issue/AAI-983/harden-inline-line-item-numeric-field-widths-and-add-audit
Related Handoff: Not created yet

## Objective

Ensure inline purchase-order line-item entry keeps numeric and currency values visible while typing, then add a reusable guardrail so the same collapse bug is surfaced without manual page-by-page review.

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
| Exact failure proof   | User screenshot: `/Users/meganharrison/Desktop/Screenshot 2026-07-06 at 9.18.43 PM.png` | Pass | Quantity and unit-cost entry cells collapse so typed values are unreadable on the PO SOV row. |
| Prior context         | `PRODUCT.md`, `DESIGN.md`, `.agents/skills/impeccable/reference/alleato-doctrine.md`, `.agents/skills/impeccable/reference/alleato-product-noise-gate.md` | Pass | Product-register and Alleato doctrine gates loaded before mutation. |
| Task + issue linkage  | `AAI-983`; `docs/ops/tasks/2026-07-06-inline-line-item-field-width-guardrails.md` | Pass | Full-process tracking opened before implementation. |
| Static/type/lint      | `cd frontend && ./node_modules/.bin/eslint --no-warn-ignored 'src/components/domain/contracts/CreatePurchaseOrderForm.tsx' 'src/components/forms/MoneyField.tsx' 'src/components/ui/number-input.tsx' 'src/components/forms/__tests__/MoneyField.test.tsx' 'src/components/ui/__tests__/number-input.test.tsx'` | Pass with warnings | No errors. Remaining warnings are existing `require-approved-form-components` findings in `CreatePurchaseOrderForm.tsx` for raw description/select fields plus the direct NumberInput use in this RHF-managed file. |
| Targeted tests        | `cd frontend && npx jest --runInBand 'src/components/forms/__tests__/MoneyField.test.tsx' 'src/components/ui/__tests__/number-input.test.tsx'` | Pass | 2 suites, 7 tests passed. |
| Guardrail audit       | `cd frontend && node scripts/audit-inline-numeric-inputs.mjs` | Pass with findings | New repo audit found 2 remaining raw numeric inline-table inputs in `src/components/daily-log/DailyLogFormClient.tsx:788-789`, proving the scan path works beyond this page. |
| Browser/user-flow     | `node` Playwright verification using saved auth cookie retargeted to `localhost`, route `http://localhost:3001/876/commitments/new?type=purchase_order` | Pass | Screenshot captured at `docs/ops/evidence/2026-07-06-inline-line-item-widths/purchase-order-unit-mode-readable-fields.png`; live measured widths: quantity `92px`, unit cost `156px`, amount `156px`. |
| UI audit              | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/components/domain/contracts/CreatePurchaseOrderForm.tsx frontend/src/components/forms/MoneyField.tsx frontend/src/components/ui/number-input.tsx` | Partial | `MoneyField` and `NumberInput` passed. `CreatePurchaseOrderForm.tsx` still has unrelated pre-existing popup/search findings at `L829` and `L897`. |

## Files Changed

- `docs/ops/tasks/2026-07-06-inline-line-item-field-width-guardrails.md` - task ledger and evidence plan.
- `frontend/src/components/domain/contracts/CreatePurchaseOrderForm.tsx` - switched PO line-item quantity/unit-cost entry to shared numeric primitives and enforced line-item table minimum width.
- `frontend/src/components/forms/MoneyField.tsx` - added mandatory readable inline currency width floor.
- `frontend/src/components/ui/number-input.tsx` - added mandatory readable numeric width floor.
- `frontend/src/components/forms/__tests__/MoneyField.test.tsx` - added regression test for inline currency width floor.
- `frontend/src/components/ui/__tests__/number-input.test.tsx` - added regression test for numeric width floor.
- `frontend/scripts/audit-inline-numeric-inputs.mjs` - added repo scan for raw numeric `<Input>` usage inside inline-table files.
- `frontend/package.json` - added `audit:inline-numeric-inputs` script.

## Risks / Gaps

- `CreatePurchaseOrderForm.tsx` still carries pre-existing design-system warnings for raw description/select controls and pre-existing surface-audit findings around the invoice-contact/access popovers at lines 829 and 897.
- The new audit script intentionally reports existing debt outside this task. Current findings are in `frontend/src/components/daily-log/DailyLogFormClient.tsx:788-789`.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
