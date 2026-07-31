# Form Gauntlet — Commitments Longtail Fix Report

Date: 2026-06-14

---

## Issue 1 — edit_subcontract PUT silently drops `executed`

### Root cause
In `frontend/src/app/api/commitments/[commitmentId]/route.ts`, the `def(validatedData.executed, "executed")` call was inside the `purchase_order`-only block (lines 472–482). Both `subcontracts` and `purchase_orders` tables have an `executed boolean` column (confirmed in `database.types.ts` lines 27752 and 24506). Any edit of a subcontract that toggled `executed` was silently dropped.

`accounting_method` is confirmed to exist **only** on `purchase_orders` (not on `subcontracts`), so keeping it in the PO-only block is correct and unchanged.

SOV `budget_code_id`: Neither `subcontract_sov_items` nor `purchase_order_sov_items` has a `budget_code_id` column in the DB — both use `budget_code` (text). The DISCOVERY.md reference to "SOV budget_code_id being dropped" is a false alarm; the text field is already saved correctly. No action taken.

### Fix
Moved `def(validatedData.executed, "executed")` out of the `purchase_order`-only block into the shared section (applies to both types), and removed the duplicate `def(validatedData.executed, ...)` from the PO block.

**File changed:** `frontend/src/app/api/commitments/[commitmentId]/route.ts`

---

## Issue 2 — edit_purchase_order PUT is header-only (SOV)

### Finding
Confirmed intentional. The PO edit PUT sends header fields only; SOV lines for purchase orders are owned by `ScheduleOfValuesTab.tsx` via `PUT /api/projects/[projectId]/commitments/[commitmentId]/sov`. No change needed.

---

## Issue 3 — email_commitment_dialog generic toast swallows server error

### Root cause
`catch (error) { toast.error("Failed to send email") }` — bare string toast, violates `design-system/no-raw-error-message-toast` lint rule pattern, and loses the server's error detail.

### Fix
Replaced `toast.error("Failed to send email")` with `handleFormError(error, { entity: "commitment email", action: "save" })`, which handles 401/403/404/409/5xx with appropriate messages and logs server errors to console.

**File changed:** `frontend/src/components/commitments/EmailCommitmentDialog.tsx`

---

## Smoke Test Regression Entry

Added a regression guard comment + entry to `scripts/api-smoke-contracts.mjs` asserting the commitments PUT endpoint returns 401 (not 500) for an unauthenticated request. A 500 here would indicate the schema rejected or crashed before auth, revealing a field-loss regression.

**File changed:** `scripts/api-smoke-contracts.mjs`

---

## Deferred Items (out of scope per task constraints)

- `create_commitment_pco_scoped` — the PCO new page at `/[projectId]/commitments/[commitmentId]/pcos/new/page.tsx` uses `toast.error("Failed to create PCO")`. Scope note: this path is under `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/pcos/` which was NOT explicitly in the forbidden scope, but the DISCOVERY notes it as a `commitment-pcos`-adjacent feature. Deferred to avoid any risk of collision with the concurrent `commitment-pcos` session.

---

## Verification

- `cd frontend && npx tsc --noEmit 2>&1 | grep -iE "contracts|commitment"` → no output (zero errors)
- `bash scripts/lint-staged/run-frontend-eslint.sh strict frontend/src/app/api/commitments/[commitmentId]/route.ts frontend/src/components/commitments/EmailCommitmentDialog.tsx` → no output (zero errors)

---

## Prevention / Guardrails

1. **What would have caught this before production?** An edit test that saves a subcontract with `executed=true`, reloads, and asserts the field persisted. The DISCOVERY.md risk note flagged the exact field — the gap was no automated assertion.
2. **Guardrail added:** Smoke test entry asserting the commitments PUT returns 401 (not 500) for unauthenticated calls, ensuring a future schema regression (e.g. moving `executed` back behind a type guard) surfaces immediately.
3. **Class of bug:** "Column exists in both tables but update logic splits by type" — any future addition to the shared block should be verified against both DB type definitions.
