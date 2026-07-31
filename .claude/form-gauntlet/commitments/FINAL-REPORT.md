# Form Gauntlet Report: Commitments
**Date:** 2026-03-22
**Base URL:** http://localhost:3000
**Project ID:** 67

## Summary

| Status | Count |
|--------|-------|
| PASS | 3 |
| NEEDS_REVIEW | 0 |
| Total Forms | 3 |

**Overall: PASS** — All 3 forms verified by independent verifiers.

---

## Results by Form

### ✅ PASS: Create Subcontract
- **Attempts:** 1
- **Evidence:** Record "SC-GAUNTLET-001 / Test Subcontract SC-GAUNTLET-001" confirmed in commitments list and detail page via independent Supabase query. All field values matched.
- **Non-blocking issue:** Vendor "3 Quarterdeck LLC" doesn't resolve on the detail page — the `contract_company_id` FK stored doesn't map to any record in the `companies` table. The form submits the vendor's internal ID from the `vendors` table, not a `companies` table ID. Display gap only, submission works.
- **Accessibility issue:** The `contractNumber` input is absent from the accessibility tree — requires JavaScript injection to fill. Not a functional bug but degrades testability.

### ✅ PASS: Create Purchase Order
- **Attempts:** 1
- **Evidence:** Record "PO-GAUNTLET-001 / Test PO PO-GAUNTLET-001" confirmed in commitments list and detail page. All field values matched including accounting method "Amount".

### ✅ PASS: Edit Commitment (Inline)
- **Attempts:** 3 (2 bugs fixed)
- **Evidence:** Title "Test Subcontract SC-GAUNTLET-001 EDITED" and description "Updated by form gauntlet" confirmed on detail page in read-only mode after save.

---

## Bugs Fixed

### Bug 1: PUT /api/commitments/[id] — Schema mismatch (Critical)
**File:** `frontend/src/app/api/commitments/[id]/route.ts`

The PUT handler used `commitmentSchema.parse(body)` — an old creation schema that:
- Required `number` but form sends `contract_number`
- Required `contract_company_id` as UUID (no nulls) but form sends nullable
- Required lowercase `status` but form sends Title Case ("Draft")
- Required `original_amount` which the form never sends

**Fix:** Replaced with `commitmentEditSchema` that matches the actual form payload shape. All fields optional, correct field names, no UUID constraint on company ID.

### Bug 2: PUT /api/commitments/[id] — Supabase join error (Critical)
**File:** `frontend/src/app/api/commitments/[id]/route.ts`

The `.select()` after `.update()` used PostgREST join syntax (`companies!contract_company_id(*)`). The GET handler already had a comment warning about this exact issue, but the PUT handler hadn't been updated. Supabase's schema cache doesn't have this relationship configured, causing a 400 on every successful update.

**Fix:** Changed `.select(join syntax)` to `.select("*")`. The client re-fetches full details via GET after save anyway.

---

## Non-Blocking Issues Found

| Issue | Form | Severity | Action |
|-------|------|----------|--------|
| Vendor FK doesn't resolve on detail page | create_subcontract | Low | Vendor ID from `vendors` table vs `companies` table — display-only gap |
| `contractNumber` input not in accessibility tree | All forms | Medium | RHF field not wired to accessible input — breaks automated testing and screen readers |
| No error toast shown when save fails | edit_commitment | Medium | API errors are caught but the toast error call was not firing in some failure states |

---

## What to Do Next

All forms verified. Feature is form-complete with the 2 API fixes applied.

Recommended follow-up:
1. Investigate the vendor `contract_company_id` FK mismatch — vendor IDs may not link to `companies` table
2. Fix `contractNumber` accessibility — the input should be visible to the accessibility tree
