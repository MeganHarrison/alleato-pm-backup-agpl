# Budget Tool — Form Discovery

Tool: **budget**
Project under test: **67** (`/67/budget`)
Discovered: 2026-06-13

Budget is dense. It has a main page (`/67/budget`) hosting the table plus ~15 modals/sidebars,
two standalone form pages (`/67/budget/line-item/new`, `/67/budget/setup`), tab panels
(settings, cost-codes, forecasting, snapshots, change-history), and several near-duplicate
"create budget code" flows. Every modal that mutates is treated as a form below. The many
read-only "column detail" modals (BudgetModificationsModal, ApprovedCOsModal,
JobToDateCostDetailModal, DirectCostsModal, PendingBudgetChangesModal, CommittedCostsModal,
PendingCostChangesModal) are listed once at the bottom as **non-mutating** — they only open
a `budgetLineId`-scoped read view.

---

## Form: create_line_items_inline 🚩

- **Title:** Add Budget Line Items (primary "Create" flow)
- **URL Path:** `/67/budget`
- **Component:** `BudgetLineItemCreatorModal.tsx` → `onCreate` = `handleInlineCreateMultipleLineItems` in `page.tsx`
- **How to Open:** Click the **Create** button in `BudgetPageHeader`. (Blocked with a toast if budget is locked.)
- **Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Budget Code | Popover + Command search | Yes | Per row. Source = `/api/projects/{id}/budget-codes`. Sets `budgetCodeId`, `costCodeId`, `costTypeId`. |
| Qty | NumberInput (int) | Yes (≥1 unless locked) | Disabled when `requireZeroAmount` |
| UOM | Select (EA/HR/SF/LF/LS/CY/TON/DAY) | No | "Copy UOM to new rows" checkbox copies to next row |
| Unit Cost | MoneyField | Yes (≠0 unless locked) | Disabled when `requireZeroAmount` |
| Amount | Computed (qty × unitCost) | — | Read-only display; negative shows warning |
| Multi-row | Add Line Item button | — | Each row deduped against codes selected in other rows |

- **Submit Action:** `POST /api/projects/{id}/budget` with `{ lineItems: [{ costCodeId, costType, qty, uom, unitCost, amount }] }`.
- **Success Criteria:**
  - [ ] Toast: "Successfully created N budget line item(s)"
  - [ ] Modal closes
  - [ ] New rows appear in the budget table after `handleLineItemSuccess` refetch
  - [ ] Grand totals recompute
  - [ ] Rows persist after page reload
- **Cleanup:** Delete created line items (only deletable if `originalBudgetAmount === 0` per server rule — see delete form). Otherwise must zero via modification. **Cleanup is non-trivial — prefer creating $0 lines for test, then delete.**
- **Risk Notes:**
  - 🚩 **FK-mapping hot path.** Form dropdown sends `costCodeId` (= `code` string) + `costTypeId`. Server (`route.ts`) re-resolves against `cost_codes`/`cost_code_types` and writes to `budget_lines.cost_code_id`/`cost_type_id`. If `costTypeId` is null the server 400s with "cost_type_id is required". Verify a code with a real cost type is picked.
  - "Create New Budget Code" sub-modal nested inside (see `create_budget_code_inline`).
  - `requireZeroAmount` (post-contract-execution lock) silently forces $0 — confirm warning banner shows when prime contract executed.

---

## Form: create_budget_code_inline 🚩

- **Title:** Create New Budget Code (nested inside the line-item creator modal)
- **URL Path:** `/67/budget`
- **Component:** `BudgetLineItemCreatorModal.tsx` second `BaseModal` → `handleCreateBudgetCode`
- **How to Open:** Open Create modal → open a row's Budget Code popover → "Create New Budget Code".
- **Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Cost Code | Division-grouped expandable list | Yes | Source = `cost_codes` table direct via supabase client |
| Cost Type | Select (L/M/S/X/E) | Yes | |

- **Submit Action:** `POST /api/projects/{id}/budget-codes` `{ cost_code_id, cost_type_id, description }`.
- **Success Criteria:**
  - [ ] Toast: "Budget code created successfully"
  - [ ] New code auto-populates the pending row's Budget Code field
  - [ ] Code appears in the budget-code dropdown for other rows
- **Cleanup:** Created budget code persists in `project_budget_codes`. Manual DB cleanup if needed.
- **Risk Notes:**
  - 🚩 **409 duplicate handling**: on `ApiError 409` it shows "already exists … select it from the dropdown" and closes. Verify this path doesn't leave a half-set row.
  - Cost-type values here are **single letters** (L/M/S/X/E), not UUIDs — server resolves.

---

## Form: create_budget_modification 🚩

- **Title:** Add Budget Modification (budget transfers)
- **URL Path:** `/67/budget`
- **Component:** `budget-modification-modal.tsx` → `handleSubmit`
- **How to Open:** `BudgetPageHeader` → **Modification** action (`onModificationClick`).
- **Fields (per transfer row):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| From | Select (budget line items) | Yes | Source = `/api/projects/{id}/budget` lineItems |
| To | Select (budget line items) | Yes | Must differ from From |
| Amount | number (>0) | Yes | |
| Notes | text | No | |
| Multi-row | "Add Additional Modifications" | — | |

- **Submit Action:** `POST /api/projects/{id}/budget/modifications` `{ title, reason, transferLines: [...] }`.
- **Success Criteria:**
  - [ ] Toast: "Budget modification {number} created as draft."
  - [ ] Modal closes, budget data refetches
  - [ ] Modification reflected in budget modifications column / totals
- **Cleanup:** Created modification is a draft record (`budget_modifications`). Delete via DB or modification workflow.
- **Risk Notes:**
  - 🚩 Validation requires From ≠ To and amount > 0; an all-same-row submit must show the "Complete each modification row" toast, not silently succeed.
  - Created as **draft** — verify it doesn't immediately alter revised budget unless approved.

---

## Form: edit_original_budget 🚩

- **Title:** Original Budget Amount (per-line edit sidebar)
- **URL Path:** `/67/budget`
- **Component:** `original-budget-edit-modal.tsx` → `onSave` = `handleEditSave` in `page.tsx`
- **How to Open:** Budget table row → edit action → opens sidebar (blocked with toast if locked).
- **Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Calculation Method | Radio (Manual / Calculated) | — | Manual = enter Original Budget directly; Calculated = Qty × Unit Cost |
| Unit Qty | number | — | Disabled in Manual mode |
| UOM | Select | — | Disabled in Manual mode |
| Unit Cost | MoneyField | — | Disabled in Manual mode |
| Original Budget | MoneyField | — | Disabled in Calculated mode |
| History tab | read-only | — | `GET /budget/lines/{lineId}/history` |

- **Submit Action:** `updateBudgetLineItem(projectId, lineId, {quantity, unitCost, originalAmount})` → `PATCH /api/projects/{id}/budget/lines/{lineId}` (via `lib/budget/update-budget-line-item.ts`).
- **Success Criteria:**
  - [ ] Toast: "Line item updated successfully"
  - [ ] Sidebar closes
  - [ ] New original budget shows in table row + grand totals recompute
  - [ ] Value persists after reload
  - [ ] History tab shows the change entry
- **Cleanup:** Revert value via the same form, or restore from snapshot.
- **Risk Notes:**
  - 🚩 **Aggregated/parent rows are read-only** — Save button hidden when `children.length > 0`. Verify editing a parent row is blocked with the "Aggregated Budget Line" banner.
  - 🚩 `handleSave` in the modal swallows errors (`catch` logs only) and relies on `onSave` callback (`handleEditSave`) for the toast. If `onSave` rethrows it re-surfaces — verify a forced 409/400 shows "Failed to update budget" with the real reason via `formatBudgetUpdateError`.
  - `hasChanges` gating — Save disabled until a value actually changes.

---

## Form: forecast_to_complete 🚩

- **Title:** Forecast To Complete (per-line forecast sidebar)
- **URL Path:** `/67/budget`
- **Component:** `modals/ForecastToCompleteModal.tsx` → `onSave` = `handleForecastSave` in `page.tsx`
- **How to Open:** Budget table → click a line's Forecast-to-Complete cell (`onForecastToCompleteClick`).
- **Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Forecast Method | Radio: Automatic / Lump Sum / Manual / Monitored Resources | Yes | Drives which editor shows |
| Forecast Amount | MoneyField | Lump Sum only | |
| Line items (Manual) | Description / Qty / Units / Unit Cost rows | Manual mode | Add/remove rows |
| Line items (Monitored) | Description / Start / End / Weeks-Months / % util / Unit Cost | Monitored mode | computes units remaining |
| Notes | Textarea | No | |

- **Submit Action:** `POST /api/projects/{id}/budget/forecast` `{ budgetLineId, forecastMethod, forecastAmount, notes, lineItems[] }`.
- **Success Criteria:**
  - [ ] Toast: "Forecast saved successfully"
  - [ ] Sidebar closes, budget data refetches
  - [ ] FTC / Est Cost at Completion / Projected Over-Under recompute in the table
  - [ ] Reopening the line loads the saved method + rows (`GET /budget/forecast?budgetLineId=`)
- **Cleanup:** Set method back to Automatic and save, or restore snapshot.
- **Risk Notes:**
  - 🚩 **`hasChanges` signature gating** — Save disabled until state differs from loaded signature. Verify Manual/Monitored row edits actually flip Save to enabled.
  - 🚩 Uses native `window.confirm` for unsaved-changes-on-close — browser automation must handle that dialog.
  - 🚩 Save handler (`handleSave` in modal) has no try/catch toast of its own — relies on `handleForecastSave` which DOES toast on error. Verify a forced failure surfaces "Failed to save forecast".

---

## Form: create_budget_view

- **Title:** Create Budget View (column configuration)
- **URL Path:** `/67/budget`
- **Component:** `BudgetViewsModal.tsx` (mode="create") → `handleSubmit`
- **How to Open:** `BudgetPageHeader` → "Configure Budget Views" (`onConfigureBudgetViews`).
- **Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| View Name | Input | Yes | |
| Description | Textarea | No | |
| Set as default | Checkbox | No | |
| Columns | add/remove/reorder/visibility toggle list | ≥1 | Locked columns can't be removed/hidden |

- **Submit Action:** `POST /api/projects/{id}/budget/views`.
- **Success Criteria:**
  - [ ] Toast: "View created successfully"
  - [ ] `fetchBudgetViews` refetch; new view selectable in `BudgetFilters` view switcher
  - [ ] Column set applied when view selected
- **Cleanup:** Delete view via `BudgetViewsManager` (DELETE `/budget/views/{viewId}`).
- **Risk Notes:**
  - Validates name + ≥1 column. `view?.is_system` disables editing — only relevant in edit mode.
  - 🚩 Generic `toast.error("Failed to save view")` swallows the server reason (CLAUDE.md Rule 2 violation candidate).

---

## Form: edit_budget_view / clone_view / delete_view / set_default_view

- **Title:** Budget View management (edit, clone, delete, set-default)
- **URL Path:** `/67/budget` (manager rendered where `BudgetViewsManager` is mounted)
- **Component:** `BudgetViewsManager.tsx` + `BudgetViewsModal.tsx` (mode="edit")
- **How to Open:** Views manager row actions (Edit / Clone / Delete / Set Default).
- **Submit Actions:**
  - Edit → `PATCH /api/projects/{id}/budget/views/{viewId}`
  - Clone → `POST /api/projects/{id}/budget/views/{viewId}/clone`
  - Delete → `DELETE /api/projects/{id}/budget/views/{viewId}` (confirm dialog `viewToDelete`)
  - Set default → `PATCH /api/projects/{id}/budget/views/{viewId}` `{ is_default: true }`
- **Success Criteria:**
  - [ ] Edit: "View updated successfully" + columns change applies
  - [ ] Clone: "View cloned successfully" + new copy appears
  - [ ] Delete: "View deleted successfully" + view gone, confirm dialog gates it
  - [ ] Default: "Default view updated" + new default persists on reload
- **Cleanup:** Delete cloned/created test views.
- **Risk Notes:**
  - 🚩 System views must be blocked for edit/delete ("Cannot edit/delete system views" toast).
  - Generic `toast.error("Failed to …")` on clone/delete/default — no server reason surfaced.

---

## Form: import_budget_file 🚩

- **Title:** Import Budget (Excel/CSV upload)
- **URL Path:** `/67/budget`
- **Component:** `ImportBudgetModal.tsx` → `handleImport`
- **How to Open:** `BudgetPageHeader` → Import (`onImport`). Blocked with toast if locked.
- **Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| File | drag-drop / file picker | Yes | `.xlsx` or `.csv`, ≤10MB; client validates type+size |
| (Download template button) | — | — | Pulls `/alleato-budget-template.xlsx` |

- **Submit Action:** `POST /api/projects/{id}/budget/import` (multipart `FormData`, field `file`).
- **Success Criteria:**
  - [ ] Toast: "Budget imported successfully! N line item(s) added."
  - [ ] Modal closes, budget refetches with imported rows
  - [ ] Warnings/errors/skipped rows surfaced in the result panel if present
- **Cleanup:** Delete imported lines (subject to original-budget delete rule). Snapshot-first is advised by the modal's own warning.
- **Risk Notes:**
  - 🚩 Needs a valid template-shaped fixture file to actually exercise; without it the import 400s.
  - File-type validation is client-side only — server should re-validate.

---

## Form: import_from_contract_sov 🚩

- **Title:** Import from Prime Contract SOV
- **URL Path:** `/67/budget`
- **Component:** `ImportFromContractModal.tsx` → `handleImport`
- **How to Open:** `BudgetPageHeader` → Import from Contract (`onImportFromContract`). Locked-blocked.
- **Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Prime Contract | Select | Yes | Source = `/api/projects/{id}/contracts`. Drives SOV preview. |
| (SOV preview) | read-only table | — | `/contracts/{contractId}/line-items` |

- **Submit Action:** `POST /api/projects/{id}/budget/import-from-contract` `{ contractId }`.
- **Success Criteria:**
  - [ ] Toast: result.message (imported count)
  - [ ] Warning toast if line items skipped (no cost code mapping)
  - [ ] Modal closes, budget refetches
- **Cleanup:** Delete imported lines.
- **Risk Notes:**
  - 🚩 Requires project 67 to have a prime contract WITH SOV line items that have budget-code/markup mappings; otherwise import returns all-skipped. Pick a contract with mapped SOV lines, or expect "no SOV line items" empty state.
  - Submit disabled when preview is empty.

---

## Form: lock_budget

- **Title:** Lock Budget (no dialog — direct action)
- **URL Path:** `/67/budget`
- **Component:** `page.tsx` `handleLockBudget`
- **How to Open:** `BudgetPageHeader` → Lock Budget.
- **Submit Action:** `POST /api/projects/{id}/budget/lock`.
- **Success Criteria:**
  - [ ] Toast: "Budget locked successfully"
  - [ ] Header shows locked state + lockedAt/lockedBy
  - [ ] Create/Edit/Delete/Import now blocked with "Budget is locked" toasts
  - [ ] Lock persists on reload
- **Cleanup:** Run `unlock_budget` afterward.
- **Risk Notes:** Pairs with unlock. Locking changes the entire page's mutation gating — run unlock to restore.

---

## Form: unlock_budget 🚩

- **Title:** Unlock Budget (dialog with preserve/discard option)
- **URL Path:** `/67/budget`
- **Component:** `unlock-budget-dialog.tsx` → `handleUnlock(preserveLineItems)`
- **How to Open:** `BudgetPageHeader` → Unlock Budget (only when locked).
- **Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Preserve vs discard zero-budget lines | Two-button choice (`UnlockOptions`) | Yes | `preserveLineItems` boolean |

- **Submit Action:** `DELETE /api/projects/{id}/budget/lock` (with `preserveLineItems` flag).
- **Success Criteria:**
  - [ ] Toast: "Budget unlocked successfully" (+ deletedCount when discarding)
  - [ ] `onUnlockSuccess` refetches budget; mutations re-enabled
  - [ ] Lock state cleared on reload
- **Cleanup:** None (restores normal state).
- **Risk Notes:**
  - 🚩 On unlock-blocked (active modifications) it shows "Unlock blocked" with the server reason on `ApiError` — verify that path.
  - 🚩 "Discard" path deletes zero-budget lines — destructive. Use "Preserve" in routine testing.

---

## Form: create_snapshot

- **Title:** Create Snapshot (direct action + on snapshots tab)
- **URL Path:** `/67/budget` (header) and `/67/budget?tab=snapshots`
- **Component:** `page.tsx` `handleCreateSnapshot`; also `snapshots-tab.tsx`
- **How to Open:** `BudgetPageHeader` → Create Snapshot, OR Snapshots tab create button.
- **Submit Action:** `POST /api/projects/{id}/budget/snapshots` `{ name, description }`.
- **Success Criteria:**
  - [ ] Toast: "Snapshot created successfully"
  - [ ] Redirects/refreshes Snapshots tab; new snapshot row appears
  - [ ] Snapshot persists on reload
- **Cleanup:** Snapshots accumulate; delete via DB if the tab has no delete UI.
- **Risk Notes:** Error path surfaces real reason (good). Snapshot name is auto-generated by date — repeated runs create dupes.

---

## Form: budget_settings 🚩

- **Title:** Budget Settings (toggles)
- **URL Path:** `/67/budget?tab=settings`
- **Component:** `budget-settings-panel.tsx` → `handleSave`
- **How to Open:** Budget tabs → Settings.
- **Fields (all `Switch`):**

| Field | Type | Notes |
|-------|------|-------|
| Show negative values in red | Switch | `redNegativeValues` |
| Auto-calculate Forecast To Complete | Switch | `autocalculateForecastToComplete` |
| Enable advanced forecasting | Switch | `enableAdvancedForecasting` |
| Allow modifying grand total | Switch | `allowModifyingGrandTotal` |

- **Submit Action:** `PUT /api/projects/{id}/budget/settings`.
- **Success Criteria:**
  - [ ] Toast: "Budget settings saved"
  - [ ] Save disabled unless `isDirty`
  - [ ] Toggle states persist after reload
- **Cleanup:** Toggle back to defaults.
- **Risk Notes:** 🚩 `isDirty` gating — verify each toggle flips Save to enabled and the value round-trips on reload.

---

## Form: cost_codes_tab_save 🚩

- **Title:** Cost Codes (bulk select cost codes + optionally seed budget lines)
- **URL Path:** `/67/budget?tab=cost-codes`
- **Component:** `cost-codes-tab.tsx` → `handleSave`
- **How to Open:** Budget tabs → Cost Codes.
- **Fields:**

| Field | Type | Notes |
|-------|------|-------|
| Cost-code × cost-type selection matrix | checkbox grid | Toggled set vs saved set |
| Amount per selected code | inline number cell | Optional; >0 creates a budget line |
| Bulk sync | mutation | `bulkSync.mutateAsync({ costTypeId, costCodeIds })` per changed type |

- **Submit Action:** per-cost-type `bulkSync` mutation, then `POST /api/projects/{id}/budget` for any cells with `amount > 0`.
- **Success Criteria:**
  - [ ] Toast: "Cost codes saved" / "… N budget lines created"
  - [ ] `onSave` callback triggers budget tab refetch
  - [ ] Selections + created lines persist on reload
- **Cleanup:** Deselect codes + delete any created budget lines.
- **Risk Notes:**
  - 🚩 **Inline-cell persistence** — amount cells only persist if the code is also selected AND amount>0 AND changed vs saved. Verify entering an amount on an unselected row does NOT silently drop it.
  - 🚩 Two-phase save (bulkSync then budget POST) — a partial failure mid-loop could leave inconsistent state; verify error toast shows real reason.

---

## Form: forecasting_tab_recalc / save 🚩

- **Title:** Forecasting tab (recalc + per-line forecast save)
- **URL Path:** `/67/budget?tab=forecasting`
- **Component:** `forecasting-tab.tsx` → `handleForecastSave` (reuses `ForecastToCompleteModal`)
- **How to Open:** Budget tabs → Forecasting; open a line's forecast editor.
- **Submit Action:** `POST /api/projects/{id}/budget/forecast` (same endpoint as `forecast_to_complete`).
- **Success Criteria:**
  - [ ] Recalc: "Forecast updated" toast; numbers refresh
  - [ ] Save: "Forecast saved" toast; values persist
- **Cleanup:** Same as `forecast_to_complete`.
- **Risk Notes:** 🚩 Duplicate forecast-save surface — same backend as the table-cell forecast modal; test both entry points OR confirm shared component is identical and test once.

---

## Form: standalone_create_line_items_page 🚩

- **Title:** Create Budget Line Items (standalone page)
- **URL Path:** `/67/budget/line-item/new`
- **Component:** `line-item/new/page.tsx` → `handleSubmit`
- **How to Open:** Navigate directly (route exists; not obviously linked from main page — verify entry point).
- **Fields:** Multi-row table: Budget Code (required), Qty, UOM, Unit Cost, Amount (required, non-zero). Plus a nested **Create Budget Code** `Modal` (`handleCreateBudgetCode`).
- **Submit Action:** `POST /api/projects/{id}/budget` `{ lineItems: [...] }` → redirects to `/67/budget`.
- **Success Criteria:**
  - [ ] On success redirects to budget page; new lines visible there
  - [ ] Validation: rows missing budget code or with zero amount blocked via `alert()`
- **Cleanup:** Delete created lines.
- **Risk Notes:**
  - 🚩 Uses raw `alert()` for validation (not toast) — automation must handle native alert dialogs.
  - 🚩 **Near-duplicate** of the inline creator modal AND the setup page — three create paths writing the same endpoint. Test all three or flag the duplication.
  - 🚩 Nested create-budget-code modal here cost-type values L/M/S/X/E.

---

## Form: standalone_setup_page 🚩

- **Title:** Add Budget Line Items (setup page)
- **URL Path:** `/67/budget/setup`
- **Component:** `setup/page.tsx` → `handleSubmit`; uses `BudgetLineItemTable` + `CreateBudgetCodeModal` (setup variant)
- **How to Open:** Navigate to `/67/budget/setup` (verify entry point).
- **Fields:** Multi-row: Budget Code (from `project_budget_codes` joined to `cost_codes`/`cost_code_types`), Qty, UOM, Unit Cost, Amount. Nested **CreateBudgetCodeModal**.
- **Submit Action:** `POST /api/projects/{id}/budget` `{ lineItems: [...] }` → redirect to `/67/budget`.
- **Success Criteria:**
  - [ ] Toast: "Successfully created N budget line(s)"
  - [ ] Redirect to budget page; lines visible
  - [ ] Validation: missing budget code → toast; missing cost type → toast
- **Cleanup:** Delete created lines.
- **Risk Notes:**
  - 🚩 **Generic catch** `toast.error("Failed to create budget lines")` swallows server reason (Rule 2 candidate).
  - 🚩 Reads from `project_budget_codes` (different source than the inline modal which uses `/budget-codes`) — same data, different access path; confirm both resolve to the same `cost_type_id`.

---

## Form: setup_create_budget_code

- **Title:** Create New Budget Code (setup-page variant)
- **URL Path:** `/67/budget/setup`
- **Component:** `setup/components/CreateBudgetCodeModal.tsx` → `handleSubmit`
- **How to Open:** Setup page → row's "create new" → opens modal.
- **Fields:** Cost Code (DivisionTree, active codes only), Cost Type (`COST_TYPES`).
- **Submit Action:** 🚩 **raw `fetch()`** `POST /api/projects/{id}/budget-codes` — NOT `apiFetch`. (Potential ESLint `require-api-client` debt; flag.)
- **Success Criteria:**
  - [ ] Modal closes, `onSuccess(budgetCodeId)` auto-populates the pending row
  - [ ] Toast (from parent): "Budget code created successfully"
- **Cleanup:** Created code persists.
- **Risk Notes:** 🚩 Uses raw `fetch` instead of `apiFetch` — inconsistent error handling vs the other two create-code modals.

---

## Form: delete_line_item (per-row + bulk) 🚩

- **Title:** Delete Budget Line Item(s)
- **URL Path:** `/67/budget`
- **Component:** `page.tsx` `handleDeleteLineItem` (per-row, uses `useConfirm`) and `confirmDeleteSelected` (bulk, AlertDialog)
- **How to Open:** Row action menu → Delete (per-row); select rows → "Delete Selected" (bulk, admin-gated `PermissionGate`).
- **Submit Action:** `DELETE /api/projects/{id}/budget/lines/{lineId}` (one per line).
- **Success Criteria:**
  - [ ] Per-row: confirm dialog → "Line item deleted" → row gone, totals recompute
  - [ ] Bulk: AlertDialog → partial-success aware toast (`summarizeBulkResults`) → rows gone
  - [ ] Deletion persists on reload
- **Cleanup:** N/A (this IS cleanup for create forms).
- **Risk Notes:**
  - 🚩 **Client-side guard**: lines with `originalBudgetAmount !== 0` are blocked client-side ("Cannot delete a line with an original budget"). To delete funded lines you must zero via modification first. Test forms should create $0 lines.
  - 🚩 Server returns 409 with codes `LINE_HAS_BUDGET` / `LINE_HAS_ACTIVE_MODIFICATIONS` / `BUDGET_LOCKED` — verify the real reason surfaces, not a generic toast.
  - Bulk delete is admin-permission gated — ensure test user has `budget` admin.

---

## Non-mutating column-detail modals (read-only — no submit)

These open from budget table cell clicks and only display `budgetLineId`-scoped data. No form
submission; verify they open/close cleanly but they are NOT part of the form gauntlet write tests:

- `BudgetModificationsModal`
- `ApprovedCOsModal`
- `JobToDateCostDetailModal`
- `DirectCostsModal`
- `PendingBudgetChangesModal`
- `CommittedCostsModal`
- `PendingCostChangesModal`
- `change-history-tab.tsx` (read-only history view)
- `budget-line-history-modal.tsx` (read-only history)

---

## Cross-cutting risk summary

1. **Three duplicate "create line items" paths** writing `POST /api/projects/{id}/budget`:
   `BudgetLineItemCreatorModal` (modal), `line-item/new/page.tsx`, `setup/page.tsx`. Plus
   `cost-codes-tab` also POSTs there. All funnel cost-code/cost-type resolution server-side.
2. **FK resolution** is server-owned (form sends `costCodeId` string + `costTypeId`, server
   maps to `budget_lines.cost_code_id` / `cost_type_id`). The classic budget_code_id mismatch
   is handled in `route.ts` — verify a line created via dropdown round-trips on edit.
3. **Lock state** gates nearly every mutation — test lock/unlock early and restore.
4. **Generic error toasts** in: `BudgetViewsModal` ("Failed to save view"), `setup/page.tsx`
   ("Failed to create budget lines"), view clone/delete/default. These swallow server reasons.
5. **Native `alert()` / `window.confirm`** in `line-item/new` and `ForecastToCompleteModal` —
   browser automation must handle them.
6. **Raw `fetch`** in `setup/components/CreateBudgetCodeModal.tsx` (should be `apiFetch`).
