# FIX: Billing Periods — billing_period_delete + billing_period_new_page

**Date:** 2026-06-13
**File changed:** `frontend/src/app/(main)/[projectId]/billing-periods/page.tsx`

---

## BUG 1 — billing_period_delete (confirm dialog no-op)

### Root Cause

`handleDeleteConfirm()` was a stub that only closed the dialog and cleared state:

```ts
async function handleDeleteConfirm() {
  setDeleteDialogOpen(false);
  setPeriodToDelete(null);
}
```

No DELETE API call was made. The user would click "Delete", see the dialog close, and nothing would change in the list.

### Evidence

- `handleDeleteConfirm` had zero mutation/fetch calls — grep-confirmed.
- The `useDeleteBillingPeriod` hook already existed in `frontend/src/hooks/use-billing-periods.ts` and is fully wired to `DELETE /api/projects/[projectId]/invoicing/billing-periods/[periodId]`.
- The DELETE API route at `frontend/src/app/api/projects/[projectId]/invoicing/billing-periods/[periodId]/route.ts` already had a complete `DELETE` handler with 409 conflict protection (blocks delete if invoices reference the period) and real error messages.

### Fix

- Added `useDeleteBillingPeriod` import.
- Instantiated `deleteBpMutation = useDeleteBillingPeriod(projectId)` alongside the existing create mutation.
- Replaced the no-op `handleDeleteConfirm` with one that calls `deleteBpMutation.mutateAsync(id)`:
  ```ts
  async function handleDeleteConfirm() {
    if (!periodToDelete) return;
    const id = String(periodToDelete.id);
    setDeleteDialogOpen(false);
    setPeriodToDelete(null);
    await deleteBpMutation.mutateAsync(id).catch(() => {
      // Error toast is handled by useDeleteBillingPeriod's onError
    });
  }
  ```
- On success: `useDeleteBillingPeriod.onSuccess` already invalidates `billingPeriodKeys.lists()` (React Query cache) and shows a real success toast.
- On error: `onError` surfaces the real server message (e.g. "This billing period is referenced by N owner invoice(s) and cannot be deleted.").

### No DB migration needed. No new API route needed.

---

## BUG 2 — billing_period_new_page (route 404)

### Root Cause

Both "New Billing Period" triggers (`header.actions` button and `emptyState.action` button) called:

```ts
router.push(`/${projectId}/billing-periods/new`)
```

The route `/[projectId]/billing-periods/new/` does not exist in the file system, so this always resulted in a 404.

### Evidence

- `find … billing-periods/new` returns no directory — confirmed missing.
- The canonical creation path is the `billing_period_create` dialog already present on the invoices page (`/[projectId]/invoices?tab=billing-periods`). That dialog uses `useCreateBillingPeriod` → `POST /api/projects/[projectId]/invoicing/billing-periods`.

### Fix

- Added dialog state (`createDialogOpen`, `bpMode`, all `bpForm*` / `bpAuto*` fields) mirroring the invoices page.
- Added `useCreateBillingPeriod` import and instantiated `createBpMutation`.
- Replaced both `router.push(…/billing-periods/new)` calls with `onClick={() => setCreateDialogOpen(true)}`.
- Embedded the full "Set Up Billing Period" dialog (Manual/Automatic tabs, date fields, resolve logic, disabled guard, error handling via `reportNonCriticalFailure`) directly in the page — identical to the invoices page dialog.
- No new page/route created. Consistent with the existing creation pattern.

### No DB migration needed. No new API route needed.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/app/(main)/[projectId]/billing-periods/page.tsx` | Added imports, create dialog state, mutations, wired delete handler, embedded create dialog, replaced dead `router.push` calls |

## Smoke Test

The DELETE endpoint is at `/api/projects/[projectId]/invoicing/billing-periods/[periodId]` — a parameterized path. The existing smoke test already covers the GET list (`GET /api/projects/${PROJECT_ID}/invoicing/billing-periods`). The DELETE route cannot be meaningfully smoke-tested without a real period ID; coverage is handled by the existing route test pattern.

## Prevention Guardrails

- Confirm dialogs with no mutation call should be caught in code review — the handler stub was syntactically valid, making this easy to miss.
- Future: consider a lint rule or test that asserts any "Delete" `AlertDialogAction` has a corresponding mutation call in scope.
