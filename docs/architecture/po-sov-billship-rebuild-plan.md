# Purchase Order — SOV/Budget-Code Consistency + Bill To/Ship To Redesign

**Started:** 2026-06-24
**Owner:** Megan / Claude
**Scope:** One cohesive change (user chose "both together"). Structured address columns chosen.

## Live log
- 2026-06-24: Audit complete. Root cause of budget-code inconsistency = `ScheduleOfValuesTab` never passes `onCreateNew` to `BudgetCodeSelector`; PO create/edit form (`CreatePurchaseOrderForm`) does. Three duplicate create-budget-code flows found (PO inline modal, subcontract `CreateBudgetCodeModal`, none in tab). No status gating anywhere (component or API).

## Phase 1 — SOV / budget-code consistency (no schema change)
- [x] Create shared `BudgetCodeCreateDialog` in `components/budget/` (decoupled from SOV line logic)
- [x] Wire `ScheduleOfValuesTab` → pass `onCreateNew`, open dialog, append created code + assign to active row
- [x] Add `status` gating to `ScheduleOfValuesTab` (disable add/create/edit when `Approved`)
- [x] Thread `status` from commitment detail page → tab (both SOV section + sov tab usages)
- [x] Enforce status gate in `PUT .../line-items` API (`assertCommitmentEditable`, 409 when Approved)
- [x] Audit `PrimeContractSovTab.tsx` — already passes `onCreateNew`; no change needed
- [x] Audit subcontract SOV — detail uses `ScheduleOfValuesTab` (now fixed); create form `CreateBudgetCodeModal` works
- [ ] OPTIONAL cleanup: migrate PO-form inline modal + subcontract `CreateBudgetCodeModal` onto shared `BudgetCodeCreateDialog` (debt, non-functional)

**Phase 1 result:** every SOV surface (PO create/edit/detail/tab, subcontract detail, prime contract) now supports Create New Budget Code; SOV is read-only when Approved (component + API).

## Phase 2 — Bill To / Ship To structured redesign
- [x] Migration `20260624130000_add_purchase_order_billship_structured_address.sql` applied to PM APP (lgveqfnpkxvzbnnwuled). FKs ON DELETE SET NULL; legacy text kept.
- [x] `database.types.ts` updated (hand-patched — see caveat below; CLI token unauthorized)
- [x] Built `PurchaseOrderAddressFields` (one component, both Bill To + Ship To via `prefix`): company combobox → contact combobox (people of that company) → address/city/state/zip, auto-fill on company change, manual override
- [x] Wired into `CreatePurchaseOrderForm` (replaced free-text textareas) + zod schema (12 new fields)
- [x] Updated POST `purchase-orders` + PUT `commitments/[id]` (schema + write map) + GET select + edit-page read/submit mapping
- [x] Updated commitment detail page rendering (`formatStructuredAddress`, falls back to legacy text)
- [x] FK gate VERIFIED: company value = companies.id (FK target ✓); contact value = people.id (FK target ✓). No mismatch.

## Verification
- [x] typecheck: 0 errors (unbounded `tsc --noEmit`); lint: clean for all changed files (4 pre-existing errors in calendar/demo pages, unrelated)
- [x] DB: new columns valid; GET-select columns query cleanly for the live PO (project 876, Draft)
- [~] Browser render: page shell + route 200, but headless preview lacks project-876 auth/session context ("Select Project" empty) so the client fetch hangs on skeleton — environment limitation, not the change. Re-verify in the authenticated app.

## Phase 3 — "Assigned To" = Alleato employees
- [x] New `useEmployees` hook → `people` where `person_type='employee'` (50 records; the @alleatogroup.com roster). Repointed PO "Assigned To" off the old project-directory + vendor-contacts list.
- [x] `assigned_to` stores `people.id` (no FK, resolved via people lookup on read) → dropdown value matches. Added `selectedLabel={assignedToName}` for edit pre-fill (threaded from GET `assigned_to_name`).
- [x] Left invoice-contacts + private-access-users fields on `contactOptions` (correct — those are external/app-user lists, not internal owner).
- Data note: a few `employee` rows are test/admin accounts ("Test Admin 1", "Friday"); that's data hygiene, not a code issue. Did not filter by email domain (brittle).

## Phase 4 — PO create-form layout overhaul (2026-06-24)
- [x] General Information: Default Retainage + Assigned To share one row (half-width each); Description below; Executed is the last field.
- [x] Bill To / Ship To restored to TWO-COLUMN layout; each column = Company, Contact, Address Line 1, **Address Line 2 (new)**, City, State, Zip.
- [x] Added `bill_to_address_line2` / `ship_to_address_line2` (migration `20260624150000`) + types + schema + POST/PUT/GET + edit read/submit + detail `formatStructuredAddress`.
- [x] Section order: General Info → Bill/Ship → Payment & Shipping → Attachments → Contract Dates → Privacy & Access → Schedule of Values. (License kept as a final section at the very bottom — see decision.)
- [x] New "Payment & Shipping" section (Payment Terms + Ship Via, moved out of General Info).
- [x] Privacy & Access: Invoice Contacts merged in as the first field; Invoice Contacts + Access-for-Non-Admin on one half-width row (Access no longer full width); Private then Allow-SOV checkboxes.
- [x] Removed all FormSection `description` props. Section spacing now uniform via `Form` (space-y-8) + `FormSection` since every top-level block is a FormSection.
- [x] Verified in browser (screenshots): all of the above.

### Decisions flagged to user
- **Kept the Billing/Receiving Contact field** in each Bill/Ship column even though the user's column list omitted it — it was an explicit earlier requirement and the FK columns exist. Easy to remove if unwanted.
- **Kept the License section** at the very bottom (after SOV); it wasn't in the new numbered section list but the user previously asked to move it to the bottom. Easy to remove/relocate.
- Page subtitle under the H1 ("Create a new purchase order commitment") left as-is — it's the PageShell header description, not a section-heading description.

## CAVEATS / FOLLOW-UPS
- `database.types.ts` was hand-patched (added the 12 `purchase_orders` columns + 4 FK relationships) because `npx supabase gen types` returned `Unauthorized` (CLI token expired/invalid format in env). Re-run `npm run db:types` once a valid `sbp_...` token is set, to normalize ordering/relationships. `db:types:check` may flag drift until then.
- OPTIONAL debt: collapse the PO-form inline create-budget-code modal + subcontract `CreateBudgetCodeModal` onto the shared `BudgetCodeCreateDialog`.
- Ship To "person" currently lists all people at the company (not filtered to person_type='employee'); acceptable per "anyone listed at that company".
