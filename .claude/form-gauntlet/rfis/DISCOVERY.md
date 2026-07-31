# Form Discovery — RFIs tool

Project for testing: **67** (Vermillion Rise Warehouse).

## Architecture summary

- **List route** (`/{projectId}/rfis`) is rendered by `rfis-table.tsx` via `page.tsx`. It uses `AleatoDataTable` + `useDataTable` with **tabs** (All / Open / Closed), search, and **bulk delete**. No inline create/edit/delete dialogs — create routes to `/new`, rows route to detail.
- **`rfis-client.tsx` (`RfisClient`, `UnifiedTablePage` variant) is DEAD CODE** — not imported anywhere. It has its own delete handler + row actions, but the route does not use it. Flagged below for awareness; not part of the live test surface.
- **Create** is a full page (`/new`) using `RfiFormFields` (shared) + dual submit (Save as Draft / Create Open).
- **Edit** is the detail page in `?mode=edit` — inline RHF form in `rfi-detail.tsx`.
- **Header actions** (`rfi-header-actions.tsx`): status-transition buttons (Open/Close/Reopen), Create Change Event, Edit, and a Delete confirmation `AlertDialog`.
- **Responses** are Supabase collaboration comments (`EntityRoom`/`EntityComments`), not a classic form — noted but out of standard form scope.
- **`RfiFormFields` is also reused** in `LinkPinModal.tsx` (drawings pin → "create RFI" tab).

### People-field storage (NO FK mismatch)
All people fields (`rfi_manager`, `assignees`, `received_from`, `responsible_contractor`, `distribution_list`) are stored as **plain display-name strings / text[]** on the `rfis` table — NOT foreign keys to `people`/`companies`/`users`. The dropdowns source name strings from `useRfiManagerOptions` (project users + `project.team_members`) and write the same strings back. Edit pre-fill therefore works by string equality. **No classic FK-target≠source bug.** The one caveat: option list is built from current project users; if a saved name no longer matches any option, the combobox could show empty on edit (low risk — comboboxes here render the stored value).

---

## Form: rfi_create

**Title:** New RFI
**URL Path:** `/67/rfis/new`
**How to Open:** RFIs list → "Create RFI" button (top-right, `data-testid="rfis-create-button"`), or empty-state "Create your first RFI".

### Fields

| Field | Component | Source / Options | Required (Open) | Notes |
|-------|-----------|------------------|-----------------|-------|
| subject | RHFTextField | — | Yes (always) | min 1 |
| question | RHFTextareaField | — | Yes for Open | optional for Draft |
| due_date | RHFDateField (nullable) | — | Yes for Open | defaults today+14d |
| rfi_manager | RHFComboboxField | project users + team_members (name strings) | No | |
| assignees | RHFMultiComboboxField | same name-string options | Yes for Open (≥1) | text[] |
| received_from | RHFComboboxField (clearable) | same | No | |
| responsible_contractor | RHFComboboxField (clearable) | same | No | |
| distribution_list | RHFMultiComboboxField | same | No | |
| location | RHFTextField | — | No | |
| specification | RHFTextField | — | No | |
| cost_code | RHFTextField | — | No | |
| rfi_stage | RHFTextField | — | No | default "Open" |
| schedule_impact | RHFSelectField | RFI_IMPACT_OPTIONS | No | default "no" |
| cost_impact | RHFSelectField | RFI_IMPACT_OPTIONS | No | default "no" |
| reference | RHFTextField | — | No | |
| drawing_number | RHFTextField | — | No | |
| is_private | Checkbox | — | No | |

### Submit Action
Two buttons:
- **Create Open** (form submit / primary) → validates `rfiOpenSchema`, `POST /api/projects/67/rfis` with `status:"open"`.
- **Save as Draft** (secondary) → validates `rfiDraftSchema`, `POST` with `status:"draft"`.

Hook `useCreateRfi`. On success: toast "RFI created successfully", invalidate `["rfis", 67]`, router push back to `/67/rfis`. Server auto-assigns next `number`, sets `created_by`, `date_initiated`, and `ball_in_court` (assignees join, open only).

### Success Criteria
- [ ] Validation: submitting Open with empty question/due_date/assignees shows inline field errors (no navigation).
- [ ] Draft can save with only subject filled.
- [ ] Toast "RFI created successfully" appears.
- [ ] Redirects to `/67/rfis`; new RFI appears in list with correct # and status badge (Open or Draft).
- [ ] Reopen the new RFI → Edit: all entered fields (incl. rfi_manager, assignees, received_from, responsible_contractor combos) pre-fill correctly.

### Cleanup
DELETE the created RFI(s) via row/detail delete after test.

### Risk Notes
- 🚩 Create page submit handler swallows errors into `reportNonCriticalFailure` with `userVisibleFallback` "RFI was not created." — but `useCreateRfi.onError` ALSO fires a toast. Confirm error is actually surfaced (it is, via hook toast) and not double-silenced.
- Open validation maps only `issue.path[0]` to `setError` — nested paths won't surface, but all RFI fields are flat so OK.

---

## Form: rfi_edit

**Title:** Editing RFI #N (inline on detail page)
**URL Path:** `/67/rfis/{rfiId}?mode=edit`
**How to Open:** Detail page → header ⋯/Edit (`DetailActions.onEdit` → `?mode=edit`).

### Fields
Same field set as create EXCEPT: no `specification` text in edit? — present (Specification input). Edit form omits `distribution_list`? — **distribution_list is NOT rendered in edit mode** (present in create, absent in edit). Fields rendered: subject, question, due_date, rfi_manager, received_from, responsible_contractor, assignees, location, drawing_number, specification, cost_code, rfi_stage, reference, schedule_impact, cost_impact, is_private. Uses `zodResolver(rfiEditSchema)` (all partial).

### Submit Action
`EditModeActions` Save → `form.handleSubmit(handleSave)` → `useUpdateRfi` → `PATCH /api/projects/67/rfis/{id}`. On success: toast "RFI updated successfully", invalidate `["rfis"]`+`["rfi",id]`, push to detail, `router.refresh()`. Cancel → `form.reset()` + push to detail.

### Success Criteria
- [ ] All combo/multi-combo fields pre-fill with the saved name strings on entering edit mode.
- [ ] Edit a field (e.g. subject, assignees) → Save → detail view reflects change after refresh; toast shown.
- [ ] Changing assignees (without status change) syncs `ball_in_court` server-side for open RFIs.
- [ ] Cancel discards changes.
- [ ] 🚩 `distribution_list` is missing from the edit form — a value set at create cannot be edited here. Confirm whether this is intended; flag as gap.

### Cleanup
Revert edits or delete the test RFI.

### Risk Notes
- 🚩 **Field gap:** `distribution_list` editable on create, NOT on edit. Data set at create is uneditable.
- People fields are name strings → no FK pre-fill bug, but if a stored name isn't in current options the combobox may appear blank.

---

## Form: rfi_delete (detail)

**Title:** Delete RFI #N?
**URL Path:** `/67/rfis/{rfiId}` (header action)
**How to Open:** Detail header ⋯/Delete → opens `AlertDialog` confirm.

### Fields
None — confirm dialog (Cancel / Delete).

### Submit Action
`AlertDialogAction` → `useDeleteRfi.mutateAsync(id)` → `DELETE /api/projects/67/rfis/{id}` (auth-guarded). On success: toast, invalidate, push to `/67/rfis`.

### Success Criteria
- [ ] Confirm dialog appears before delete (✅ has confirm).
- [ ] Confirm → RFI removed; redirect to list; RFI no longer present.
- [ ] Cancel → no deletion.

### Cleanup
N/A (this IS the cleanup path).

### Risk Notes
- Has confirm + real DELETE route → no "delete without confirm" bug here.

---

## Form: rfi_status_transition (header buttons)

**Title:** Open RFI / Close RFI / Reopen (contextual single button)
**URL Path:** `/67/rfis/{rfiId}`
**How to Open:** Detail header — button shown depends on current status (draft→Open RFI; open→Close RFI; closed/closed-draft→Reopen).

### Fields
None — single-click action.

### Submit Action
`handleStatusChange(newStatus)` → `useUpdateRfi` PATCH with `{status}`. Server applies transition logic (draft+close→closed-draft; reopen clears closed_date/restores ball_in_court; closing sets closed_date, clears ball_in_court). **Closing triggers email notifications**; if any email fails the PATCH returns **502** and the mutation rejects.

### Success Criteria
- [ ] Status button reflects current status correctly.
- [ ] Click → status badge updates after `router.refresh()`; persists on reload.
- [ ] Close → closed_date set, ball_in_court cleared.
- [ ] 🚩 Closing an RFI with notification recipients: confirm no unexpected 502 toast in test env (email send may fail without configured provider). If 502, status DID persist server-side but UI shows failure — verify behavior.

### Cleanup
Reopen/reset status if needed.

### Risk Notes
- 🚩 **Close path can return 502** if email notification fails (by design — "never ship silent failures"). In a test env without email creds this surfaces as a failed update toast even though the row updated. Note for verifier: check DB status vs toast.
- `handleStatusChange` has no try/catch — a rejected mutation throws unhandled in the click handler (relies on `useUpdateRfi.onError` toast).

---

## Form: rfi_create_change_event (header button)

**Title:** Create Change Event
**URL Path:** `/67/rfis/{rfiId}`
**How to Open:** Detail header "Create Change Event" button.

### Submit Action
`POST /api/projects/67/change-events` with `{title, origin:"rfis", origin_id, status:"Open"}`. On success toast + navigate to new CE. try/catch with error toast.

### Success Criteria
- [ ] Click → new change event created, navigates to `/67/change-events/{id}`, toast shown.

### Cleanup
Delete the created change event.

### Risk Notes
- Cross-tool side effect; not a classic form. Has proper error toast.

---

## Form: rfi_bulk_delete (list table)

**Title:** Bulk delete (table selection)
**URL Path:** `/67/rfis`
**How to Open:** Select rows in `AleatoDataTable` → bulk delete action.

### Submit Action
`handleBulkDelete(ids)` → `Promise.allSettled` of `DELETE /api/projects/67/rfis/{id}`; success/fail toasts via `summarizeBulkResults`; invalidate `["rfis",67]`.

### Success Criteria
- [ ] Select multiple RFIs → bulk delete → rows removed, success toast with count.
- [ ] Partial failures reported with count + first error.

### Cleanup
N/A (cleanup path).

### Risk Notes
- Partial-failure handling present. No confirm dialog on the bulk action itself (depends on `AleatoDataTable` impl — verify it confirms before deleting).

---

## Form: rfi_create_via_link_pin (drawings reuse) — out of primary RFIs surface

**Title:** Link Pin Modal → RFI tab
**URL Path:** drawings viewer (`LinkPinModal`), not under `/rfis`
**How to Open:** Drawings markup → add pin → select "RFI" type → either link existing RFI or create new (Create Open & Link / Save Draft & Link).

### Submit Action
Reuses `RfiFormFields` + `useCreateRfi` (same schemas). On create, also creates a drawing pin linking to the new RFI.

### Success Criteria
- [ ] Same create criteria as `rfi_create`, plus pin linkage created.

### Risk Notes
- Shares the canonical form contract — any RFI create fix must keep this in sync.

---

## DEAD CODE flag: rfis-client.tsx (RfisClient)

`frontend/src/app/(main)/[projectId]/rfis/rfis-client.tsx` defines a `UnifiedTablePage`-based RFIs list with its own `handleDelete`/`renderRfiRowActions` (View/Edit/Delete dropdown). **It is not imported anywhere** — the live route uses `rfis-table.tsx`. Its delete has a toast but **no confirmation dialog** (would be a 🚩 if it were live). Recommend deletion as cleanup, but it is NOT part of the testable form surface.
