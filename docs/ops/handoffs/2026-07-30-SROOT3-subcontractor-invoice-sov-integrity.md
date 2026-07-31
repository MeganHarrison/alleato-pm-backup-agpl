# ALL-56 Subcontractor Invoice SOV Integrity Handoff

- Status: Complete and verified in production
- Prepared: 2026-07-30
- Updated: 2026-07-31
- Implementation owner: Codex SROOT3
- Linear: [ALL-56](https://linear.app/alleato-group/issue/ALL-56/keep-subcontractor-invoice-sov-synchronized-with-commitment-values)
- GitHub: [Issue #207](https://github.com/The-Alleato-Group/project-management/issues/207)
- Task record: `docs/ops/tasks/2026-07-30-subcontractor-invoice-sov-integrity.md`

## Executive Summary

A subcontractor invoice could retain an old Schedule of Values (SOV) amount after the underlying commitment was changed. The invoice detail screen then presented the unexplained difference as a change value even when no approved change order existed.

APP-01 was the confirmed production example:

| Financial value | Incorrect state | Correct state |
| --- | ---: | ---: |
| Current commitment SOV | $15,200 | $15,200 |
| Approved commitment change orders | $0 | $0 |
| Invoice schedule value | $21,000 | $15,200 |
| Displayed change value | $5,800 | $0 |

The permanent correction makes the commitment SOV and approved commitment change orders the authoritative sources for editable, accounting-unsynced subcontractor invoices. It also gives authorized project managers a controlled way to return an Under Review invoice to Draft and edit it before accounting synchronization.

## The Issue

### User-visible symptom

On APP-01 for commitment SC-002, the invoice Detail tab showed:

- Commitment Value: $15,200
- Change Value: $5,800
- Schedule Value: $21,000

This implied that the contract had an approved $5,800 change. It did not. The approved change-order value was $0.

### Why the numbers were possible

The invoice line stored its own schedule-value snapshot. When the commitment SOV was later reduced from $21,000 to $15,200, the editable invoice line was not reconciled. The detail API calculated the displayed change value from the stale invoice amount:

`$21,000 invoice schedule - $15,200 commitment value = $5,800 displayed change`

That arithmetic was internally consistent but financially misleading because the $5,800 did not come from an approved change order.

### Business and accounting risk

- Project managers could review or submit an invoice whose SOV no longer matched the commitment.
- The UI could describe an unexplained variance as a change order.
- A stale amount could reach approval or accounting synchronization.
- Operators could not reliably distinguish an approved change from stale invoice data.
- Manually repairing only APP-01 would leave future invoices and commitments exposed to the same defect.

## Root Cause

The defect was a system-integrity problem, not a one-record arithmetic problem:

1. Invoice lines were effectively treated as independent financial snapshots.
2. They did not have durable source identities linking each normal line to a commitment SOV item or approved commitment change order.
3. Editable invoices were not automatically synchronized after source changes.
4. Returning an invoice from Under Review did not guarantee source reconciliation.
5. Submission did not fail when sources were missing, duplicated, stale, or inconsistent.
6. The detail response inferred a change value from the difference between the invoice schedule and commitment amount.
7. Direct line deletion could race with validation unless rejected at the database boundary.

## Required Financial Invariants

The completed implementation enforces these rules:

- Every normal invoice line links to exactly one canonical source:
  - a commitment SOV item; or
  - an approved commitment change order.
- A base SOV line always has Change Value $0.
- A change-order line gets its signed value from the approved change order.
- Caller-supplied schedule amounts cannot override the canonical source amount.
- Each current source must appear exactly once before an invoice can enter review.
- Editable invoices remain synchronized only while they are not linked or synced to accounting.
- Submitted, approved, paid, voided, retainage-release, and accounting-synced financial history is not silently rewritten.

## Project Manager Workflow

### Return an invoice to Draft

For an invoice in Under Review:

1. Open the subcontractor invoice.
2. Open **Actions**.
3. Select **Return to Draft & Edit**.
4. Open the **Detail** tab.
5. Select **Edit SOV** and make the permitted billing edits.
6. Save the invoice.
7. Select **Submit for Review** when the corrected schedule is ready.

The return-to-Draft action is available to:

- app administrators; or
- users with Commitments `write` or `admin` permission.

It is available only when the invoice:

- is currently Under Review; and
- has no Acumatica reference, document type, synchronization timestamp, or AP bill ID.

### Editable statuses

The regular edit experience is enabled for accounting-unsynced invoices in:

- Draft
- Invited
- Revise & Resubmit

Not Invited records are included in automatic source synchronization but are not treated as directly editable by the shared UI editability helper.

### When editing must remain blocked

An invoice cannot be returned to Draft or edited after accounting synchronization. This protects the financial record once any Acumatica sync marker exists.

Reopening also fails loudly if reconciliation would remove a source line that already contains work, stored materials, retainage, or retainage-release activity. An operator must resolve that financial conflict rather than losing billed history.

## Permanent Technical Solution

### Stable source identity

`subcontractor_invoice_line_items` now carries source links for commitment SOV items and approved commitment change orders. Unique indexes prevent the same source from appearing twice on one invoice.

### Database-authoritative values

Database trigger functions resolve the linked source and canonicalize:

- schedule value;
- commitment value;
- change value;
- description;
- budget code; and
- sort order.

This prevents an API client, stale browser, or future integration from supplying a contradictory financial amount.

### Editable-invoice synchronization

Commitment SOV and approved change-order changes reconcile Draft, Not Invited, Invited, and Revise & Resubmit invoices while they remain unsynced.

When an unsynced Under Review invoice returns to Draft, the database reconciles changes that occurred during review in the same controlled transition.

### Submission guard

Transition to Under Review is rejected if:

- a current commitment source is missing;
- a source is duplicated;
- an invoice line references an invalid or unapproved source;
- a source value does not match the canonical amount; or
- signed billing limits are violated.

The API returns a reconciliation error instead of allowing the invalid invoice into review.

### Deletion and reopen protection

Direct authenticated invoice-line deletion is rejected to prevent a delete/submission race. Reconciliation may remove a disappeared source only when that line has no billed financial activity.

### Deductive change orders

Approved deductive change orders retain their negative sign through schedule value, work/material validation, and percent-complete calculations.

### Safe legacy repair

The repair migration updated only deterministic matches on editable, accounting-unsynced invoices. It intentionally did not rewrite submitted or accounting-linked history.

APP-01 was returned to Draft and repaired from $21,000 to $15,200 with Change Value $0.

## Database Migrations

| Migration | Purpose |
| --- | --- |
| `20260731022000_subcontractor_invoice_sov_integrity.sql` | Adds stable sources, canonicalization, synchronization, and submission-integrity foundations. |
| `20260731022100_repair_editable_subcontractor_invoice_sov.sql` | Repairs deterministic editable, unsynced legacy invoice lines without changing finalized history. |
| `20260731022200_finalize_subcontractor_invoice_sov_integrity.sql` | Fails deployment if the reviewed integrity functions are not installed. |
| `20260731022300_close_subcontractor_invoice_sov_integrity_gaps.sql` | Adds reopen reconciliation, deductive-change handling, and direct-delete protection. |
| `20260731022400_protect_billed_lines_during_invoice_reopen.sql` | Prevents reconciliation from deleting lines with billed or retained financial activity. |

All five migrations are recorded in the linked production Supabase migration ledger.

## Application Boundaries Changed

### User interface

- `frontend/src/components/invoicing/SubcontractorInvoiceDetail.tsx`
- `frontend/src/components/invoicing/subcontractor-detail-tabs/DetailTab.tsx`
- `frontend/src/app/(main)/[projectId]/invoicing/subcontractor/new/page.tsx`

### API and financial logic

- `frontend/src/app/api/commitments/[commitmentId]/invoices/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit/route.ts`
- `frontend/src/lib/invoicing/subcontractor-invoice-editability.ts`
- `frontend/src/lib/invoicing/subcontractor-invoice-sov-integrity.ts`
- `frontend/src/lib/invoicing/subcontractor-percent-autofill.ts`
- `frontend/src/types/database.types.ts`

### Regression coverage

- `frontend/src/app/api/commitments/[commitmentId]/invoices/__tests__/route.test.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/__tests__/route.test.ts`
- `frontend/src/lib/invoicing/__tests__/subcontractor-invoice-editability.test.ts`
- `frontend/src/lib/invoicing/__tests__/subcontractor-invoice-sov-integrity.test.ts`
- `frontend/src/lib/invoicing/__tests__/subcontractor-percent-autofill.test.ts`
- `supabase/tests/subcontractor_invoice_sov_integrity.sql`

## Verification and Release Evidence

| Check | Result |
| --- | --- |
| Linked database migrations | Pass; versions `20260731022000` through `20260731022400` applied |
| Database contract | Pass; 26 pgTAP checks |
| Focused application regression | Pass; 5 Jest suites and 26 tests |
| Targeted ESLint | Pass; 0 errors and 7 existing warnings |
| Task-owned type boundary | Pass; no errors in the changed application boundary |
| Independent code review | Approved; no blockers |
| Independent React review | Approved; no blockers |
| Independent security/data-integrity review | Approved; no blockers |
| Live APP-01 database readback | Draft; Commitment $15,200; Change $0; Schedule $15,200; validator true |
| Global editable-unsynced validation | Pass; invalid invoice count 0 |
| Production deployment | Ready; `dpl_7ax2aJnzA8nhB1GXgwozFvU5ikCo` |
| Production alias | `https://projects.alleatogroup.com` |
| Authenticated browser proof | Pass; APP-01 Detail shows the corrected values and Edit SOV |

Production screenshot:

`tests/agent-browser-runs/2026-07-30-subcontractor-invoice-sov-integrity/app-01-detail-production.png`

Implementation revision:

`98cc3ab11345e1019bed2078459c716ca2ffd9b3`

Production-evidence revision:

`71e7b7964aff6c6b6bba4e2ae5b3ad0b77f65636`

## If the Problem Appears Again

Do not manually alter only the displayed change value. Treat a recurrence as a source-integrity failure.

Check, in this order:

1. Confirm the invoice status and whether any Acumatica sync marker exists.
2. Compare invoice-line `source_sov_item_id` and `source_change_order_id` values with the current commitment sources.
3. Confirm each current source appears exactly once.
4. Compare canonical source amounts with invoice schedule, commitment, and change values.
5. Run the invoice schedule-validity function used by the submission guard.
6. Review the five migration versions in the linked ledger.
7. Run `supabase/tests/subcontractor_invoice_sov_integrity.sql`.
8. Reproduce through **Return to Draft & Edit** only if the invoice is unsynced.
9. If reconciliation rejects the reopen, inspect the affected line for billed work, materials, retainage, or release activity.
10. Do not bypass the guard or rewrite finalized/accounting-linked history.

## Completion State

- The original APP-01 mismatch is repaired.
- The project-manager Draft/Edit workflow is live.
- The permanent database and application safeguards are deployed.
- The production readback is documented.
- GitHub issue #207 is closed with implementation, test, deployment, and screenshot evidence.
- No known follow-up work remains for ALL-56.
