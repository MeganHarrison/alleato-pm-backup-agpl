# Invoicing — Long-tail Fix Report

Generated: 2026-06-14

## Issues Fixed

### 1. owner_invoice_edit — notes data-loss bug (PRIORITY)
**File:** `frontend/src/app/(main)/[projectId]/invoicing/[invoiceId]/page.tsx`
**Root cause:** `InvoiceEditForm` defaulted `notes: ""` in `useForm`. Any PATCH sent `notes: null`, silently wiping the stored value.
**Fix:** Changed default to `invoice.notes ?? ""` so the field pre-fills with the existing value. Also added `notes` field to the `OwnerInvoice` interface in `invoicing-table-config.tsx` (it was missing, which masked the bug at the type level).

### 2. subcontractor_invoice_create — raw fetch + swallowed error
**File:** `frontend/src/app/(main)/[projectId]/invoicing/subcontractor/new/page.tsx`
**Root cause:** All three data-loading `fetch()` calls and the submit `fetch()` bypassed `apiFetch`. The submit handler did `toast.error("Failed to save invoice")` discarding the Error message.
**Fix:** Converted all four raw `fetch` calls to `apiFetch`. Submit catch now surfaces `err.message`. Picklist catch does the same. `apiFetch` import added.

### 3. owner_invoice_create — partial-failure detection on prime path
**File:** `frontend/src/app/(main)/[projectId]/invoices/new/page.tsx`
**Root cause:** The 3-step prime write (payment-application → owner-invoice → N line-items) was already using `apiFetch` + `toErrorMessage` for the header steps. The line-item loop, however, would throw on the first failure and leave a partial invoice with no clear message.
**Fix:** Wrapped each line-item POST in an individual try/catch, collected failed indices, and on any failure reported a loud message: "Invoice #X was created (id Y) but line items Z failed to save. Open the invoice and add the missing line items manually." No generic success if any line item failed. Note: a DB-level transaction RPC is not available in the existing API surface; this is the minimal safe fix short of a backend migration.

### 4. Pervasive error-swallowing catches (summary_edit, sov_edit, finish_review, mark_paid, email, void, delete, submit, approve, revise)
**Files:**
- `frontend/src/app/(main)/[projectId]/invoicing/[invoiceId]/page.tsx` (handleSaveSOV, handleSubmit, handleRevise, handleApprove, handleApproveAsNoted, handleVoid, handleDelete, AddLineItemDialog.onSubmit)
- `frontend/src/components/invoicing/SubcontractorInvoiceDetail.tsx` (handleStatus x2, handleRecordOwnerApproval, handleSendInvoiceEmail, handleInviteSubcontractor, handleResendErp, handleMarkPaid, finish_review inline handler)
- `frontend/src/components/invoicing/subcontractor-detail-tabs/SummaryTab.tsx` (handleSave)
- `frontend/src/components/invoicing/subcontractor-detail-tabs/DetailTab.tsx` (saveEdits)
- `frontend/src/components/invoicing/subcontractor-detail-tabs/GeneralTab.tsx` (handleSaveSummary, saveSOVEdits)
**Fix:** All generic `toast.error("Failed to …")` calls replaced with `toast.error(err instanceof Error && err.message ? err.message : "…")` pattern, surfacing the real server message from `apiFetch`'s thrown Error.

### 5. GeneralTab.tsx — dead code check
**Conclusion:** NOT dead code in invoicing scope. `GeneralTab` is imported and used at line 921 of `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx`, which is outside the invoicing scope. It is not wired to the subcontractor invoice detail page (that uses `SummaryTab` + `DetailTab`). No deletion performed. Error fixes applied to the file anyway since it is editable within the component scope and was flagged in the discovery.

## Verification
- `npx tsc --noEmit | grep -i invoic` → zero errors
- `run-frontend-eslint.sh strict <all 8 changed files>` → zero errors

## Files Changed
1. `frontend/src/app/(main)/[projectId]/invoicing/[invoiceId]/page.tsx`
2. `frontend/src/app/(main)/[projectId]/invoicing/subcontractor/new/page.tsx`
3. `frontend/src/app/(main)/[projectId]/invoices/new/page.tsx`
4. `frontend/src/components/invoicing/subcontractor-detail-tabs/SummaryTab.tsx`
5. `frontend/src/components/invoicing/subcontractor-detail-tabs/DetailTab.tsx`
6. `frontend/src/components/invoicing/subcontractor-detail-tabs/GeneralTab.tsx`
7. `frontend/src/components/invoicing/SubcontractorInvoiceDetail.tsx`
8. `frontend/src/features/invoicing/invoicing-table-config.tsx` (added missing `notes` field to `OwnerInvoice`)

## Deferrals
- **owner_invoice_create atomic write**: ✅ RESOLVED 2026-06-14. Implemented the `create_owner_invoice_atomic` Postgres function (migration `20260614120000_atomic_owner_invoice_create.sql`) wrapping payment application + invoice header + all line items in one transaction (SECURITY INVOKER, RLS preserved; approved-contract + duplicate-app# rules preserved). New route `POST /api/projects/[projectId]/invoicing/owner/atomic` calls it; the prime branch of `invoices/new/page.tsx` now makes a single call instead of three sequential ones. Verified: success writes all rows; induced mid-write failures (bad numeric line item, duplicate app #) leave ZERO orphaned rows. Regression guard: `scripts/db/verify-owner-invoice-atomic.mjs`.
- **`/billing-periods/new` missing route** and **billing_period_delete no-op**: out of scope per task instructions (billing-periods page already fixed).
