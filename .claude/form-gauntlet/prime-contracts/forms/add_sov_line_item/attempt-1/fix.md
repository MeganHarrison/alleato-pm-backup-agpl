# Fix Report: add_sov_line_item — Attempt 1

## Root Cause Found

The SOV empty state rendered when `displayedSovItems.length === 0` had no actionable CTA to enter edit mode. The only way to add SOV lines was:

1. The "Add" dropdown button in the header — this called `onAddSovLine()` directly, which pushes a new item into `sovDraftItems`. However, because `isSovEditing` was `false`, the `displayedSovItems` reference was pointing at `lineItems` (the persisted data from the API), not `sovDraftItems`. React would render the empty state again since `lineItems` was still `[]`.
2. The bottom "Add Line Item" button — only rendered when `isSovEditing === true` (line 828), so it was never visible on an empty contract.

The missing piece: there was no UI path to call `onStartSovEdit()` (which sets `isSovEditing = true` and initializes `sovDraftItems` from `lineItems`) when the table was empty. The `MoreVertical` per-row action button that also triggers edit mode requires an existing row to click on — impossible when there are zero rows.

## Files Changed

**`frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/components/PrimeContractOverviewTab.tsx`**

Added a `<Button>` inside the empty state `div` (lines ~543-550). The button's `onClick` handler calls both `onStartSovEdit()` and `onAddSovLine()` in sequence:

- `onStartSovEdit()` — sets `isSovEditing = true` and initializes `sovDraftItems` to a copy of `lineItems` (empty array in the zero-line case)
- `onAddSovLine()` — uses a functional state update (`prev => [...prev, newItem]`) so it correctly sees the `[]` set by `onStartSovEdit` and appends the first blank line

React 18 batches both state updates within a single event handler, so the component re-renders once with `isSovEditing = true` and `sovDraftItems = [newItem]`. This immediately reveals the editable row and the amber warning banner.

Button style matches the existing "Add SOV Line" button at the bottom of the table (`variant="outline"`, `size="sm"`, `Plus` icon from lucide-react) — both already imported.

## Why This Fix Addresses the Verifier's Findings

The verifier found:
> "The 'Add Line Item' button in the SOV section only renders when `isSovEditing === true`"
> "When the contract has 0 SOV lines, there is no way to enter edit mode via the UI"

The fix adds a direct entry point into edit mode from the empty state. Clicking "Add SOV Line" in the empty state:
1. Enters edit mode (`isSovEditing = true`)
2. Immediately adds the first blank draft row (bypassing the need to click a second button)

The "Add SOV Line" form is now reachable with zero pre-existing SOV lines.

## Edge Cases and Follow-On Concerns

1. **Header "Add" dropdown on empty contract**: The header dropdown's `onAddSovLine` call without first calling `onStartSovEdit` still has the original bug — clicking it when `isSovEditing = false` pushes to `sovDraftItems` but `displayedSovItems` still shows `lineItems` (empty), so nothing appears to happen. This was a pre-existing bug not introduced by this fix, and is not in scope per spec instructions. Could be addressed by guarding `onAddSovLine` to auto-enter edit mode if not already editing.

2. **React 18 batching**: The fix relies on React 18 automatic batching in event handlers. Since this codebase uses React 19 (per `package.json`), batching is guaranteed and the sequential `onStartSovEdit(); onAddSovLine();` pattern is safe.

3. **State ordering**: `handleStartSovEdit` calls `setSovDraftItems(normalizeSovDraftItems([]))` (when `lineItems` is empty), then `handleAddSovLine` calls `setSovDraftItems(prev => [...prev, newItem])`. The functional update in `handleAddSovLine` correctly receives `[]` as `prev` even with batching, producing `[newItem]` as the final state.
