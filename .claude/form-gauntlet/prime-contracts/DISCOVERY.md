# Prime Contracts — Form Discovery

**Re-discovered:** 2026-06-13 (supersedes 2026-03-22 9-form pass)
Tool: **prime-contracts** (uses `/api/projects/[projectId]/contracts/**` routes, NOT `/prime-contracts`).
Test project id: **67**. Detail-page tabbed UI lives at `/67/prime-contracts/<contractId>`.

Discovery covers: list page CRUD dialogs, create/edit contract form (multi-section: SOV + markups + attachments), detail-page dialogs (SOV add/delete line, CO create/edit/delete/reject), inline SOV editing, estimate-import modal, from-estimate modal, advanced settings, financial markup table, payments ERP sync, configure settings, and the PCO sub-feature (list/create/edit/detail/delete/promote/bulk).

Key bug-class flags:
- 🚩 **SOV budget-code FK mismatch** is the dominant risk (dropdown sources `budget-codes`/`project_cost_codes`; line-item FK is `budget_code_id`→budget_lines + `cost_code_id`). Resolution logic exists in `useSovEditing`, `usePrimeContractFormState`, and the estimate-import modal — Edit pre-fill must be verified.
- 🚩 Several PCO + sync flows use generic `toast.error("Failed to …")` that **discard** the real error message (they build an Error with the server message, then ignore it).
- The CO-create dialog status dropdown is hardcoded to a single "pending" option (dead control).
- PCO detail/edit/list pages use raw `fetch` instead of `apiFetch` (outside the guardrail wrapper).

---

## Form: prime_contract_create

**Title:** Create Prime Contract
**URL Path:** `/67/prime-contracts/new`
**How to Open:** List header `Create` split button → "Blank Contract" (or empty-state "Create your first contract").
**Component:** `ContractForm` → `prime-contract-form/usePrimeContractFormState.ts` + `sections.tsx` + `sov.tsx` + `financial-markup-form-section.tsx`. Submit hook `use-create-prime-contract.ts`, mode `create`.

### Fields
| Field | Type | Notes |
|---|---|---|
| Contract # (`number`) | text, required | Auto-prefilled `PC-00N` |
| Title | text, required | |
| Status | select | draft/out_for_signature/approved/complete/terminated. $0-SOV approve blocked client-side |
| Executed | checkbox | |
| Private | checkbox | |
| Owner/Client (`ownerCompanyId`) | combobox (companies) + inline Add Company | auto-copies to `contractCompanyId` |
| Default retainage | number | |
| Accounting method | toggle | amount ↔ unit_quantity |
| SOV line items | repeatable grid | budget code (🚩 FK), description, amount or qty/unitCost/UOM; groups; bulk remove |
| Financial markups | repeatable | insurance/fee %, compound, order, maps_to; auto-map fee→55-0500, insurance→55-0050 |
| Attachments | file upload | |
| Create Budget Code modal | nested | cost-code-backed; appends SOV row |
| Import From Budget modal | nested | |
| Import Estimate Workbook modal | nested | xlsx → SOV rows |

### Submit Action
POST `/api/projects/67/contracts` (+ attachments, markups, line items).

### Success Criteria
- [ ] toast success; redirect to detail (or list)
- [ ] record appears with correct #/title/status
- [ ] SOV lines + markups + attachments persisted
- [ ] re-open Edit → SOV budget-code dropdowns pre-fill (FK guard)

### Cleanup
Delete created contract (+ SOV/COs) via list row action.

### Risk Notes
🚩 SOV budget-code FK; `$0-approve` early-return guard; company create + markup auto-map side effects.

---

## Form: prime_contract_edit

**Title:** Edit Prime Contract (`ContractForm`, mode `edit`)
**URL Path:** `/67/prime-contracts/<contractId>?edit=1` (the `/edit` route redirects here; list/detail Edit both append `?edit=1`)
**How to Open:** List row ⋯ → Edit; detail Edit button.
**Fields:** Same as create; hydrated from contract; markups from saved project markups.
**Submit Action:** PUT/PATCH `/api/projects/67/contracts/<contractId>` (+ line-item diff + markups + attachments).

### Success Criteria
- [ ] toast success + return to detail
- [ ] company, SOV budget codes, markup maps_to all pre-fill
- [ ] edits persist on reload

### Risk Notes
🚩 **Primary FK-mismatch verification target** — confirm SOV budget-code selects show saved values, not "Select…".

---

## Form: prime_contract_delete

**Title:** Delete Contract (AlertDialog)
**URL Path:** `/67/prime-contracts`
**How to Open:** List row ⋯ → Delete.
**Submit Action:** DELETE `/api/projects/67/contracts/<id>`; invalidates query.

### Success Criteria
- [ ] confirm dialog; toast with title; row disappears; contracts-with-children surface backend error in toast.

### Risk Notes
Confirm + DELETE + real error message ✅.

---

## Form: prime_contract_bulk_delete

**Title:** Delete N Contracts (AlertDialog)
**URL Path:** `/67/prime-contracts`
**How to Open:** Select rows → toolbar bulk-delete.
**Submit Action:** parallel DELETE (`Promise.allSettled`); partial-failure toast names failed ids.

### Success Criteria
- [ ] confirm with count; success/partial toast; selection cleared; refetch.

### Risk Notes
Good per-id error surfacing ✅.

---

## Form: prime_contract_from_estimate

**Title:** Create Prime Contract From Estimate (Modal)
**URL Path:** `/67/prime-contracts`
**Component:** `CreatePrimeContractFromEstimateModal.tsx`
**How to Open:** List `Create` split button → "From Estimate…".
**Fields:** Estimate select (approved estimates).
**Submit Action:** POST `/api/projects/67/contracts/from-estimate` `{ estimate_id }`.

### Success Criteria
- [ ] toast success with new contract number; new contract appears built from estimate SOV.

### Risk Notes
🚩 Generic `toast.error("Failed to create contract", {description})` — confirm description carries real error.

---

## Form: sov_add_line_item

**Title:** Add Schedule of Values Line (Modal)
**URL Path:** `/67/prime-contracts/<contractId>` (SOV tab)
**Component:** `[contractId]/components/PrimeContractDialogs.tsx`
**How to Open:** SOV tab → Add SOV Line.

### Fields
| Field | Type | Notes |
|---|---|---|
| Budget Code | `BudgetCodeSelector` (🚩 FK) | + create new → CreateBudgetCodeModal |
| Line Number | number, required | |
| Description | textarea, required | |
| Quantity | number | |
| Unit Cost | number | |
| Unit of Measure | text | |
| Total Cost | computed | qty × unitCost |

**Submit Action:** POST `/api/projects/67/contracts/<contractId>/line-items`.

### Success Criteria
- [ ] new SOV row appears with correct budget code/qty/unit cost/total
- [ ] budget code persists & re-displays after reload
- [ ] "Adding…" state.

### Cleanup
Delete the added line item.

### Risk Notes
🚩 Budget-code FK mismatch.

---

## Form: sov_inline_edit

**Title:** Inline SOV editing (in-table edit mode + Save/Cancel)
**URL Path:** `/67/prime-contracts/<contractId>` (SOV tab)
**Component:** `prime-contract-detail/useSovEditing.ts` + `PrimeContractSovTab.tsx`
**How to Open:** SOV tab → Edit / Add Line / drag-reorder enters edit mode.

### Fields (per row)
budget code (🚩 FK, `handleUpdateSovLineBudgetCode`), description, quantity, unit_of_measure, unit_cost; add line/group; drag reorder; remove.

**Submit Action:** `handleSaveSovEdit` — diff into update/create/delete; PUTs line_numbers to temp range first (unique-constraint dance), then DELETE removed, PUT updates, POST creates, refetch. Routes `…/line-items[/<id>]`.

### Success Criteria
- [ ] edits/reorder/delete/create persist; "Schedule of values updated" toast
- [ ] ≥1 non-group line required (else error)
- [ ] budget codes survive reload (`sovDraftBudgetCodeIds`)
- [ ] reorder persists.

### Risk Notes
🚩 FK mapping via `buildSovDraftBudgetCodeIds`. Multi-step save: mid-sequence failure can leave temp line_numbers applied (partial state) — observe on forced failure.

---

## Form: sov_delete_line_item

**Title:** Delete Line Item (Modal confirm)
**URL Path:** `/67/prime-contracts/<contractId>` (SOV tab)
**Submit Action:** DELETE `/api/projects/67/contracts/<contractId>/line-items/<lineItemId>`. (Also optimistic `handleDeleteSovLine` with rollback-via-refetch.)

### Success Criteria
- [ ] confirm names line # + description; row disappears; "Line item deleted" toast; failure restores row.

### Risk Notes
Confirm + DELETE present ✅; optimistic path uses generic toast but refetches to restore.

---

## Form: sov_estimate_import

**Title:** Import Estimate To SOV (Modal, multi-step)
**URL Path:** `/67/prime-contracts/<contractId>` (SOV tab)
**Component:** `[contractId]/components/PrimeContractEstimateImportModal.tsx`
**How to Open:** SOV tab → Import Estimate.

### Flow
Upload .xlsx/.xlsm → POST `…/line-items/estimate-import/preview` → editable preview grid (select, description, cost-type select, qty, UOM, scheduled value) → Review → Confirm → auto-activate missing budget codes (POST `…/estimate-import/activate-budget-codes`) → POST one `…/line-items` per selected row.

### Success Criteria
- [ ] preview parses; summary counts right
- [ ] missing budget codes auto-created
- [ ] selected rows added (next line numbers); "Added N SOV lines"; rows persist mapped
- [ ] already-in-SOV rows disabled.

### Cleanup
Delete imported lines + auto-created budget codes.

### Risk Notes
🚩 Heaviest FK-resolution surface (`resolveBudgetCodeId`). Inline error + toast (good). Sequential POST loop → partial-success risk.

---

## Form: co_create

**Title:** New Change Order (Modal)
**URL Path:** `/67/prime-contracts/<contractId>` (Change Orders tab)
**Component:** `PrimeContractDialogs.tsx`
**Fields:** CO Number (req), Description (textarea, req), Amount (number, req), **Status select — hardcoded single "pending"**.
**Submit Action:** POST contract change-orders route.

### Success Criteria
- [ ] CO appears with number/amount/status; revised value updates; "Creating…".

### Risk Notes
🚩 Status select offers only "pending" — confirm intentional (dead control / noise).

---

## Form: co_edit

**Title:** Edit Change Order (Modal)
**URL Path:** `/67/prime-contracts/<contractId>` (CO tab)
**Fields:** CO Number, Description, Amount.
**Submit Action:** PUT/PATCH change-orders/<id>.

### Success Criteria
- [ ] dialog pre-fills existing values; save reflects updates; toast.

### Risk Notes
Approval handled via separate approve/reject routes (no status field here).

---

## Form: co_reject

**Title:** Reject Change Order (Modal)
**URL Path:** `/67/prime-contracts/<contractId>` (CO tab)
**Fields:** Rejection Reason (textarea, required — submit disabled until non-empty).
**Submit Action:** POST `…/change-orders/<id>/reject`.

### Success Criteria
- [ ] reason required (button disabled when empty); CO → rejected; toast.

### Risk Notes
Good required-field gating ✅. Approve path also exists (`…/change-orders/<id>/approve`).

---

## Form: co_delete

**Title:** Delete Change Order (Modal confirm)
**URL Path:** `/67/prime-contracts/<contractId>` (CO tab)
**Submit Action:** DELETE change-orders/<id>.

### Success Criteria
- [ ] confirm names CO number; row disappears; toast.

### Risk Notes
Confirm + DELETE present ✅.

---

## Form: prime_contract_advanced_settings

**Title:** Advanced Settings (inline form, Save button)
**URL Path:** `/67/prime-contracts/<contractId>` (Advanced tab)
**Component:** `prime-contract-detail/PrimeContractAdvancedSettingsTab.tsx`
**Fields:** enable financial markups, owner-invoice toggles (some disabled), completed-work/stored-materials retainage, default retainage %, show budget code on PDF, **CO tier count select (locked if COs exist)**, plus contract draft (inclusions, exclusions, is_private, payment_terms, billing_schedule).
**Submit Action:** PUT `…/advanced-settings` `{ project_settings, contract_settings }`.

### Success Criteria
- [ ] "Advanced settings saved" toast; values persist; CO tier locked+tooltip when COs exist; error via `handleFormError`.

### Risk Notes
Uses `handleFormError` (real message) ✅. CO-tier lock is a real guardrail.

---

## Form: prime_contract_financial_markup_table

**Title:** Financial Markup table (Save Changes + per-row add/delete)
**URL Path:** `/67/prime-contracts/<contractId>` (Financial Markup tab)
**Component:** `prime-contract-detail/PrimeContractFinancialMarkupTab.tsx`
**Fields/Actions:** per-row name/type, percentage (0–100), compound, calc order, maps_to budget code, display mode. Add (POST `…/vertical-markup`), Delete (DELETE `…/vertical-markup/<id>`), Save (PUT `…/vertical-markup`). maps_to/display prefs in localStorage.

### Success Criteria
- [ ] add/delete toast + persist; Save validates names + % range (error toast otherwise); maps_to persists/reloads.

### Risk Notes
Validation present ✅. 🚩 maps_to budget-code dropdown — verify reload.

---

## Form: prime_contract_payments_sync

**Title:** Sync with ERP (action button)
**URL Path:** `/67/prime-contracts/<contractId>` (Payments tab)
**Component:** `prime-contract-detail/PrimeContractPaymentsTab.tsx`
**Submit Action:** POST `…/sync-payments` → repopulates payments + contract.

### Success Criteria
- [ ] "Payments synced from Acumatica" toast; table populates; totals update.

### Risk Notes
🚩 Generic error toast swallows Acumatica error. Live-ERP dependent — hard to isolate.

---

## Form: prime_contract_configure_settings

**Title:** Prime Contracts Configure (project-level)
**URL Path:** `/67/prime-contracts/configure`
**Component:** `prime-contracts/configure/page.tsx`
**How to Open:** List header Settings (gear) icon.
**Submit Action:** PUT `/api/projects/67/contracts/settings`.

### Success Criteria
- [ ] "Settings saved" toast; values persist on reload.

### Risk Notes
Project-level — affects all contracts.

---

## Form: pco_create

**Title:** New Prime Contract Change Order / Create Prime Contract PCO
**URL Path:** `/67/prime-contract-pcos/new` (also `?contractId=` / `?changeEventIds=`)
**Component:** `prime-contract-pcos/new/page.tsx` (RHF + zod). Two modes: changeEvent (create PCO) vs PCCO assembly (from existing PCOs).
**How to Open:** From change-event "add to PCO" flow or contract detail. (PCO list "New" button routes to `/change-events/new`, NOT here.)

### Fields
prime_contract_id (req, uuid — contracts dropdown), title (req), status, revision, change_reason, total_amount (auto-summed from selected PCOs), designated_reviewer/reviewed_by (employee comboboxes), review/signed/due/invoiced/paid/revised-completion dates, executed, is_private, field_change, paid_in_full, schedule_impact, request_received_from, location, reference, description, attachments; Potential Change Orders multi-select (PCCO mode).

### Submit Action
- changeEvent mode → POST `…/change-events/add-to-pco` (pco_type prime).
- PCCO mode → POST `…/prime-contract-change-orders`, then PATCH each selected PCO `promoted_to_co_id`, then upload attachments.

### Success Criteria
- [ ] zod: contract + title required; toast success; redirect to detail; PCCO mode requires ≥1 PCO + auto-sum; attachments upload (partial-failure warning).

### Cleanup
Delete created PCO/PCCO.

### Risk Notes
prime_contract_id dropdown sources `/contracts`, stores uuid (no FK mismatch). PCCO mode surfaces real `err.message` ✅; change-event fetch failures toast generically.

---

## Form: pco_edit

**Title:** Edit PCO #N
**URL Path:** `/67/prime-contract-pcos/<pcoId>/edit` (and `…/prime-contracts/<contractId>/change-orders/pcos/<pcoId>/edit`)
**Component:** `prime-contract-pcos/[pcoId]/edit/page.tsx`
**How to Open:** PCO detail Edit (status draft/pending only); list row Edit.
**Fields:** status (select), change_reason (select w/ "None"), title, is_private, description, executed, signed_co_received_date, request_received_from, location, schedule_impact, field_change, reference, paid_in_full.
**Submit Action:** PATCH `/api/projects/67/prime-contract-pcos/<pcoId>` (raw `fetch`).

### Success Criteria
- [ ] form pre-fills (status, change_reason selects show saved value); "Prime Contract PCO updated" toast; redirect; "None"→null.

### Risk Notes
🚩 Raw `fetch` (outside apiFetch guardrail). 🚩 catch builds Error with real message then `toast.error("Failed to save prime contract PCO")` discards it.

---

## Form: pco_delete

**Title:** Delete PCO? (AlertDialog on detail; ConfirmationDialog on list)
**URL Path:** `/67/prime-contract-pcos/<pcoId>` and `/67/prime-contract-pcos`
**Submit Action:** DELETE `/api/projects/67/prime-contract-pcos/<pcoId>` (raw fetch). Draft-only.

### Success Criteria
- [ ] confirm; "PCO deleted" toast; redirect/refetch; row gone.

### Risk Notes
🚩 Generic `toast.error("Failed to delete PCO")` discards real message.

---

## Form: pco_promote

**Title:** Promote to Change Order? / Promote Selected to Single PCCO
**URL Path:** `/67/prime-contract-pcos/<pcoId>` and `/67/prime-contract-pcos`
**Submit Action:** POST `…/prime-contract-pcos/<id>/promote`; bulk → POST `…/prime-contract-pcos/promote-bulk` `{ pco_ids }`. Allowed when pending/approved & not already promoted.

### Success Criteria
- [ ] confirm w/ amount; success toast (server message); PCO marked promoted; PCCO created; refetch.

### Risk Notes
🚩 Generic `toast.error("Failed to promote PCO")` discards real message. Bulk requires same prime contract (server-enforced).

---

## Form: pco_list_bulk_delete

**Title:** Delete PCOs (ConfirmationDialog)
**URL Path:** `/67/prime-contract-pcos`
**Submit Action:** parallel DELETE per id; partial-failure toast.

### Success Criteria
- [ ] confirm; success/partial toasts; selection cleared; refetch.

### Risk Notes
First-failure reason surfaced ✅.

---

## Notes for the verifier

- Datasets: project 1009 (Union Collective) is richest; 67 is standard test. COs/PCOs may be sparse — may need to create one first.
- PCO list "New" button intentionally routes to **change-events/new** (PCOs originate from change events). Reach `pco_create` via a change-event "add to PCO" or directly at `/67/prime-contract-pcos/new`.
- **FK-mismatch verification is mandatory** (FORM-FK-VALIDATION-GATE): for every SOV/budget-code dropdown (create, edit, sov_add_line_item, sov_inline_edit, estimate import, markup maps_to) → create, navigate away, Edit, confirm dropdown shows saved value not "Select…".
- Raw-`fetch` forms (outside apiFetch wrapper): all PCO detail/edit/list pages.
