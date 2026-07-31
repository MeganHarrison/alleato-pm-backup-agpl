# Submittals Longtail Fix Report

Date: 2026-06-14

## Issues Fixed

### 1. submittal_restore — raw `fetch` → `apiFetch` + `handleFormError`
**File:** `frontend/src/app/(main)/[projectId]/submittals/page.tsx`

`handleRestore` was calling `fetch(PATCH .../restore)` directly, bypassing `apiFetch` guardrails and swallowing real error details with `toast.error("Could not restore submittal")`.

**Fix:** Replaced with `apiFetch(...)` in a try/catch, errors surfaced via `handleFormError(error, { entity: "submittal", action: "save" })`. Added `import { handleFormError } from "@/lib/handle-form-error"`.

### 2. submittal_delete — `window.confirm` → `useConfirm`
**File:** `frontend/src/features/submittals/submittal-detail-client.tsx`

`handleDelete` called `window.confirm(...)` (native browser dialog) instead of the app's DS confirm pattern.

**Fix:** Added `useConfirm` hook from `@/hooks/use-confirm`. `handleDelete` now awaits `confirm({ title, description, confirmLabel, variant: "destructive" })`. `{ConfirmDialog}` rendered at the top of the return fragment. Added `import { useConfirm } from "@/hooks/use-confirm"`.

### 3. submittal_table_row_delete / bulk delete — VERIFIED OK, no change needed
**File:** `frontend/src/app/(main)/[projectId]/submittals/page.tsx`

`table.onDelete` wires to `deleteSubmittal.mutate(item.id)`. Confirmed `UnifiedTablePage` internally wraps row delete and bulk delete in built-in confirm dialogs (`deleteDialogOpen`/`bulkDeleteDialogOpen` state + `handleDeleteIntent`). No change needed.

### 4. Other raw `fetch` / swallowed errors — none found
Scanned `page.tsx`, `submittal-detail-client.tsx`, `submittal-distribute-dialog.tsx`, and hook files. All other mutations use `apiFetch`-based hooks (`useDeleteSubmittal`, `useDuplicateSubmittal`, `useCreatePackage`, etc.). No additional raw fetch or swallowed errors found in scope.

## Verification

- `npx tsc --noEmit 2>&1 | grep -i submittal` → zero output (no new errors)
- `run-frontend-eslint.sh strict` on both changed files → zero output (zero errors)

## Deferrals

- **workflow_apply_template silent no-op** (templates saved with `user_id: null` → Apply Template never adds steps): Out of scope per task instructions — do not touch `submittal-detail-client.tsx` workflow template code.
- **responsible_contractor_id FK mismatch**: Already fixed in prior commits per task instructions.
