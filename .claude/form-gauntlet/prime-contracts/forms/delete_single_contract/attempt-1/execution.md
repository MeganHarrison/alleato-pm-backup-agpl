# Execution Report: delete_single_contract

**Form:** Delete Prime Contract (single)
**URL:** http://localhost:3000/67/prime-contracts
**Contract:** Gauntlet Test Contract EDITED (PC-GAUNTLET-001)
**Date:** 2026-03-22
**Status:** SUBMITTED_SUCCESSFULLY

---

## Summary

The Playwright test successfully navigated to the Prime Contracts page, located the target contract row, opened the row actions menu, clicked the Delete option, confirmed via AlertDialog, and verified the contract was removed from the list. A success toast was visible in the after screenshot.

---

## How Row Actions Work

The Prime Contracts table uses the `UnifiedTablePage` pattern. Row actions appear as an inline row menu that becomes visible on hover. The row contains:

1. **Row hover** triggers visibility of action icons on the right side of the row.
2. **Action buttons** appear as small icon buttons at the row's far right — the last button in the row is the row actions trigger (no explicit `aria-haspopup="menu"` or `aria-label` on the button itself).
3. Clicking the last button in the row opens a **dropdown menu** with "Edit" and "Delete" options.
4. Clicking **"Delete"** opens an **AlertDialog** modal.

### AlertDialog Content

The dialog displayed:

- **Title:** "Delete Contract"
- **Body:** "Are you sure you want to delete contract PC-GAUNTLET-001 - Gauntlet Test Contract EDITED? This action cannot be undone. Any associated line items and change orders must be deleted first."
- **Buttons:** "Cancel" (secondary) | "Delete Contract" (destructive/red)

The confirmation button text is **"Delete Contract"** (not just "Delete").

---

## Toast Notification

The after screenshot shows a toast notification at the bottom-right corner with the text:

> **"Contract 'Gauntlet Test Contract EDITED' deleted successfully"**

The toast appeared briefly after the deletion confirmed.

---

## Verification

- Before: The contracts table showed PC-GAUNTLET-001 ("Gauntlet Test Contract EDITED") as a row with "Draft" status.
- After: The row is gone from the table. The remaining contracts are:
  - PC-4286-0001 (Hermitian Agreement — Approved)
  - PC-ATTACH-TEST (Attachment Test Contract — Draft)
  - PC-TEST-001 (Sun Prime Contract — Audit — Draft)
  - PC-TEST-002 (Test Prime Contract — 4 Line Items — Draft)
- The `expect(page.getByText('PC-GAUNTLET-001')).not.toBeVisible()` assertion passed.

---

## Screenshots

| Step | Path |
|------|------|
| Initial page load (contract visible) | `/tmp/gauntlet-delete-contract-before.png` |
| Row actions dropdown open (Edit/Delete visible) | `/tmp/gauntlet-delete-contract-menu.png` |
| AlertDialog confirmation modal | `/tmp/gauntlet-delete-contract-dialog.png` |
| After deletion (contract gone, toast visible) | `/tmp/gauntlet-delete-contract-after.png` |

---

## Test File

`frontend/tests/e2e/gauntlet-delete-contract.spec.ts`

Run command:
```bash
cd /Users/meganharrison/Documents/alleato-pm/frontend && npx playwright test tests/e2e/gauntlet-delete-contract.spec.ts --headed --timeout=60000 --config=config/playwright/playwright.config.ts
```

Result: 2 passed (16.2s) — auth setup + test

---

## Notes

- The row action button does NOT have `aria-haspopup="menu"` or an accessible `aria-label` — it is found by being the last `<button>` in the row after hovering.
- The AlertDialog's confirm button text is "Delete Contract" (full phrase), not just "Delete" — the test used `getByRole('button', { name: /delete|confirm|yes/i }).last()` which matched it correctly.
- Toast is transient but was captured in the after screenshot.
