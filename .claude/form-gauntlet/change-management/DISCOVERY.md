# Form Discovery — Change Management Tool (PCOs / Change Orders)

Project ID used for URLs: **67**

The "Change Management" tool is a workflow umbrella: **Change Events** (identify) → **PCOs** (price) → **Change Orders** (modify contract). This discovery covers the PCO and Change Order surfaces. Change Events have their own tool/forms (`change-events/`) and are out of scope except where conversion/promotion crosses the boundary.

The surface splits into four families:
- **Project PCOs** (`/pcos`) — generic PCO grouping change events + line items, converts to CO.
- **Commitment PCOs** (`/commitment-pcos`) — PCO against a subcontract/PO, promotes to CCO.
- **Prime Contract PCOs** (`/prime-contract-pcos`) — PCO against a prime contract, promotes to PCCO.
- **Change Orders** (`/change-orders`) — read/list of executed Prime + Commitment COs, plus full edit detail pages.

`/change-management` itself is a dashboard (no form). `/change-orders/new` and legacy `/change-orders/...new` are **redirect stubs** to the PCO create routes.

---

## Form: pco_create
- **Title:** New Potential Change Order
- **URL Path:** `/67/pcos/new`
- **How to Open:** Navigate directly, or from `/67/pcos` create action.
- **Component:** `app/(main)/[projectId]/pcos/new/page.tsx` → `PCOWorkspace` (`components/domain/pcos/PCOWorkspace.tsx`). Local `useState` form (not RHF).
- **Fields:**

| Field | Control | Notes |
|---|---|---|
| Title * | Input | Required (client-side guard) |
| Type | Select | CLIENT_REQUESTED / INTERNAL / MIXED |
| Description | Textarea | |
| Change Reason, Location, Reference, Request Received From | Input | |
| Due Date | Input(date) | |
| RFQ Required, Is Private, Field Change, Paid In Full | Checkbox | |
| Grouped Change Events | Add/remove from left panel list | `change_event_ids[]` |
| Line Items | Repeating rows: description, qty, uom, unit_cost, category | computed `line_amount` |
| Markup % | Input(number) | feeds `estimated_value` |

- **Submit Action:** `useCreatePCO` → `POST /api/projects/{projectId}/pcos`. Two buttons: **Save Draft** (no status) and **Submit** (sets `status: "SUBMITTED"`, requires ≥1 CE and ≥1 line item). On success `router.push('/{projectId}/pcos')`.
- **Success Criteria:**
  - [ ] New PCO row appears in `/67/pcos`
  - [ ] Line items persisted and total = subtotal + markup
  - [ ] Grouped CEs attached
  - [ ] Submit path sets status SUBMITTED; success toast
- **Cleanup:** Delete created PCO via `/67/pcos` row action (delete) or detail page.
- **Risk Notes:**
  - 🚩 **(3) Error swallowing** — both `handleSaveDraft` and `handleSubmit` route errors through `reportNonCriticalFailure` only; **no `toast.error` on failure** beyond the generic fallback. A failed create gives the user almost no signal. Verify a forced 500 surfaces a visible error.
  - `createPCO.mutateAsync(buildPayload() as any)` — payload typed `any`, so a field-name mismatch with the API will fail silently at runtime, not compile time.

---

## Form: pco_edit
- **Title:** Edit PCO {number}
- **URL Path:** `/67/pcos/{pcoId}/edit`
- **How to Open:** From `/67/pcos/{pcoId}` detail → Edit (DRAFT/REVISION_REQUESTED), or row action.
- **Component:** `app/(main)/[projectId]/pcos/[pcoId]/edit/page.tsx` → `PCOWorkspace`. Hooks: `usePCO`, `useUpdatePCO`, `useGroupChangeEvent`, `useUngroupChangeEvent`, `useCreatePCOLineItem`, `useDeletePCOLineItem`.
- **Fields:** Same as `pco_create`, pre-filled from loaded PCO.
- **Submit Action:** `handleSave(submitAfter)`: PATCH main PCO via `useUpdatePCO`, then diff-group/ungroup CEs, create new line items (tempId non-numeric = new), delete removed line items. Submit variant adds `status: "SUBMITTED"`.
- **Success Criteria:**
  - [ ] All scalar fields + checkboxes pre-fill from saved record
  - [ ] Grouped CEs and line items pre-fill
  - [ ] Adding/removing a CE persists (group/ungroup mutations)
  - [ ] Adding/removing a line item persists
  - [ ] Edited values survive reload
- **Cleanup:** None (mutates existing); revert via re-edit.
- **Risk Notes:**
  - 🚩 **(3) Error swallowing** — same as create: catch → `reportNonCriticalFailure` only, no explicit error toast.
  - 🚩 **Partial-write hazard** — save fires a SEQUENCE of awaited mutations (PATCH, then per-CE group/ungroup, then per-line-item create/delete) with **no transaction**. If one mid-sequence call fails, the PCO is left half-updated and the user is navigated nowhere (stays on page) with only the non-critical reporter firing. Edited line items (existing rows) are NOT updated — only create/delete is handled, so editing an existing line item's value is silently lost.
  - **Existing line item edits are dropped:** loop only creates when `isNaN(Number(li.tempId))`; numeric (existing) ids are never PUT. Editing an existing line item amount does nothing.

---

## Form: pco_convert_to_co
- **Title:** Convert to Change Order (confirm dialog)
- **URL Path:** `/67/pcos/{pcoId}` (AlertDialog on detail page)
- **How to Open:** Detail page `PCORecordHeader` → "Convert to Change Order" (shown unless status VOID/CONVERTED).
- **Component:** `app/(main)/[projectId]/pcos/[pcoId]/page.tsx`, `handleConvert`.
- **Fields:** None — confirmation only.
- **Submit Action:** `POST /api/projects/{projectId}/pcos/{pcoId}/convert-to-co`.
- **Success Criteria:**
  - [ ] Confirm dialog opens (has AlertDialog ✓)
  - [ ] On confirm, a Change Order is created and PCO routes/refreshes
  - [ ] Failure shows `toast.error("Failed to convert PCO")`
- **Cleanup:** Delete the resulting CO if test pollution matters.
- **Risk Notes:**
  - 🚩 **(4) CE→PCO/PCO→CO conversion action** — primary conversion path. Verify the created CO actually appears and PCO status flips to CONVERTED. Confirm the convert button is correctly hidden afterward.

---

## Form: commitment_pco_create
- **Title:** Create Commitment PCO
- **URL Path:** `/67/commitment-pcos/new?changeEventIds=<ids>` (also `?commitmentId=`)
- **How to Open:** From a Change Event → "Add to Commitment PCO" / "Price Impact". **Direct creation without source change events is disabled** (shows an InfoAlert, no form).
- **Component:** `app/(main)/[projectId]/commitment-pcos/new/page.tsx` — RHF + zod.
- **Fields:**

| Field | Control | FK / Source |
|---|---|---|
| Commitment * | Combobox (Command/Popover) | `commitment_id` (uuid). Options from `/api/projects/{id}/commitment-options` |
| Contract Company | Input (disabled) | derived from selected commitment |
| Title * | Input | |
| Change Reason | Input | |
| Schedule Impact (days) | Input(number) | |
| Due Date | Input(date) | |
| Description | Textarea | |

- **Submit Action:**
  - With source CEs: `POST /api/projects/{projectId}/change-events/add-to-pco` body `{ change_event_ids, pco_type:"commitment", create_new:{...} }`.
  - Without source CEs (rare path): `POST /api/projects/{projectId}/commitment-pcos`.
  - Requires `selectedCommitment.commitment_type`. On success routes to detail.
- **Success Criteria:**
  - [ ] Source CE list renders; blocks submit if not all CEs loaded
  - [ ] Commitment combobox pre-selects when `commitmentId`/`contractId` param present, or auto-selects when exactly one commitment
  - [ ] PCO created and linked to source change events
  - [ ] Success toast + route to `/67/commitment-pcos/{id}`
- **Cleanup:** Delete created commitment PCO from list/detail (DRAFT only).
- **Risk Notes:**
  - **(4) CE→PCO conversion** — this IS a change-event→PCO conversion form. Primary risk surface.
  - `commitment_id` dropdown source = `commitment-options`; FK target column should also be a commitment id — verify source/target match (likely OK, but confirm `commitment-options` returns the same id space the CE→PCO endpoint expects).
  - Error handling here is correct (`toast.error` with message). Good.

---

## Form: prime_contract_pco_create
- **Title:** Create Prime Contract PCO / New Prime Contract Change Order
- **URL Path:** `/67/prime-contract-pcos/new` (optionally `?changeEventIds=` and/or `?contractId=`)
- **How to Open:** From Change Event ("Price Impact (Prime)"), from a prime contract context, or directly. Behavior **forks on `changeEventIds`**:
  - **With CEs:** creates a *PCO* from change events.
  - **Without CEs:** assembles an *official Prime Contract Change Order* from selected existing PCOs.
- **Component:** `app/(main)/[projectId]/prime-contract-pcos/new/page.tsx` — RHF + zod. Largest form (~1440 lines).
- **Fields (superset):** prime_contract_id * (Select, from `/api/projects/{id}/contracts`), title *, Potential Change Orders * (multi-select Popover, **only in no-CE branch**), revision, status (Select), designated_reviewer (employee combobox), review_date, reviewed_by (employee combobox), signed_co_received_date, executed (checkbox), is_private (checkbox), due_date, revised_substantial_completion_date, schedule_impact, total_amount (auto-summed from selected PCOs), invoiced_date, paid_date, description, change_reason, location, reference, field_change, paid_in_full, **Attachments** (FileUploadField, no-CE branch only).
- **Submit Action:**
  - With CEs: `POST /api/projects/{projectId}/change-events/add-to-pco` `{ pco_type:"prime", create_new:{...} }`.
  - Without CEs: `POST /api/projects/{projectId}/prime-contract-change-orders` to create the CO, then `PATCH /api/projects/{projectId}/prime-contract-pcos/{pcoId}` per selected PCO setting `promoted_to_co_id`, then upload attachments, then route to the new CO.
- **Success Criteria:**
  - [ ] Contract Select populates; auto-selects from `contractId` param or single contract
  - [ ] With CEs: title/reason/contract pre-fill from source events; blocks if not all CEs loaded
  - [ ] Without CEs: PCO multiselect lists only PCOs for the contract with linked CEs; total auto-sums
  - [ ] Reviewer/Reviewed-By comboboxes (employee names, stored as strings)
  - [ ] Record created; attachments upload (warn toast on partial upload failure)
- **Cleanup:** Delete created CO (`/67/change-orders/prime/{id}`) and/or the PCO.
- **Risk Notes:**
  - 🚩 **(1) FK/source mismatch** — `designated_reviewer` / `reviewed_by` are stored as **free-text employee NAMES** (string columns), not employee IDs. The combobox writes `field.onChange(employeeName)`. On the EDIT page these are plain `request_received_from`-style text. If the DB expects an id anywhere downstream, this silently stores a name. Verify reviewer round-trips on edit.
  - 🚩 **(4) Two distinct conversion flows in one form** — CE→PCO vs PCO→PCCO. High test priority; ensure the correct branch fires based on `changeEventIds` presence.
  - **Early-return without resetting submit guard is covered by `finally`** — OK, but the `selectedPcoIds.length === 0` guard returns *inside* try after `setIsSubmitting(true)`; finally clears it. Acceptable.
  - Attachment upload uses `apiFetch` with FormData — verify the multipart path works.

---

## Form: prime_contract_pco_edit
- **Title:** Edit PCO #{pco_number}
- **URL Path:** `/67/prime-contract-pcos/{pcoId}/edit` (also nested `/67/prime-contracts/{contractId}/change-orders/pcos/{pcoId}` context)
- **How to Open:** From prime-contract PCO detail → Edit.
- **Component:** `app/(main)/[projectId]/prime-contract-pcos/[pcoId]/edit/page.tsx` — local `useState` form, `LabelValueRow` horizontal layout.
- **Fields:** title, status (Select), revision, change_reason (Select), is_private, description, executed, signed_co_received_date, request_received_from, location, schedule_impact, field_change, reference, paid_in_full.
- **Submit Action:** `PATCH /api/projects/{projectId}/prime-contract-pcos/{pcoId}` then route to detail.
- **Success Criteria:**
  - [ ] All fields pre-fill from GET (toFormData mapping)
  - [ ] Status + Change Reason selects pre-select correct values
  - [ ] Save persists and detail reflects changes
- **Cleanup:** None (mutate existing).
- **Risk Notes:**
  - 🚩 **Raw `fetch()` instead of `apiFetch`** (lines 154, 203) — violates the `require-api-client` lint rule; bypasses guardrails (auth/error wrapping). Functional but non-compliant and inconsistent error handling.
  - Errors DO toast (`toast.error("Failed to save prime contract PCO")`) — but the specific server error message is discarded on save (it's parsed into an Error then swallowed by a generic toast).

---

## Form: commitment_pco_edit (STUB — disabled)
- **Title:** Edit (Commitment PCO)
- **URL Path:** `/67/commitment-pcos/{pcoId}` (`?edit=1` from list)
- **How to Open:** List/detail Edit button.
- **Status:** 🚩 **NOT IMPLEMENTED.** On the detail page the Edit button is rendered `disabled` with `title="Edit form coming soon"`. The list `handleEdit` pushes `?edit=1` but the detail page has no edit form wired to that param.
- **Risk Notes:** Edit is a dead action for commitment PCOs. Flag as missing feature; do not gauntlet-test an edit flow that cannot complete. Verify the disabled state and that `?edit=1` does not error.

---

## Form: commitment_pco_delete
- **Title:** Delete PCO? (AlertDialog)
- **URL Paths:** `/67/commitment-pcos` (row action) and `/67/commitment-pcos/{pcoId}` (detail).
- **Component:** list `page.tsx` (`useConfirmationDialog`) + detail `[pcoId]/page.tsx` (AlertDialog).
- **Submit Action:** `DELETE /api/projects/{projectId}/commitment-pcos/{pcoId}`. Detail delete gated to `status === "draft"`.
- **Success Criteria:** [ ] Confirm dialog appears [ ] Row/record disappears [ ] Success toast.
- **Cleanup:** N/A (this is cleanup).
- **Risk Notes:** Has confirm ✓. Detail also has **Promote to CCO** dialog (`POST .../promote`) — see promote forms below. Bulk delete + bulk promote (`promote-bulk`) exist on list with confirm dialogs.

---

## Form: prime_contract_pco_delete
- **Title:** Delete PCO? (AlertDialog)
- **URL Paths:** `/67/prime-contract-pcos` (row action) and `/67/prime-contract-pcos/{pcoId}` (detail).
- **Component:** list `page.tsx` + detail `[pcoId]/page.tsx`.
- **Submit Action:** `DELETE /api/projects/{projectId}/prime-contract-pcos/{pcoId}`.
- **Success Criteria:** [ ] Confirm [ ] Disappears [ ] Toast.
- **Risk Notes:** Has confirm ✓.

---

## Form: pco_promote_to_co (commitment + prime variants)
- **Title:** Promote to Change Order? / Promote to CCO (AlertDialog)
- **URL Paths:** commitment & prime PCO **list** rows and **detail** pages.
- **Submit Action:**
  - Commitment: `POST /api/projects/{projectId}/commitment-pcos/{pcoId}/promote` (+ `promote-bulk`).
  - Prime: `POST /api/projects/{projectId}/prime-contract-pcos/{pcoId}/promote` (+ `promote-bulk`).
  - Gated by `canPromote` (status pending/approved && not already promoted).
- **Success Criteria:**
  - [ ] Confirm dialog (✓ all promote paths use `useConfirmationDialog` / AlertDialog)
  - [ ] Official CO created; PCO shows `promoted_to_co_id` / promoted banner
  - [ ] Promote button hidden after promotion
- **Cleanup:** Delete the created CO if needed.
- **Risk Notes:**
  - 🚩 **(4) Conversion action** — PCO→CO promotion. Confirm the CO actually lands in `/change-orders` and the PCO can't be double-promoted.

---

## Form: prime_co_edit (Change Order detail edit)
- **Title:** Prime Contract Change Order detail / edit
- **URL Path:** `/67/change-orders/prime/{primeCoId}` (`?edit=1` toggles edit mode)
- **Component:** `app/(main)/[projectId]/change-orders/prime/[primeCoId]/page.tsx` (~2150 lines) — RHF form + inline line-item editor.
- **Fields:** Full CO field set (title, status, contract, dates, amounts, reviewer, flags, description) + **inline line items** (add/edit/delete rows).
- **Submit Actions:**
  - Header save: `PUT {apiBase}` (prime-contract-change-orders/{id}).
  - Line items: `POST` (add), `PUT` (edit), `DELETE` (remove) on `.../line-items`.
  - **Approve:** `POST {apiBase}/approve`. **Delete CO:** `DELETE {apiBase}`. Additional `POST` at line 832 (likely reject or related action).
- **Success Criteria:**
  - [ ] Edit mode pre-fills all fields
  - [ ] Line item add/edit/delete persist and totals update
  - [ ] Save persists; approve transitions status
  - [ ] Delete removes CO and routes back
- **Cleanup:** Don't delete real prime COs; use a throwaway record.
- **Risk Notes:**
  - 🚩 **Mixed raw `fetch()` + `apiFetch`** — `handleDelete` (line 794) and `approve` (line 809) use raw `fetch()`; line-item ops use `apiFetch`. Inconsistent; raw fetch bypasses guardrails (`require-api-client` violation in a component).
  - 🚩 **(2) Delete confirmation** — confirm whether the CO `handleDelete` (line 785/1626) is wrapped in an AlertDialog. The list-level delete is NOT (see `change_orders_list_delete`); verify the detail one is.
  - Line-item delete (`handleDeleteLineItem`, line 593) — verify it has a confirm or is intentionally immediate.

---

## Form: commitment_co_edit (Change Order detail edit)
- **Title:** Commitment Change Order detail / edit
- **URL Path:** `/67/change-orders/commitment/{commitmentCoId}` (`?edit=1`)
- **Component:** `app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx` — RHF + inline line items.
- **Fields:** CO header fields + inline line items.
- **Submit Actions:**
  - Header save: `PUT /api/commitments/{contractId}/change-orders/{id}` (via `apiFetch`).
  - Line items: `POST` / `PUT` / `DELETE` on line-item base (all `apiFetch` ✓).
  - Delete CO: `DELETE` (line 540, `apiFetch`). Additional `POST` actions at lines 554/577 (approve/related).
- **Success Criteria:**
  - [ ] Edit pre-fills fields and line items
  - [ ] Line item CRUD persists; total recomputes
  - [ ] Save + delete work; routes correctly
- **Cleanup:** Use throwaway commitment CO.
- **Risk Notes:**
  - Uses `apiFetch` throughout (good).
  - 🚩 **(2) Delete confirm** — verify `handleDelete` (line 531) and `handleDeleteLineItem` (line 357) are guarded by a confirmation dialog; line-item delete at line 1233 fires `handleDeleteLineItem(item.id)` directly on click.

---

## Form: change_orders_list_delete  🚩🚩
- **Title:** (none — direct delete, NO dialog)
- **URL Path:** `/67/change-orders` (Prime tab) and `/67/change-orders?tab=commitment`
- **Component:** `app/(main)/[projectId]/change-orders/change-orders-client.tsx` → `renderRowActions` → `onDelete`.
- **Submit Action:**
  - Prime: `DELETE /api/projects/{projectId}/prime-contract-change-orders/{id}`.
  - Commitment: `DELETE /api/commitments/{contract_id}/change-orders/{id}`.
- **Success Criteria:** [ ] Row disappears [ ] `router.refresh()` reloads [ ] Toast.
- **Risk Notes:**
  - 🚩🚩 **(2) DELETE WITH NO CONFIRMATION.** `handleDeletePrime` / `handleDeleteCommitment` call the DELETE endpoint **immediately** from the row-action menu with no AlertDialog. One mis-click permanently deletes a change order. The PCO list pages all use `useConfirmationDialog`; this CO list does not. **High-priority fix candidate** — wrap both in a confirm dialog.
  - Commitment delete guards on missing `contract_id` (toast.error) — OK.
  - `features.enableBulkDelete: false` — no bulk delete here (intentional, COs managed via prime-contract tool).

---

## Non-form / redirect stubs (no testing needed)
- `/67/change-management` — dashboard (`ChangeManagementDashboard`), read-only widgets. No form.
- `/67/change-orders/new`, `/67/change-orders/commitment/new`, `/67/change-orders/prime/new` — **redirect stubs** to `/commitment-pcos/new` or `/prime-contract-pcos/new`. No form of their own (the prime/new and commitment/new under `change-orders` redirect).
- `components/domain/pcos/PCOWorkspace.tsx` — shared form body for `pco_create` and `pco_edit` (not a standalone form).

---

## Cross-cutting bug-class summary

| Class | Where | Severity |
|---|---|---|
| 🚩🚩 (2) Delete, no confirm | `change_orders_list_delete` (prime + commitment row actions) | High — destructive, one-click |
| 🚩 (2) Delete confirm unverified | `prime_co_edit` / `commitment_co_edit` CO delete + line-item delete | Verify in browser |
| 🚩 (3) Error swallowing | `pco_create`, `pco_edit` — `reportNonCriticalFailure` only, no user-visible error toast | Medium |
| 🚩 (1) FK/source | `prime_contract_pco_create` reviewer/reviewed_by stored as free-text name strings | Verify edit round-trip |
| 🚩 (4) Conversion | `pco_convert_to_co`, `commitment_pco_create` (CE→PCO), `prime_contract_pco_create` (CE→PCO + PCO→PCCO), `pco_promote_to_co` | Primary functional risk |
| Partial-write / dropped edits | `pco_edit` — sequential non-transactional mutations; existing line-item value edits never PUT | Medium-High |
| Raw `fetch()` (lint) | `prime_contract_pco_edit`, `prime_co_edit` (delete/approve) | Low (compliance) |
| Missing feature | `commitment_pco_edit` disabled ("coming soon") | Edit flow unusable |
