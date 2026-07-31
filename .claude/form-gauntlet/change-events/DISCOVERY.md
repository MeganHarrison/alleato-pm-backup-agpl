# Form Gauntlet — Change Events Discovery

Tool: **change-events**
Test project id: **67** (base URL `/67/change-events`)
Discovered: 2026-06-13

Architecture note: Create and Edit are **full pages** (not dialogs). Detail-page secondary
actions (convert, email, add-to-PCO, RFQ, attachments, inline field edit) are dialogs/sheets/inline.
The historical FK-mismatch bug class lives in the **line-item table** (Commitment / Vendor / Budget Code).

---

## Form: change_event_create

- **Title:** Create Change Event
- **URL Path:** `/67/change-events/new`
- **How to Open:** "Create" button in table header (PermissionGate: `change_orders` write), or "Add change event" in empty state. Page: `new/page.tsx` → `ChangeEventForm` (mode="create").
- **Component:** `components/domain/change-events/ChangeEventForm.tsx` + `change-event-form/*` (`GeneralInfoSection`, `LineItemsSection`, `LineItemRow`, `useChangeEventFormData`, `useDropdownData`).
- **Fields (header — GeneralInfoSection):**

| Name | Type | Required | Example |
|------|------|----------|---------|
| title | text | **yes** (≤255) | `CE Gauntlet Test` |
| status | select | yes (default "Open") | `Open` |
| type | select | **yes** | `Design Change` |
| scope | select | no (defaults TBD) | `In Scope` |
| origin | select | no (defaults "Internal") | `Internal` |
| changeReason | select | no | `Client Request` |
| expectingRevenue | toggle | no (default true) | `true` |
| lineItemRevenueSource | select | no | `manual` |
| primeContractId | select | no | (a prime contract) |
| description | textarea | no | `Created by form gauntlet` |
| attachments | file (multi) | no | optional pdf |

- **Fields (line-item table — LineItemRow, repeatable):** Commitment (ContractCombobox), commitment SOV line (Select, only if >1), Budget Code (BudgetCodeSelector), Description (text), Vendor (VendorCombobox + Add Company), Cost Qty (number), Cost Unit Cost (MoneyField), Revenue UOM/Qty/Unit Cost, Non-committed Cost. Cost ROM / Revenue ROM / Total are computed.
- **Submit Action:** client-side `validate()` (title/status/type) → `POST /api/projects/67/change-events` (header) → per-line `POST .../change-events/{id}/line-items` (only non-empty rows, `Promise.allSettled`) → per-file `POST .../attachments` → redirect to detail.
- **Line-item FK routing on write:** `contract` value is `po-<uuid>`/`sub-<uuid>` → sent as `commitmentId`; bare uuid → sent as `contractId` (prime). `budgetCodeId` ← `budgetCode`, `vendorId` ← `vendor`. This correctly handles the documented FK split.
- **Success Criteria:**
  - [ ] Toast `Change event created successfully`
  - [ ] Redirect to `/67/change-events/<newId>`
  - [ ] New CE appears in list (All / Line Items tab if it has line items)
  - [ ] Line item(s) persisted (visible in expanded row + detail)
- **Cleanup:** Delete the created CE (row ⋯ → Delete → recycle bin; optionally hard-purge in recycle bin if a purge action exists).
- **Risk Notes:**
  - 🚩 **Line-item save is partial-tolerant** — uses `Promise.allSettled`; failures surface as `toast.warning(... line item(s) failed: <reasons>)` rather than blocking. Verify a valid row actually persists, not just "no error."
  - Validation only covers title/status/type. Empty line items are silently dropped by the non-empty filter — expected, but confirm a row you intend to keep isn't dropped.
  - `origin` falls back to `"Internal"` when unset/unmapped — confirm chosen origin survives round-trip.

---

## Form: change_event_edit

- **Title:** Edit `<title>`
- **URL Path:** `/67/change-events/<id>/edit` (also reachable via detail ⋯ → Edit, and row ⋯ → Edit which routes to `/67/change-events/<id>?edit=1`).
- **How to Open:** Row actions ⋯ → Edit, OR detail page ⋯ → Edit (line 450 → `/edit`). Note: list row Edit uses `?edit=1` (inline scroll on detail), the dedicated edit form is `<id>/edit`.
- **Component:** same `ChangeEventForm` (mode="edit"), initialData built in `[changeEventId]/edit/page.tsx` from `useChangeEventDetail`.
- **Fields:** same as create, **minus Description** (`showDescription={mode !== "edit"}` hides it in edit). Line items pre-loaded from existing record.
- **Submit Action:** `PATCH .../change-events/<id>` (header) → diff line items: DELETE removed ids, PATCH existing (id in originalLineItemIds), POST new → redirect to detail.
- **Success Criteria:**
  - [ ] Toast `Change event updated` (or `... saved but N line item(s) failed` on partial)
  - [ ] Redirect to detail
  - [ ] Edited values persist on reload
  - [ ] 🚩 **On open, every line-item dropdown pre-fills the saved value (NOT "Select…").** Specifically check:
    - **Commitment** (ContractCombobox) shows the saved `po-/sub-` contract
    - **Vendor** (VendorCombobox) shows the saved vendor
    - **Budget Code** shows the saved code
    - commitment SOV sub-line shows saved `commitmentLineItemId`
- **Cleanup:** Revert edits or delete the test CE.
- **Risk Notes:**
  - 🚩🚩 **PRIMARY HISTORICAL BUG (FK mismatch).** Edit pre-fill mapping (edit/page.tsx L126-143):
    - `vendor: li.vendorId ?? li.vendor?.id ?? li.commitment?.contract_company_id ?? ""` — `vendor_id` FK→`companies` but VendorCombobox is sourced from commitment-derived vendors in `useDropdownData`. **If the saved vendor has no active commitment on the project, it is NOT in the dropdown list and will render blank on Edit.** `handleCommitmentChange` injects the commitment's vendor at runtime, but a standalone vendor (no commitment) relies entirely on `useDropdownData`'s commitment-derived list → can disappear. MUST test: create a line item with a vendor selected, save, reopen Edit, confirm vendor still shows.
    - `budgetCode: li.projectBudgetCodeId ?? ""` — BudgetCodeSelector is sourced from `/budget-codes`. Confirm the saved code id matches an option id (budget_code_id FK→budget_lines vs dropdown→project_cost_codes documented mismatch). Test pre-fill explicitly.
    - `contract: po-/sub- prefix reconstructed from li.commitmentId + commitmentType`. Vendor + budget code **selectors are `disabled` when the row is linked to a commitment** (`isLinkedToCommitment`) — verify the disabled display still shows the right values.
  - Partial line-item failure → `toast.warning`, non-blocking (same as create).

---

## Form: change_event_inline_field_edit (detail page)

- **Title:** Inline field edit on detail General Information panel
- **URL Path:** `/67/change-events/<id>`
- **How to Open:** Click any inline field (Title via InlineText; Status/Type/Scope/Origin/Reason via InlineSelect) on the detail General Info panel.
- **Component:** `ChangeEventGeneralInfoPanel.tsx` (has uncommitted changes per git status).
- **Fields:** title (inline text), status/type/scope/origin/reason (inline selects), expecting revenue.
- **Submit Action:** `save()` → `PATCH .../change-events/<id>` with single-field `updates`. Toast `Saved` on success; on error `toast.error("Change event field was not saved", {description})`.
- **Success Criteria:**
  - [ ] Toast `Saved`
  - [ ] Value persists on reload
  - [ ] Error path shows real server message (good — not generic-swallowed)
- **Cleanup:** Revert field.
- **Risk Notes:** Awaited + real error surfaced. Low risk. Note this is a SECOND edit surface for the same header fields (parallel to the edit page) — keep both consistent.

---

## Form: change_event_delete (single)

- **URL Path:** `/67/change-events` (list) and `/67/change-events/<id>` (detail)
- **How to Open:** Row ⋯ → Delete (list, `useConfirmationDialog`), OR detail ⋯ → Delete (`AlertDialog`).
- **Submit Action:** `DELETE .../change-events/<id>` (soft delete → recycle bin). List: toast `Change event moved to recycle bin` + refetch. Detail: `actions.deleteChangeEvent()` → redirect to list.
- **Success Criteria:**
  - [ ] Confirmation dialog appears (✅ both surfaces confirm)
  - [ ] Toast moved-to-recycle-bin
  - [ ] CE disappears from active tab, appears in Recycle Bin tab
- **Cleanup:** none (this IS cleanup).
- **Risk Notes:** Confirmation present on both paths; real DELETE call present. Low risk.

---

## Form: change_event_restore

- **URL Path:** `/67/change-events?tab=recycle_bin`
- **How to Open:** Recycle Bin tab → row ⋯ → Restore.
- **Submit Action:** `POST .../change-events/<id>/restore` → toast `Change event restored` + refetch.
- **Success Criteria:** [ ] toast, [ ] CE leaves recycle bin, [ ] reappears in active list.
- **Risk Notes:** 🚩 No confirmation dialog (`handleRestore` fires immediately) and uses `.then/.catch` (not awaited). Acceptable for a restore, but errors are caught generically (`toast.error("Failed to restore...")`).

---

## Form: change_event_bulk_delete

- **URL Path:** `/67/change-events`
- **How to Open:** Select rows (checkboxes) → toolbar bulk delete.
- **Submit Action:** `bulkDeleteDialog.confirm` → `Promise.allSettled(DELETE per id)` → `summarizeBulkResults`, partial-aware toasts.
- **Success Criteria:** [ ] confirm dialog, [ ] success toast with count, [ ] selected CEs move to recycle bin, [ ] selection cleared.
- **Risk Notes:** Confirmation present, partial failures reported. Hidden on recycle_bin tab. Low risk.

---

## Form: change_event_send_rfq (sheet)

- **Title:** Send Requests for Quote
- **URL Path:** `/67/change-events` (Sheet) and `/67/change-events/<id>` (Sheet on detail)
- **How to Open:** Row ⋯ → Send RFQs; or selection bar "Send RFQ"; or detail page Send RFQ. Opens `Sheet` → `ChangeEventRfqForm` (react-hook-form).
- **Fields:** title (req), dueDate (req, default +7d), distributionPersonId (select), requestDetails (textarea), includeAttachments (default true), commitmentLines[] (per CE line item: scopeDescription, contractId select, recipients auto-derived).
- **Submit Action:** `POST .../change-events/rfqs` with `{changeEventId, title, dueDate, includeAttachments, notes}` → toast `RFQ <number> sent successfully`, close sheet, clear selection.
- **Success Criteria:** [ ] toast with RFQ number, [ ] sheet closes, [ ] RFQ appears in RFQs tab (count increments).
- **Cleanup:** Delete RFQ if a delete exists (`rfqs/[rfqId]` DELETE route exists).
- **Risk Notes:** 🚩 On list page the sheet only sends for `selectedChangeEvents[0]` (first selected). Generic `toast.error("Failed to send RFQ")` on failure. The form's rich `commitmentLines`/distribution fields are NOT sent in the list-page handler payload (only title/dueDate/notes/includeAttachments) — verify whether that's intended.

---

## Form: change_event_rfq_response

- **URL Path:** RFQ detail/response context (`ChangeEventRfqResponseForm`)
- **How to Open:** From an RFQ → respond.
- **Component:** `ChangeEventRfqResponseForm.tsx` (react-hook-form). Submits via parent `onSubmit` → `POST .../rfqs/[rfqId]/responses` route.
- **Fields:** quote amount / response fields (react-hook-form). Loads existing via `fetch`.
- **Success Criteria:** [ ] response saved, [ ] reflected on RFQ.
- **Risk Notes:** Uses raw `fetch` for load (read). Verify submit path returns and toasts.

---

## Form: change_event_convert_to_pco (dialog)

- **Title:** Add to Potential Change Order
- **URL Path:** `/67/change-events/<id>` (detail)
- **How to Open:** Detail page convert action → `ChangeEventConvertDialog`.
- **Fields:** conversionType radio (commitment_pco | prime_pco), targetContractId (SelectField, required), line items summary (read-only).
- **Submit Action:**
  - prime_pco → redirects to prime PCO new form (no API write here).
  - commitment_pco → `POST .../change-events/add-to-pco` → on success redirect to commitment-pco detail.
- **Success Criteria:** [ ] toast success, [ ] dialog closes, [ ] redirect to PCO, [ ] CE shows linked/converted state.
- **Risk Notes:** 🚩 Uses raw `fetch` (not apiFetch) in `handleConvert` and `console.error`. Generic `toast.error`. Contract list fetched on open from two endpoints; `any` casts. Validates targetContractId before submit (good).

---

## Form: change_event_add_to_commitment_co (dialog)

- **Title:** Add to Commitment PCO
- **URL Path:** `/67/change-events/<id>`
- **How to Open:** Detail ⋯ → Add to Commitment CO → `AddToCommitmentCODialog`.
- **Fields:** commitment select (required), create-new vs link-existing PCO, existing PCO select.
- **Submit Action:** `POST` (create or link) via apiFetch → toast, redirect/refresh. Bulk-draft branch creates drafts across matching commitments (partial-aware `toast.warning`).
- **Success Criteria:** [ ] toast, [ ] CE linked to commitment PCO.
- **Risk Notes:** Validates selection. Partial bulk failures reported. apiFetch used (good).

---

## Form: change_event_add_to_prime_pco (dialog)

- **Title:** Add to Prime Contract PCO
- **URL Path:** `/67/change-events/<id>`
- **How to Open:** Detail → Add to Prime PCO → `AddToPrimePCODialog`.
- **Fields:** prime contract select (required).
- **Submit Action:** validates selection → redirects to Prime PCO new form (navigation, no direct write).
- **Success Criteria:** [ ] toast `Opening Prime Contract PCO form`, [ ] navigates to prime PCO form prefilled with changeEvent.
- **Risk Notes:** Navigation-only; low data risk.

---

## Form: change_event_add_to_budget_change (dialog)

- **Title:** Add to Budget Change
- **URL Path:** `/67/change-events` (selection bar) and `/67/change-events/<id>`
- **How to Open:** Selection bar Price Impact → Add to Budget Change, or detail.
- **Fields:** mode (create new vs link existing), title (req for create), budget change select (req for link).
- **Submit Action:** `POST .../budget-changes` (create) or `POST .../budget-changes` (link) → toast.
- **Success Criteria:** [ ] toast `Budget change created` / `Linked to Budget Change <n>`, [ ] CE linked.
- **Risk Notes:** Validates title/selection before submit. apiFetch. Generic catch toast.

---

## Form: change_event_email (dialog)

- **Title:** Email Change Event
- **URL Path:** `/67/change-events/<id>`
- **How to Open:** Detail ⋯ → Email → `ChangeEventEmailDialog`.
- **Fields:** recipients (comma list, required), subject (required, prefilled), message (optional).
- **Submit Action:** `POST .../change-events/<id>/email` with `{recipients[], subject, message}` → toast `Email sent to ...`, close, reset.
- **Success Criteria:** [ ] toast sent, [ ] dialog closes.
- **Risk Notes:** Validates recipients/subject. apiFetch + awaited. Generic error toast. Low risk (real send — use a safe test recipient).

---

## Form: change_event_add_company (modal)

- **Title:** Add Company to Directory
- **URL Path:** `/67/change-events/new` and `/67/change-events/<id>/edit`
- **How to Open:** Vendor combobox → "Add Company" inside the line-item table.
- **Fields:** companyName (text, required).
- **Submit Action:** `POST .../vendors` `{name}` → toast added/already-linked, close, `onCompanyAdded()` re-fetches vendors so the new vendor is selectable.
- **Success Criteria:** [ ] toast, [ ] modal closes, [ ] new company appears in vendor combobox.
- **Risk Notes:** 🚩 Hand-rolled modal (`fixed inset-0` + raw `<h3>` with eslint-disable) instead of `Modal`/`Dialog` DS component. Enter-to-submit. apiFetch + awaited. New vendor relevance to the FK bug: a company added here is a `companies` row; confirm it then survives Edit pre-fill (ties to the vendor FK-mismatch risk above).

---

## Form: change_event_create_budget_code (modal)

- **Title:** Create Budget Code (shared modal)
- **URL Path:** `/67/change-events/new` and `/edit`
- **How to Open:** Budget Code selector → "Create new" inside line-item table → `CreateBudgetCodeModal` (from budget/setup).
- **Submit Action:** creates budget code → `handleBudgetCodeCreated` re-fetches codes and assigns to the target row.
- **Success Criteria:** [ ] toast `Budget code created successfully`, [ ] code assigned to the row that triggered it.
- **Risk Notes:** Shared component owned by budget tool. Confirm the newly created code id matches what the line-item write path sends as `budgetCodeId` (FK split risk).

---

## Form: change_event_attachment_upload_delete (detail section)

- **URL Path:** `/67/change-events/<id>`
- **How to Open:** Detail Attachments section.
- **Submit Action:** upload `POST .../attachments`; delete via `AlertDialog` → `DELETE .../attachments/<attachmentId>`.
- **Success Criteria:** [ ] upload toast `N file(s) uploaded`, [ ] file appears; [ ] delete confirm dialog → toast `Attachment deleted`, file disappears.
- **Risk Notes:** Delete has AlertDialog confirmation + real DELETE (good). Upload uses `Promise.all`. apiFetch.

---

## Form: change_event_approval_workflow (detail section)

- **URL Path:** `/67/change-events/<id>`
- **How to Open:** Detail approval section.
- **Submit Action:** Submit for approval → `POST .../approvals`; approve/reject → `PUT .../approvals`.
- **Success Criteria:** [ ] toast submitted/approved/rejected, [ ] status reflects.
- **Risk Notes:** 🚩 Uses raw `fetch` (not apiFetch) for all three calls. Generic error toasts. No confirmation on approve/reject. Status transitions are consequential — verify state actually changes.

---

## Summary of high-risk flags

- 🚩🚩 `change_event_edit` — vendor & budget-code dropdown pre-fill (the documented FK-mismatch bug class). PRIMARY test target.
- 🚩 `change_event_create` / `change_event_edit` — line-item saves are `allSettled` + `toast.warning` (non-blocking partial failure). Confirm rows actually persist.
- 🚩 `change_event_send_rfq` — list handler sends only first selected + a reduced payload; generic error toast.
- 🚩 `change_event_convert_to_pco` & `change_event_approval_workflow` — raw `fetch` + generic toasts; approval transitions have no confirm.
- 🚩 `change_event_restore` — no confirmation, non-awaited `.then/.catch`.
- 🚩 `change_event_add_company` — hand-rolled modal (non-DS), but functionally awaited.
