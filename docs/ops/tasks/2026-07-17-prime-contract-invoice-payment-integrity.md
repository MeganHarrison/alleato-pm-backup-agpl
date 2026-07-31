# Task: Prime Contract Invoice and Payment Integrity

Status: In Progress
Owner: Codex S188
Created: 2026-07-17
Task ID: Local task — Linear connector unavailable in this session
Linear Issue: No Linear MCP or CLI is exposed in this session; create/link issue when the connector is available.
Related Handoff: `docs/ops/handoffs/2026-07-17-S188-prime-contract-invoice-payment-integrity.md`

## Objective

Show the linked Acumatica AR invoice from the canonical prime-contract invoice table, and make Payments Received accurately reflect the payments associated with its paid invoices.

## Scope

- Prime-contract detail invoice and Payments Received tabs for the canonical `/${projectId}/prime-contracts/${contractId}` route.
- Reuse the shared unified-table and existing payment-sync/data contracts.
- Excludes changing Acumatica source data, invoice status semantics, and unrelated commitment invoices.

## Source of Truth

- Canonical runtime/data owner: prime-contract detail page and contract payment APIs.
- Existing shared primitives/services: `UnifiedTablePage`, `PrimeContractInvoicesTab`, `PrimeContractPaymentsTab`.
- Deprecated or parallel paths: legacy `DataTable` invoice-tab wrapper.

Verification contract: Required

## Acceptance Criteria

- [x] Invoice rows expose an Acumatica record link when an external AR reference exists.
- [x] Payments Received has contract-owned payment records after the source-attribution repair.
- [x] Ambiguous project-only payment attribution stops instead of silently choosing a contract.
- [x] Shared unified-table settings, search, export, and column management remain intact on the authenticated route.

## Implementation Checklist

- [x] Localize the invoice/payment divergence from UI through API response and relationship contract.
- [x] Add the Acumatica invoice column through the unified table owner.
- [x] Correct the first faulty payment relationship/fetch boundary.
- [x] Add focused regression coverage for ambiguous multi-contract attribution.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Live database readback proves the repaired payment ownership.
- [x] Authenticated user-flow and screenshot prove the requested route outcome.
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: invoice/payment rows with a missing ERP relationship display an explicit unavailable state.
- Detection path: contract payment API response plus the Payments Received empty state.
- Recovery path: sync the contract with ERP or investigate the returned reference mismatch.

## Incident Learning

- Failure fingerprint: `prime-contract-payment-project-first-attribution`
- Root cause: payment projection chose the first prime contract for a project instead of resolving the paid AR invoice to its owning contract.
- Detection gap: the Payments API additionally discarded correctly linked payments by parsing free-text notes instead of using `contract_id`.
- Prevention: invoice-reference ownership is now required for payment-application projection; project-only fallback skips multi-contract projects; the API reads its resolved foreign key directly.
- Guardrail evidence: `backend/tests/test_acumatica_payment_applications_sync.py::test_payment_projection_skips_ambiguous_multi_contract_project`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Runtime observation | User-provided prime-contract screenshot | Observed | Invoice rows show `paid`; Payments Received reports zero records. |
| Database localization | `supabase db query --linked` | Pass | All five paid AR invoices belong to `PC-STATUS-001`; all four projected rows were incorrectly attached to `PC-TEST-002`. |
| Database repair | `supabase db query --linked` | Pass | Moved payments `000285`, `000331`, and `000332` to `PC-STATUS-001`; removed invalid credit-memo payment `000456`. |
| Static check | `cd frontend && npx eslint ...PrimeContractInvoicesTab.tsx ...payments/route.ts` | Pass | Touched frontend files pass. |
| Regression check | `cd backend && PYTHONPATH=src python -m pytest tests/test_acumatica_payment_applications_sync.py -q` | Pass | 7 passed; 3 pre-existing datetime deprecation warnings. |
| Browser proof | `agent-browser --auto-connect open ...` | Blocked | Automation session redirects to `/auth/login`; screenshot is not canonical-route evidence. |
| Invoice route proof | `docs/ops/evidence/2026-07-17-prime-contract-invoices-settings.png` | Pass | Canonical route shows 5 invoices, Acumatica AR links, and the unified table settings popover. |
| Payments route proof | `docs/ops/evidence/2026-07-17-prime-contract-payments-received-loaded.png` | Pass | Canonical route shows 3 Payments Received rows totaling `$483,791.95`. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ...` | Inconclusive | Functional evidence passes; mandatory independent-review/comment-attachment closeout tooling is unavailable. |

## Remaining Risk

- No independent reviewer/subagent or task-comment attachment tool is available in this session. The route itself has authenticated browser evidence.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
