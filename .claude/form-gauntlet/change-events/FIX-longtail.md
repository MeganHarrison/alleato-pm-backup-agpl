# Form Gauntlet — Change Events Longtail Fix Report

Fixed: 2026-06-14

## Issues Fixed

### 1. change_event_restore — confirmation + awaited call
**File:** `frontend/src/app/(main)/[projectId]/change-events/page.tsx`
**Fix:** Added `restoreDialog` via `useConfirmationDialog` (title: "Restore Change Event"). `handleRestore` now calls `restoreDialog.confirm(async () => { await apiFetch(...); })`. Real error message surfaced from `err instanceof Error ? err.message : "Failed to restore"`. Added `{restoreDialog.dialog}` to JSX. Eliminated the unawaited `.then/.catch` pattern.

### 2. change_event_send_rfq — send ALL selected items + full payload + partial failure report
**File:** `frontend/src/app/(main)/[projectId]/change-events/page.tsx`
**Fix:** `handleSendRfq` now iterates ALL `tableState.selectedIds` (not just `[0]`). Sends each via `Promise.allSettled`, reports `succeeded.length` and `failed.length` separately. On partial failure: `toast.error("Failed to send N RFQ(s): <reason>")` — loud and actionable. Sheet only closes when all succeed. Payload now includes `assignedContactId` (mirrors detail-page handler).

### 3. change_event_convert_to_pco — raw fetch → apiFetch + real errors
**File:** `frontend/src/components/domain/change-events/ChangeEventConvertDialog.tsx`
**Fix:** Both `fetchContracts` (initial load) and `handleConvert` (submit) now use `apiFetch`. Removed `console.error`. Removed `any` casts — replaced with typed narrowing. Error catch surfaces `err.message` instead of generic string.

### 4. change_event_approval_workflow — raw fetch → apiFetch + confirm on approve/reject
**File:** `frontend/src/components/domain/change-events/ChangeEventApprovalWorkflow.tsx`
**Fix:** All three API calls (GET on mount, POST submit-for-approval, PUT approve/reject) converted to `apiFetch`. Added `approveDialog` and `rejectDialog` via `useConfirmationDialog`. Approve/Reject buttons now call `handleApprove`/`handleReject` which gate through the confirmation dialog before calling `performApproval`. Dialogs rendered at bottom of return JSX (wrapped in Fragment). Pre-existing hardcoded color violations (`emerald`, `amber`) fixed to `text-status-success`/`text-status-warning`.

### 5. change_event_add_company — hand-rolled modal → DS Modal component
**File:** `frontend/src/components/domain/change-events/change-event-form/AddCompanyModal.tsx`
**Fix:** Replaced `fixed inset-0` backdrop + raw `<h3>` (with eslint-disable) with `Modal`/`ModalContent`/`ModalHeader`/`ModalTitle`/`ModalDescription`/`ModalFooter` from `@/components/ui/unified-modal`. No raw `<button>`, no hardcoded colors. Error handler now surfaces real `err.message`.

### 6. line-item partial failure — toast.warning → toast.error
**Files:** `frontend/src/app/(main)/[projectId]/change-events/new/page.tsx`, `frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/edit/page.tsx`
**Fix:** Changed `toast.warning(...)` to `toast.error(...)` on `Promise.allSettled` partial failures. The reason string (real server message) was already being included — this makes the severity unambiguously an error rather than a soft caution. Create and edit both now emit `toast.error("Change event [created/saved] but N line item(s) failed: <reason>")`.

## Verification

- `npx tsc --noEmit | grep -i change-event` → zero new errors
- `eslint --max-warnings 0` on all 6 changed files → zero violations

## Deferred

None. All 6 issues resolved.
