# Form Gauntlet — Change Management Long-tail Fixes

## Issues addressed

### 1. pco_create — error swallowing
**File:** `frontend/src/app/(main)/[projectId]/pcos/new/page.tsx`
**Root cause:** Both `handleSaveDraft` and `handleSubmit` routed failures through `reportNonCriticalFailure`, which logs to PostHog but shows no user-visible toast. A 500 from the API was invisible to the user.
**Fix:** Replaced `reportNonCriticalFailure` with `handleFormError(error, { entity: "PCO draft"|"PCO", action: "save"|"create" })`. Now surfaces a specific status-aware toast on any failure. Removed the stale `reportNonCriticalFailure` import.

### 2. pco_edit — error swallowing
**File:** `frontend/src/app/(main)/[projectId]/pcos/[pcoId]/edit/page.tsx`
**Root cause:** Same pattern — `handleSave` catch only called `reportNonCriticalFailure`.
**Fix:** Replaced with `handleFormError(error, { entity: "PCO", action: "save" })`.

### 3. pco_edit — existing line-item value edits silently dropped
**File:** `frontend/src/app/(main)/[projectId]/pcos/[pcoId]/edit/page.tsx`
**Root cause:** The `handleSave` loop identified existing items (those with numeric `tempId`) but did nothing with them — only new items (UUID `tempId`) were POSTed, and removed items were DELETEd. Editing an amount/qty/description on an existing line item had no write path.
**Fix:** Added an `else` branch for existing items that calls `apiFetch` with `PUT` to `/api/projects/{projectId}/pcos/{pcoId}/line-items/{id}`. Used `apiFetch` directly (not the hook) to avoid double-toasting: `useUpdatePCOLineItem`'s `onError` fires `toast.error(error.message)` and `mutateAsync` re-throws, which would cause a second toast from the outer catch. `apiFetch` throws once; the outer `handleFormError` catches it once.
**What persists now:** description, quantity, UOM, unit cost, category for every pre-existing line item on save.

### 4. commitment_co_edit — line-item delete confirmation
**File:** `frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx`
**Status:** ALREADY GATED. `handleDeleteLineItem` (line 357) uses `useConfirm` — it awaits `confirm({ description, variant: "destructive" })` before firing the DELETE. The `onClick={() => handleDeleteLineItem(item.id)}` at line 1233 routes through this confirmed handler. No change required.

## Deferrals

- **`useUpdatePCOLineItem` hook's `onError` calls `toast.error(error.message)`** — violates `no-raw-error-message-toast`. Pre-existing, in `hooks/use-pcos.ts`, out of scope for this wave. Flag for a hooks cleanup pass.
- **`pco_edit` partial-write hazard** — the sequential mutation chain (PATCH PCO → group/ungroup CEs → create/update/delete line items) remains non-transactional. Surfacing aside, the atomicity fix was investigated 2026-06-14 and found to be BLOCKED on a deeper data-model bug, not just a missing transaction:
  - The `/pcos/new` + `/pcos/[pcoId]/edit` pages write the header to the numeric `potential_change_orders` table (id `bigint`), but `pco_line_items.pco_id` is `uuid` and belongs to the `commitment_pcos` / `prime_contract_pcos` model. The line-item route inserts a numeric id into a uuid column, so **line items have never persisted for these pages** (and the edit page PUTs to a `/line-items/[lineItemId]` route that doesn't exist).
  - The form's fields (`change_reason`, `location`, `reference`, `requested_by`/`request_received_from`, `field_change`, `paid_in_full`, `is_private`) exist on `commitment_pcos` — NOT on `potential_change_orders`, where they are silently dropped on save.
  - Conclusion: wrapping the current flow in a transaction would atomically write a broken shape. The correct fix is to re-point these pages at `commitment_pcos` + `pco_line_items` (uuid) — including the list/detail reads and hooks — then add a transactional create/update RPC. That is a separate, larger change tracked as its own task (spawned 2026-06-14), deliberately NOT bundled with the owner-invoice atomicity fix.
- **`commitment_pco_edit` (stub)** — Edit button remains disabled ("coming soon"). Out of scope per wave boundaries; requires a new form implementation.

## Verification

```
cd frontend && npx tsc --noEmit 2>&1 | grep -iE "pcos/new|pcos/\[pcoId\]" → 0 errors
bash scripts/lint-staged/run-frontend-eslint.sh strict \
  "frontend/src/app/(main)/[projectId]/pcos/new/page.tsx" \
  "frontend/src/app/(main)/[projectId]/pcos/[pcoId]/edit/page.tsx" → 0 errors
```
