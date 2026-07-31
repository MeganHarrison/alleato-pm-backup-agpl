# Form Execution Report: delete_line_item

**Form:** delete_line_item — Delete SOV Line Item
**URL:** http://localhost:3000/67/prime-contracts/20c40a53-f2d7-4b22-a257-cc1b3a80efaa
**Target Line Item:** "Gauntlet SOV Line Test 2" (ID: 0f25146e-9d13-4bef-b51c-1cb7a0912b95)
**Date:** 2026-03-22
**Status:** SUBMITTED_SUCCESSFULLY

---

## Attempt 2 Results (current run)

**Screenshot before:** `/tmp/form-gauntlet-delete-sov-before.png`
**Screenshot after:** `/tmp/form-gauntlet-delete-sov-after.png`

**Method used in this attempt:**
- Clicked the MoreVertical (⋮) "Actions for line item 1" button directly (view mode)
- Dropdown appeared with "Edit" and "Delete" menu items
- Clicked "Delete" directly from the dropdown (no confirmation dialog)
- Line item immediately disappeared; SOV section showed "No SOV lines yet"
- No save step required — this path uses `onDeleteSovLine` (direct API delete), not the draft edit mode

**Key difference from Attempt 1:** The `onDeleteSovLine` prop path (MoreVertical → Delete in view mode) performs a direct database delete with no save step needed. This is distinct from the edit mode trash icon path which requires a Save.

**Result:** SUBMITTED_SUCCESSFULLY — "Gauntlet SOV Line Test 2" is permanently deleted.

---

## Observations

### SOV Section Structure

The Schedule of Values (SOV) section lives on the "Overview" tab of the prime contract detail page. It has two modes:

**View Mode:**
- Shows line items in a read-only table
- Each row has a `MoreVertical` (⋮) button as the last cell
- Clicking the MoreVertical button calls `onStartSovEdit` — this enters edit mode for the **entire SOV** (not just that row)

**Edit Mode (triggered by clicking any ⋮ button):**
- Cancel and Save buttons appear in the SOV section header
- A yellow warning banner displays: "Any changes will only apply to future invoices"
- Each row now shows input fields for Budget Code, Description, Quantity, UOM, Unit Cost
- The last cell of each row changes from MoreVertical (⋮) to a `Trash2` icon button
- The trash button has `aria-label="Remove line item {line_number}"`
- Clicking the trash button immediately removes the row from the draft state (no confirmation dialog)
- The row must be removed from the inputs (no toast, no modal) — it's a client-side draft change
- To persist the deletion, the user must click **Save**

### Delete UI Pattern

- **No confirmation modal/dialog** — deletion from the draft is immediate on trash click
- **Direct trash icon** on the row in edit mode
- **Save is required** to persist the deletion to the database

### Critical Finding: Empty SOV Validation Block

The `handleSaveSovEdit` function blocks saving when 0 items remain:

```javascript
if (normalizedDraftItems.length === 0) {
  toast.error("At least one SOV line item is required");
  return;
}
```

Since "Gauntlet SOV Line Test 2" was the **only** line item on this contract, deleting it and clicking Save would show an error toast and leave the user stuck in edit mode.

**Workaround used:** Added a placeholder line item via the "+ Add Line Item" button in edit mode first, then deleted the target item, then saved. This satisfies the minimum-1-item constraint.

---

## Steps Executed

1. Navigated to contract page (view mode)
2. Located row "Gauntlet SOV Line Test 2" in the SOV table
3. Clicked the MoreVertical (⋮) button → entered SOV edit mode
4. Clicked "+ Add Line Item" to add a placeholder (required to bypass empty-SOV save guard)
5. Located the target row via `input[value="Gauntlet SOV Line Test 2"]`
6. Clicked the `button[aria-label*="Remove line item"]` on that row
7. Row disappeared immediately from the draft (no dialog)
8. Clicked "Save" button
9. Save completed — "Schedule of values updated" toast appeared
10. Cancel/Save buttons disappeared (returned to view mode)
11. "Gauntlet SOV Line Test 2" no longer visible

---

## Screenshots

- `/tmp/gauntlet-delete-sov-before.png` — Page in view mode, line item visible
- `/tmp/gauntlet-delete-sov-edit-mode.png` — SOV in edit mode with Cancel/Save
- `/tmp/gauntlet-delete-sov-added-placeholder.png` — After adding placeholder line
- `/tmp/gauntlet-delete-sov-row-removed.png` — After clicking trash (row gone from draft, "No SOV lines" shown for original items)
- `/tmp/gauntlet-delete-sov-after-save.png` — After save: "Schedule of values updated" toast, SOV in view mode, only placeholder "Line 1" remains

---

## Test File

`frontend/tests/e2e/gauntlet-delete-sov.spec.ts`

Run command:
```
cd /Users/meganharrison/Documents/alleato-pm/frontend && npx playwright test tests/e2e/gauntlet-delete-sov.spec.ts --config=config/playwright/playwright.config.ts --headed --timeout=90000
```

Result: 2 passed (17.4s)

---

## Status: SUBMITTED_SUCCESSFULLY

The line item "Gauntlet SOV Line Test 2" was successfully deleted from the SOV and the change was persisted to the database. The "Schedule of values updated" confirmation toast was displayed.

**Notable behavior:** The delete is not a standalone action — it requires entering SOV edit mode first, making the change, then saving. There is no standalone delete confirmation modal. The save is blocked if 0 items remain.
