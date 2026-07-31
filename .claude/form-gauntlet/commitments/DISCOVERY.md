# Form Discovery — Commitments Tool

Project context: use project id **67** for all URL paths. Commitments use the `/contracts`-family + `/api/commitments/*` API routes.

Form count: **13** (4 create/edit page forms, 2 PCO create forms, 1 create-budget-code modal, 1 import dialog, 1 email dialog, 2 export dialogs, 2 inline SOV grid editors). Delete flows documented under the list/detail pages.

---

## Form: create_subcontract

- **Title:** New Subcontract
- **URL Path:** `/67/commitments/new?type=subcontract`
- **How to Open:** Direct page. From `/67/commitments`, header "Create" split-button → "Subcontract" (or `?type=subcontract`). Also reached from SubList award flow with prefill query params (`vendor_id`, `title`, `amount`, `description`).
- **Component:** `frontend/src/components/domain/contracts/CreateSubcontractForm.tsx` + `subcontract-form/useSubcontractFormState.ts`
- **Schema:** `frontend/src/lib/schemas/create-subcontract-schema.ts` (`CreateSubcontractSchema`)

### Fields
| Name | Type | Required | Example valid value |
|------|------|----------|---------------------|
| title | text | yes | `Site Concrete Subcontract` |
| contractNumber | text (auto-gen, editable) | yes | `SC-001` |
| status | select (Draft/Out for Bid/Out for Signature/Approved/Complete/Terminated) | yes | `Draft` |
| contractCompanyId | combobox (vendor/company) | yes | a company id from `/api/companies` |
| executed | checkbox | no | `false` |
| accountingMethod | toggle (amount_based/unit_quantity) | no | `amount_based` |
| defaultRetainagePercent | number % | no | `10` |
| description / inclusions / exclusions | rich text (HTML) | no | `Scope per drawings` |
| attachments | file upload (multi, ≤20, ≤50MB) | no | a PDF |
| SOV lines | grid (lineNumber, budgetCode, description, amount, qty, unitCost) | no | desc `Mobilization`, amount `5000` |
| dates (start/estCompletion/actualCompletion/contract/signedContractReceived/issuedOn) | dates | no | `2026-07-01` |
| privacy (isPrivate, nonAdminUserIds, allowNonAdminViewSovItems) | checkbox + multiselect | no | private=true |
| invoiceContactIds | multiselect (depends on vendor) | no | a contact id |

### Submit Action
`POST /api/projects/67/subcontracts` (via `apiFetchRaw`). On success, attachments uploaded via `POST /api/document-picker/upload`, then `router.push('/67/commitments')`.

### Success Criteria
- [ ] No error Alert appears at top of form
- [ ] Redirect to `/67/commitments`
- [ ] New row appears in commitments table with the entered contract number + title
- [ ] Vendor/company name resolves on the row

### Cleanup
Delete the created subcontract via row action ⋯ → Delete (soft delete), then optionally permanent-delete from Recycle Bin tab.

### Risk Notes
Vendor dropdown sources from `/api/companies` and stores into `contract_company_id` (FK→companies) — **consistent, no FK mismatch**. Budget-code FK-vs-display mismatch is **explicitly guarded**: `reconcileSovBudgetCodes` + `synthesizeMissingBudgetCodes` in `useSubcontractFormState.ts` re-hydrate SOV budget-code labels on edit. Submit errors are caught in `handleFormSubmit` and shown in a destructive Alert with details (not swallowed). A "Failed to fetch" HMR-recovery path re-checks by contract number. Dev-only Auto-fill button present.

---

## Form: create_purchase_order

- **Title:** New Purchase Order
- **URL Path:** `/67/commitments/new?type=purchase_order`
- **How to Open:** Direct page; header "Create" → "Purchase Order".
- **Component:** `frontend/src/components/domain/contracts/CreatePurchaseOrderForm.tsx`
- **Schema:** `frontend/src/lib/schemas/create-purchase-order-schema.ts` (`CreatePurchaseOrderSchema`)

### Fields
| Name | Type | Required | Example valid value |
|------|------|----------|---------------------|
| title | text | yes | `Steel PO` |
| contractNumber | text (auto-gen) | yes | `PO-001` |
| status | select | yes | `Draft` |
| contractCompanyId | select (vendor) | yes | id from `/api/projects/67/vendors` |
| executed | checkbox | no | `false` |
| defaultRetainagePercent | number % | no | `5` |
| description | text | no | `Per quote` |
| billTo / shipTo / shipVia / paymentTerms | text | no | `Net 30` |
| assignedTo | select (user) | no | a user id |
| dates (contract/delivery/signedPoReceived/issuedOn) | dates | no | `2026-07-15` |
| privacy + invoiceContactIds | as subcontract | no | — |
| SOV lines | grid | no | desc `Beams`, amount `12000` |

### Submit Action
`POST /api/projects/67/purchase-orders` (via `apiFetchRaw`), then `router.push('/67/commitments')`.

### Success Criteria
- [ ] No top-of-form error Alert
- [ ] Redirect to `/67/commitments`
- [ ] New PO row appears with contract number + title + vendor

### Cleanup
Row action ⋯ → Delete; optionally permanent-delete from Recycle Bin.

### Risk Notes
🚩 **FK-mismatch class — VERIFIED SAFE but fragile.** Vendor dropdown fetches from `/api/projects/67/vendors` (returns `vendor_name`), and stores the returned `id` into `contract_company_id` (FK→**companies**). Inspecting `frontend/src/app/api/projects/[projectId]/vendors/route.ts`: the route returns `id` = a **company id** (either `companies.id` directly for global `is_vendor=true` companies, or `project_vendors.vendor_id` which itself references companies). So the stored value IS a valid companies FK — **no actual mismatch**. This is the classic shape that breaks (dropdown labeled "vendor", FK→companies), so it is flagged for the gauntlet to verify the edit pre-fill explicitly. Mitigation already present: on edit, if the saved company isn't in the project's vendor list, it's unshifted into options using `contractCompanyName` so the dropdown still shows the saved value. **Test the edit pre-fill of the vendor dropdown carefully.** Submit errors surface via `toast.error` + inline `setError`.

---

## Form: edit_subcontract

- **Title:** Edit Subcontract
- **URL Path:** `/67/commitments/<commitmentId>/edit`
- **How to Open:** From commitments table row ⋯ → Edit, or detail page → Edit. Reuses `CreateSubcontractForm` with `mode="edit"`.
- **Component:** `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/edit/page.tsx`

### Fields
Same as create_subcontract; pre-filled from `useCommitmentDetail(commitmentId)`. Status normalized from lowercase API → Title Case. Attachments loaded from `/api/document-picker/linked`. SOV lines mapped from `line_items`.

### Submit Action
`PUT /api/commitments/<commitmentId>` (via `apiFetch`). Guards against NIL_UUID. Invalidates `commitmentKeys.detail` + `lists`, `toast.success("Subcontract updated successfully")`, redirect to detail.

### Success Criteria
- [ ] All dropdowns pre-fill (status, **vendor/company**, SOV budget codes)
- [ ] `toast.success("Subcontract updated successfully")`
- [ ] Redirect to `/67/commitments/<id>`
- [ ] Changed fields persist on reload

### Cleanup
Revert changes or delete the record.

### Risk Notes
🚩 **Edit save drops several fields.** The PUT body for subcontract does NOT send `executed` or `accounting_method`, and SOV lines only send `budget_code` (text), not `budget_code_id`. If the user toggled accounting method or executed in edit, those changes are silently lost. Verify whether DB retains prior values or this is data loss. Budget-code pre-fill on edit is guarded by reconcile/synthesize (see create_subcontract). Status mismatch (lowercase DB vs Title Case schema) is explicitly mapped — verify the status dropdown pre-fills, not "Select...". Errors propagate to the form's destructive Alert.

---

## Form: edit_purchase_order

- **Title:** Edit Purchase Order
- **URL Path:** `/67/commitments/<commitmentId>/edit` (renders PO form when `type === "purchase_order"`)
- **How to Open:** Same edit route; branches on commitment type.
- **Component:** same edit page, `CreatePurchaseOrderForm mode="edit"`.

### Fields
Same as create_purchase_order, pre-filled. `contractCompanyName` passed so the vendor select can show the saved label.

### Submit Action
`PUT /api/commitments/<commitmentId>`. Invalidates queries, `toast.success("Purchase order updated successfully")`, redirect to detail.

### Success Criteria
- [ ] Vendor dropdown pre-fills with saved company (not "Select...")
- [ ] Status pre-fills
- [ ] `toast.success("Purchase order updated successfully")`
- [ ] Redirect to detail; changes persist

### Cleanup
Revert or delete.

### Risk Notes
🚩 **Vendor pre-fill (FK-mismatch shape).** Verify the vendor dropdown shows the saved company on edit — relies on the `contractCompanyName` unshift fallback in `CreatePurchaseOrderForm`. PO edit PUT body does NOT send SOV/line items (only header fields) — SOV edits, if any, are not persisted from this form. Confirm whether SOV is edited elsewhere (ScheduleOfValuesTab) so this is expected, not a bug.

---

## Form: create_commitment_pco_from_change_event

- **Title:** Create Commitment PCO
- **URL Path:** `/67/commitment-pcos/new?changeEventIds=<id>[,<id>]` (optionally `&commitmentId=<id>`)
- **How to Open:** From a Change Event → "Add to Commitment PCO" / "Price Impact". **Direct creation without source change events is intentionally disabled** — the page shows an InfoAlert instead of the form when no `changeEventIds` present.
- **Component:** `frontend/src/app/(main)/[projectId]/commitment-pcos/new/page.tsx`
- **Schema:** inline zod (`commitment_id` uuid, `title` required, `description`, `change_reason`, `schedule_impact` int, `due_date`).

### Fields
| Name | Type | Required | Example valid value |
|------|------|----------|---------------------|
| commitment_id | combobox (commitment) | yes | a commitment uuid from `/api/projects/67/commitment-options` |
| Contract Company | display-only (derived) | n/a | shown from selected commitment |
| title | text | yes | `PCO for CE 12` |
| change_reason | text | no | `Scope Change` |
| schedule_impact | number (days) | no | `5` |
| due_date | date | no | `2026-08-01` |
| description | textarea | no | `Added scope` |

### Submit Action
With source change events: `POST /api/projects/67/change-events/add-to-pco` (`pco_type: "commitment"`, `create_new: {...}`). Else (defensive) `POST /api/projects/67/commitment-pcos`. `toast.success("Commitment PCO created")`, redirect to `/67/commitment-pcos/<pcoId>`.

### Success Criteria
- [ ] `toast.success("Commitment PCO created")`
- [ ] Redirect to the new PCO detail page
- [ ] PCO appears under the selected commitment / commitment-pcos list

### Cleanup
Delete the created PCO from its detail/list (verify delete exists in commitment-pcos).

### Risk Notes
Guarded: blocks submit if selected commitment lacks `commitment_type`, and if not all source change events loaded (`hasMissingSourceChangeEvents`). Errors → `toast.error` with description. Combobox uses `shouldFilter={false}` with manual filter — verify search works.

---

## Form: create_commitment_pco_scoped

- **Title:** New Potential Change Order (commitment-scoped)
- **URL Path:** `/67/commitments/<commitmentId>/pcos/new`
- **How to Open:** From a commitment detail → PCOs tab → "Create PCO" (commitment pre-bound by route param).
- **Component:** `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/pcos/new/page.tsx`
- **Schema:** inline zod (similar to scoped PCO fields).

### Fields
Pre-loads commitment via `/api/commitments/<commitmentId>` and existing PCOs via `/api/projects/67/commitments/<commitmentId>/pcos`. Fields: title (req), description, change_reason, schedule_impact, due_date, line items.

### Submit Action
`POST /api/projects/67/commitments/<commitmentId>/pcos`. `toast.success("Potential change order created")`.

### Success Criteria
- [ ] `toast.success("Potential change order created")`
- [ ] New PCO appears in the commitment's PCO tab
- [ ] Redirect/return to commitment

### Cleanup
Delete created PCO.

### Risk Notes
🚩 **Generic error toast** — catch shows `toast.error("Failed to create PCO")` without surfacing the underlying error message/details (class-3 swallowed error detail). A 500 will only say "Failed to create PCO".

---

## Form: create_budget_code_modal

- **Title:** Create New Budget Code
- **URL Path:** modal within `/67/commitments/new` (and edit) SOV section
- **How to Open:** Inside Subcontract form SOV section → "Create budget code" action.
- **Component:** `frontend/src/components/domain/contracts/subcontract-form/CreateBudgetCodeModal.tsx`

### Fields
| Name | Type | Required | Example valid value |
|------|------|----------|---------------------|
| cost code | select | yes | a project cost code |
| cost type | select | maybe | a cost type |

### Submit Action
`POST` budget-code create endpoint. On success `toast.success("Budget code created and added to form")`, new code injected into `budgetCodes` and the active SOV line.

### Success Criteria
- [ ] `toast.success("Budget code created and added to form")`
- [ ] New budget code appears selectable in SOV budget-code dropdown
- [ ] Modal closes

### Cleanup
Created budget code persists in `project_budget_codes` — may need manual DB cleanup or leave as test data.

### Risk Notes
Validates "Please select a cost code" before submit. This modal is the source side of the budget_code FK pattern (cost_code/cost_type → budget_lines) — relevant to the known budget_code_id mismatch, but here it CREATES the budget code so the SOV stores the resulting code. Verify the newly created code round-trips on edit.

---

## Form: commitments_import_dialog

- **Title:** Import Commitments
- **URL Path:** dialog on `/67/commitments`
- **How to Open:** Commitments list toolbar/header → Import.
- **Component:** `frontend/src/components/commitments/CommitmentsImportDialog.tsx`

### Fields
| Name | Type | Required | Example valid value |
|------|------|----------|---------------------|
| file | file upload (CSV/XLSX) | yes | a commitments import file |

### Submit Action
`POST /api/projects/67/commitments/import` (multipart). `toast.success(data.message)` on success, `toast.error` on empty/failure.

### Success Criteria
- [ ] `toast.success` with import count message
- [ ] Imported commitments appear in the table
- [ ] Dialog closes

### Cleanup
Delete imported rows (bulk select → Delete).

### Risk Notes
Uses `ApiError` for typed error display. Verify zero-import case shows the warning toast rather than a false success.

---

## Form: email_commitment_dialog

- **Title:** Email Commitment
- **URL Path:** dialog on `/67/commitments/<commitmentId>`
- **How to Open:** Detail page → Email action (`handleEmail` opens dialog).
- **Component:** `frontend/src/components/commitments/EmailCommitmentDialog.tsx`

### Fields
| Name | Type | Required | Example valid value |
|------|------|----------|---------------------|
| recipients | tag/multi-add (email + optional contact) | yes (≥1) | `test@example.com` |
| subject | text | yes | `Subcontract SC-001` |
| message | textarea | no | `Please review.` |

### Submit Action
`POST /api/commitments/<commitmentId>/email`. `toast.success("Email sent successfully to N recipients")`.

### Success Criteria
- [ ] Validation: empty recipients → "Please add at least one recipient"; empty subject → "Please enter a subject"
- [ ] `toast.success` with recipient count
- [ ] Dialog closes

### Cleanup
None (sends an email — use a safe test recipient).

### Risk Notes
🚩 **Generic failure toast** — catch shows `toast.error("Failed to send email")` without the server error detail (class-3 swallowed detail). Also: this actually sends email — gauntlet should use a sandbox/test recipient and verify it does not blast a real contact.

---

## Form: export_commitment_dialog

- **Title:** Export Commitment
- **URL Path:** dialog on `/67/commitments/<commitmentId>` (single-record export)
- **How to Open:** Detail page → Export. Note: detail page actually wires `DocumentDeliveryDialog`; `ExportCommitmentDialog` is the standalone component.
- **Component:** `frontend/src/components/commitments/ExportCommitmentDialog.tsx`

### Fields
| Name | Type | Required | Example valid value |
|------|------|----------|---------------------|
| format | select (PDF/CSV/XLSX) | yes | `PDF` |

### Submit Action
`POST` export endpoint, downloads file. `toast.success("Commitment exported successfully as PDF")`.

### Success Criteria
- [ ] File downloads
- [ ] `toast.success` with format

### Cleanup
None.

### Risk Notes
Verify each format actually produces a non-empty file.

---

## Form: export_dialog (list export)

- **Title:** Export Commitments
- **URL Path:** dialog on `/67/commitments`
- **How to Open:** List toolbar export icon.
- **Component:** `frontend/src/components/commitments/ExportDialog.tsx` (uses `apiFetchBlob`)

### Fields
| Name | Type | Required | Example valid value |
|------|------|----------|---------------------|
| format / scope | select | yes | `XLSX` |

### Submit Action
Blob fetch → download.

### Success Criteria
- [ ] File downloads with rows
- [ ] Success toast / dialog closes

### Cleanup
None.

### Risk Notes
Low risk.

---

## Inline editor: schedule_of_values_tab

- **Title:** Schedule of Values (inline grid)
- **URL Path:** `/67/commitments/<commitmentId>` → Schedule of Values tab
- **How to Open:** Detail page tab.
- **Component:** `frontend/src/components/commitments/tabs/ScheduleOfValuesTab.tsx`

### Fields
Editable grid: line_number, budget_code, description, amount, qty/unit (per accounting method).

### Submit Action
Save: `PUT /api/projects/67/commitments/<commitmentId>/sov` (line-items endpoint) → `toast.success("Line items saved successfully")`. Import from budget: `POST .../import` → success toast with count.

### Success Criteria
- [ ] `toast.success` on save
- [ ] Lines persist on tab reload
- [ ] Delete-line blocks invoiced lines: "Cannot delete an invoiced SOV line. Remove the invoice first."

### Cleanup
Reset/remove added lines.

### Risk Notes
Delete guard for invoiced lines present (good). Save error → `toast.error("Unable to save line items.")` generic. Verify budget_code round-trips here too.

---

## Inline editor: subcontractor_sov_tab

- **Title:** Subcontractor SOV (inline grid + submit)
- **URL Path:** `/67/commitments/<commitmentId>` → Subcontractor SOV tab
- **How to Open:** Detail page tab.
- **Component:** `frontend/src/components/commitments/tabs/SubcontractorSovTab.tsx`

### Fields
Allocation grid lines; "Remaining to Allocate" must equal $0 to submit.

### Submit Action
Save: `PUT .../subcontractor-sov`. Submit/action: `POST .../subcontractor-sov` (action). `toast.success("Subcontractor SOV saved.")` / action message.

### Success Criteria
- [ ] Save toast appears
- [ ] Submit blocked unless remaining == $0 ("Remaining to Allocate must equal $0 before submitting.")
- [ ] State persists

### Cleanup
Reset allocations.

### Risk Notes
Submit guard present. Errors → generic `toast.error("Failed to save subcontractor SOV.")` / "Action failed." (class-3 swallowed detail, low severity).

---

## Delete flows (list + detail + recycle bin)

- **List single delete:** `/67/commitments` row ⋯ → Delete → confirm dialog (`deleteDialogOpen`) → `useDeleteCommitment.mutateAsync(id)` (soft delete). Has confirmation. ✅
- **List bulk delete:** toolbar bulk action → loops `DELETE /api/commitments/<id>`, reports `"N deleted, M failed"`. Has per-item error capture. ✅
- **Detail delete:** `handleDelete` → `useConfirm` dialog ("Are you sure you want to delete commitment <number>?") → `DELETE /api/commitments/<commitmentId>` → `toast.success("Commitment deleted successfully")` → redirect to list. ✅ Has confirmation + real DELETE.
- **Recycle bin restore:** `POST /api/commitments/<id>/restore`. ✅
- **Recycle bin permanent delete:** `DELETE /api/commitments/<id>/permanent-delete` (with confirm). ✅
- **Inline status change:** list row → `PATCH /api/commitments/<id>` status. `toast.success("Status updated")`. ✅

### Risk Notes
All delete paths have confirmation dialogs and real DELETE/PATCH calls — **no class-2 (missing confirm / no-op delete) issues found.** Detail delete uses generic `toast.error("Failed to delete commitment")` (no detail). Bulk delete surfaces per-item failure messages (good).

---

## Summary of flagged risks

- 🚩 **edit_purchase_order / create_purchase_order** — FK-mismatch *shape* (vendor dropdown → `contract_company_id` FK→companies). Verified safe at the route level (`/vendors` returns company ids), but the edit pre-fill relies on a `contractCompanyName` unshift fallback — **must verify vendor dropdown pre-fills on edit**.
- 🚩 **edit_subcontract** — PUT save **drops `executed`, `accounting_method`, and SOV `budget_code_id`** — possible silent field loss on edit.
- 🚩 **edit_purchase_order** — PUT save omits SOV/line items (header-only) — confirm SOV is owned by the SOV tab, else data loss.
- 🚩 **create_commitment_pco_scoped / email_commitment_dialog / SOV tabs** — generic `toast.error` without server detail (class-3 swallowed error detail; low severity).
- ✅ All delete flows have confirmation + real DELETE.
- ✅ Subcontract budget_code FK-vs-display mismatch is explicitly guarded (reconcile + synthesize) — verify it still pre-fills correctly on edit.
