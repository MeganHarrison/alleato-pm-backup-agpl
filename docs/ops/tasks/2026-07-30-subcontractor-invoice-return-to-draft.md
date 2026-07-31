# Task: Return Unsynced Subcontractor Invoices to Draft

Status: Complete
Owner: Codex SROOT
Created: 2026-07-30
Task ID: ALL-55
Linear Issue: [ALL-55](https://linear.app/alleato-group/issue/ALL-55/allow-unsynced-subcontractor-invoices-to-return-to-draft-for-editing)
Related Handoff: N/A — single-session delivery

## Objective

Allow a project manager to return an under-review subcontractor invoice to Draft and immediately edit it when the invoice has not been synced to accounting.

## Scope

- The subcontractor invoice detail Actions menu and canonical PATCH endpoint.
- Server-side Acumatica sync guard, status audit preservation, focused tests, and authenticated browser proof.
- Excludes reversing paid, voided, approved, or already-synced invoices.

## Source of Truth

- Canonical runtime/data owner: `subcontractor_invoices` and its project-scoped invoice API.
- Existing shared primitives/services: `SubcontractorInvoiceDetail`, `SummaryTab`, `DetailTab`, project permissions, and database audit triggers.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] An `under_review` invoice with no Acumatica sync markers offers **Return to Draft & Edit**.
- [x] The action changes the status to `draft`, refreshes the invoice, and opens the editable Summary form.
- [x] Summary and SOV editing continue through their existing canonical editors after the status change.
- [x] The API rejects the transition when any accounting-sync marker is present.
- [x] The API rejects non-status edits while an invoice is still under review.
- [x] Status audit actor stamping remains intact.
- [x] Existing Draft and invoice-contact edits remain valid.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared invoice editability logic owns both UI visibility and API enforcement.
- [x] Errors are specific and actionable.
- [x] Accounting sync, authentication, project permission, and audit contracts are preserved.

Owned files:

- `frontend/src/components/invoicing/SubcontractorInvoiceDetail.tsx`
- `frontend/src/hooks/use-subcontractor-invoices.ts`
- `frontend/src/types/database.types.ts`
- `frontend/src/lib/invoicing/subcontractor-invoice-editability.ts`
- `frontend/src/lib/invoicing/__tests__/subcontractor-invoice-editability.test.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/line-items/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/__tests__/route.test.ts`
- `supabase/migrations/20260731013000_secure_subcontractor_invoice_draft_reopen.sql`
- `supabase/tests/subcontractor_invoice_draft_reopen.sql`
- `tests/agent-browser-runs/2026-07-30-subcontractor-invoice-return-to-draft/`

## Integration and Verification

- [x] Focused unit and API route tests pass.
- [x] Authenticated production user flow proves the action and editable state.
- [x] Final affected-route screenshots are recorded.
- [x] Independent review is complete.
- [x] Task-owned files are published through the exact-file remote main publisher.

## Failure-Loudly Contract

- Cause surfaced as: a specific conflict response when the invoice is synced or no longer under review.
- Detection path: focused PATCH route tests plus the visible invoice action state.
- Recovery path: refresh the invoice; synced invoices must be corrected through accounting instead of being reopened locally.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The detail page and PATCH route supported forward review decisions and editable Draft states, but no guarded reverse transition from unsynced Under Review to Draft.
- Detection gap: Workflow tests covered forward status transitions but did not assert the project-manager correction path before accounting sync.
- Prevention: Keep the unsynced return-to-Draft policy in one tested helper and enforce it in both the UI and API.
- Guardrail evidence: Focused editability and PATCH route regression tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live localization | Production invoice 8268 API response and DOM | Confirmed | API returned `under_review` with all Acumatica fields null; Actions menu omitted Draft/Edit. |
| Regression loop | Focused editability and PATCH route Jest suites | Passed | 24/24 tests passed, including permission, accounting marker, invoice-contact, workflow bypass, and stale-write cases. |
| Targeted lint | ESLint on all changed TS/TSX files | Passed | 0 errors; two pre-existing form-component warnings remain in the detail form. |
| Type validation | Full TypeScript check filtered to task-owned files | Passed for task scope | The full repository has unrelated pre-existing errors; no task-owned file errors were emitted. |
| Database migration | Exact linked migration plus pgTAP contract | Passed | 16/16 structural contracts; migration ledger records `20260731013000`. |
| Database negative paths | Rollback-only authenticated mutation probes | Passed | Direct accounting, workflow metadata, invalid transition, protected delete, and line-item writes were rejected; guarded Draft and line-item RPC paths succeeded and rolled back. |
| Production deployment | Vercel deployment `dpl_4zyjstrXMwpsHxBAB5WiQawpQMDN` | Passed | Commit `5de6d94ea363` is Ready and aliased to `projects.alleatogroup.com`. |
| Authenticated browser proof | `tests/agent-browser-runs/2026-07-30-subcontractor-invoice-return-to-draft/` | Passed | APP-01 exposed the action, became Draft, opened the Summary editor, and exposed SOV editing controls. |
| Final database readback | Invoice `8268` and latest `status.changed` audit | Passed | Status is `draft`, all accounting markers remain empty, and the authenticated actor was recorded transactionally. |

## Remaining Risk

- A separately approved or accounting-synced invoice remains intentionally out of scope and must not be reopened by this action.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
