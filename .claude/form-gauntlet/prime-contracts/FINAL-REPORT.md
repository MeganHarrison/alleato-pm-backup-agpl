# Form Gauntlet Report: Prime Contracts
**Date:** 2026-03-22
**Base URL:** http://localhost:3000
**Project ID:** 67 (Vermillion Rise Warehouse)

---

## Summary

| Status | Count |
|--------|-------|
| PASS | 9 |
| NEEDS_REVIEW | 0 |
| **Total Forms** | **9** |

**Overall: ✅ PASS — All 9 forms verified working**

---

## Results by Form

### ✅ PASS: Create Prime Contract
- **Attempts:** 1
- **Evidence:** Contract "PC-GAUNTLET-001 - Gauntlet Test Contract EDITED" was created, appeared in the list, and API confirmed the record persisted.
- **Notes:** Form at `/67/prime-contracts/new` — title, contract number, status, vendor fields all functional.

### ✅ PASS: Edit Prime Contract
- **Attempts:** 1
- **Evidence:** Title updated to "Gauntlet Test Contract EDITED", status changed to "approved", description updated. Detail page reflected all changes. Toast: "Contract updated successfully".
- **Notes:** Edit page at `?edit=1` query param (redirected from `/edit` path). Rich text editor for description uses `contenteditable="true"`. Agentation overlay required disabling via localStorage.

### ✅ PASS: Configure Settings
- **Attempts:** 1
- **Evidence:** Project settings (retention %, billing schedule) saved successfully via the Settings tab.

### ✅ PASS: Add SOV Line Item
- **Attempts:** 2
- **Fixes Applied:**
  1. **Empty state had no way to enter edit mode** — Added "Add SOV Line" button to the empty state in `PrimeContractOverviewTab.tsx`
  2. **`handleAddSovLine()` didn't auto-enter edit mode** — Fixed in `page.tsx` to call `handleStartSovEdit()` when `isSovEditing=false`
- **Evidence:** SOV line "Gauntlet SOV Line Test 2" saved. Toast: "Schedule of values updated". API confirmed line in database.

### ✅ PASS: Create Change Order
- **Attempts:** 1 (after pre-fix)
- **Pre-fix:** Removed `"draft"` from the change order status enum (was causing DB constraint violation). Changed default to `"pending"`. Files: `validation.ts`, `PrimeContractDialogs.tsx`, `types.ts`.
- **Evidence:** Change order "CO-GAUNTLET-001" created with status "pending". Appeared in the Change Orders tab.

### ✅ PASS: Reject Change Order
- **Attempts:** 2
- **Fix Applied:** `reviewer-access.ts` was querying non-existent `project_members` table → always returned `false` → all users got 403. Rewrote to use correct tables: `people` (bridge via `auth_user_id`) + `project_directory_memberships` (via `person_id` + `project_id`).
- **Evidence:** CO-GAUNTLET-001 status changed to "rejected". Toast confirmed. API returned `status: "rejected"`.

### ✅ PASS: Delete SOV Line Item
- **Attempts:** 1
- **Evidence:** "Gauntlet SOV Line Test 2" removed from SOV, save succeeded. API confirmed item absent from database.
- **Notable behavior:** Delete is not standalone — requires entering SOV edit mode (via ⋮ button on any row), clicking trash icon (no confirmation dialog), then clicking Save. Save is blocked if 0 items remain ("At least one SOV line item is required").

### ✅ PASS: Delete Prime Contract (single)
- **Attempts:** 1
- **Evidence:** "PC-GAUNTLET-001 / Gauntlet Test Contract EDITED" row removed from list. Toast: "Contract 'Gauntlet Test Contract EDITED' deleted successfully". Database confirmed hard delete.
- **Notable behavior:** AlertDialog body warns: "Any associated line items and change orders must be deleted first." Confirm button text is "Delete Contract" (not just "Delete").

### ✅ PASS: Bulk Delete Prime Contracts
- **Attempts:** 1
- **Evidence:** Both "Gauntlet Bulk Test Contract A" (PC-BULK-001) and "Gauntlet Bulk Test Contract B" (PC-BULK-002) deleted. Toast: "2 contracts deleted". Database confirmed hard deletes.
- **Notable behavior:** Checkboxes are Radix UI `[role="checkbox"]` elements (not `input[type="checkbox"]`). Bulk delete trash icon appears only when rows are selected, has no text label — locate via `svg.lucide-trash-2`. Confirmation dialog title: "Delete 2 Contracts".

---

## Bugs Found and Fixed

| Bug | File(s) Changed | Impact |
|-----|-----------------|--------|
| Change order `"draft"` status caused DB constraint violation | `validation.ts`, `PrimeContractDialogs.tsx`, `types.ts` | CREATE change order was broken for all users |
| SOV empty state had no way to add first line | `PrimeContractOverviewTab.tsx` | No path to add SOV lines on new contracts |
| `handleAddSovLine()` didn't activate edit mode | `page.tsx` | New SOV line was invisible until page refresh |
| `reviewer-access.ts` queried non-existent `project_members` table | `reviewer-access.ts` | Reject change order was broken for all users (403) |

---

## UI Patterns Discovered (for future test authors)

- **SOV edit mode:** Enter via ⋮ button on any row → edit mode for entire table. Trash icon appears per row. Save required to persist.
- **Row actions:** Last `<button>` in each row, visible on hover. No `aria-label` or `aria-haspopup`.
- **Bulk selection:** Radix UI `[role="checkbox"]`, not native checkboxes.
- **Contract tabs:** `<nav aria-label="Contract tabs">` > plain `<button>` elements (NOT `role="tab"`).
- **Edit page:** Navigate to `?edit=1` (not `/edit` path — it redirects).
- **Agentation overlay:** Disable via `localStorage.setItem('feedback-toolbar-settings', JSON.stringify({ blockInteractions: false, reactEnabled: false, webhooksEnabled: false }))` in Playwright `addInitScript`.

---

## What to Do Next

All forms verified. Prime Contracts feature is **form-complete**.

The 4 bugs fixed during this gauntlet are now resolved. Consider:
1. Adding regression tests for the change order status validation
2. Adding regression tests for the SOV reviewer access check
3. The "at least one SOV line required" constraint may be worth revisiting UX-wise (users can't delete all lines)
