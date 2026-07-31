# Estimates Bug Fix Report

**Date:** 2026-06-13
**Files changed:**
- `frontend/src/app/(main)/[projectId]/estimates/[estimateId]/estimate-detail-client-v2.tsx`
- `frontend/src/app/(main)/[projectId]/estimates/estimates-client.tsx`

---

## BUG 1 — estimate_summary_fields_inline: Fake Save Button Removed

**Root cause:** `handleSave` (line 1430) was a 300ms `setTimeout` + success toast with no API call. Real saves already happened on blur via `patchEstimate` (called from `handleDurationMonthsBlur`, and triggered by all inline cell edits). The `isDirty`/`isSaving` state existed solely to show a Save button that was pure theater.

**Diagnosis:** `setIsDirty(true)` was called AFTER every successful `patchEstimate`, `patchGcItem`, `patchDetailItem`, `upsertDetailCatalogRow`, `patchSublistSub`, and `deleteSublistSub` — i.e., after the real API call had already completed. So the Save button appeared AFTER the data was already persisted, making it doubly misleading.

**Fix:** Removed `isDirty`, `isSaving`, `handleSave`, and all `setIsDirty(true)` calls. Removed the conditional `<Button>Save</Button>` from `actionsMenu`. The on-blur save path continues to function as before.

**Evidence:** `patchEstimate` wraps a real `PUT /api/projects/.../estimates/{id}` call with error handling via `showEstimateError`. No summary fields are exclusive to the Save button.

**Guardrail:** There is no path remaining where a fake save can mislead the user. Any future "explicit save" requirement must be wired to a real API call.

---

## BUG 2 — use_bid: Silent Failure Fixed

**Root cause:** Both call sites used `void apiFetch(...).then(() => toast.success(...))` with no `.catch`. A failed POST threw an unhandled promise rejection, bypassed the success toast, and left the user with no feedback.

**Fix:** Both call sites (one in the `handleSubPrimaryAction` callback at ~line 3862, one in the inline "Use bid" button `onClick` at ~line 5059) are now wrapped in an `async IIFE` with `try/catch`. On failure, `toast.error()` surfaces the real `err.message`. Success toast only fires after the await resolves.

**Guardrail:** Pattern matches the existing `showEstimateError` approach used throughout this file — errors are never swallowed silently.

---

## BUG 3 — bulk_delete_estimates: Confirm Dialog + Promise.allSettled

**Root cause:** `handleBulkDelete` called `Promise.all(...)` directly with no confirmation gate. Single delete uses an `AlertDialog`; bulk delete did not. `Promise.all` also fails fast — if one DELETE fails, remaining deletes may or may not complete, and the catch showed a generic error with no count information.

**Fix:**
1. `handleBulkDelete` now just opens `bulkDeleteDialogOpen` state — it no longer executes the deletes.
2. `executeBulkDelete` (new function) does the actual deletes using `Promise.allSettled` after the user confirms.
3. A new `AlertDialog` renders with count-aware copy ("Delete N estimates?") and a destructive confirm button that calls `executeBulkDelete`.
4. Toast distinguishes three outcomes: all succeeded, all failed, or partial (`N deleted, M failed`).

**Guardrail:** `Promise.allSettled` guarantees all DELETEs run to completion regardless of partial failures. The `router.refresh()` always fires to sync UI with server state.

---

## BUG 4 — scope_item_inline: Error Toast on Toggle Failure

**Root cause:** `toggleScopeItemChecked` catch block silently reverted the optimistic update with a comment `// revert` and no user notification. The user would see the checkbox snap back with no explanation.

**Fix:** The catch block now calls `toast.error(`Failed to save scope item: ${msg}`)` after reverting, surfacing the real error message.

**Guardrail:** Consistent with the rest of the detail client where `showEstimateError` is used for similar PATCH failures.

---

## Typecheck

`npx tsc --noEmit` exited 0 (no errors introduced).

## Prevention

- **What would have caught this before production?** A form gauntlet test that clicks Save and verifies the network tab has no outgoing request (BUG 1); an E2E test that mocks a failed use-bid POST and checks for an error toast (BUG 2); a bulk-delete test that checks for a confirmation dialog before deletes fire (BUG 3); a toggle test with a mocked failed PATCH checking for error toast (BUG 4).
- **Recurring pattern:** Inline mutation handlers throughout this file use `void promise.then(...)` — any new handler should use `async/await` in a try/catch with explicit error surfacing.
