# Drawings — Form Discovery

Tool: **drawings**
Test project: **67**
Discovered: 2026-06-13

Total forms / mutating surfaces: **17**

Legend: 🚩 = high-risk (known bug class flagged). Bug classes: (1) dropdown FK target ≠ source; (2) delete with no confirm / no DELETE call; (3) save/upload handler swallowing errors.

---

## Form: drawing_upload 🚩
**Title:** Upload Drawings
**URL Path:** `/67/drawings` (also opens via drag-and-drop overlay)
**Component:** `frontend/src/components/drawings/DrawingUploadDialog.tsx`
**How to Open:** Click **Upload** (header) on the drawings log, or drag PDF/PNG/JPG/TIFF files onto the page.

**Fields**
| Field | Type | Required | Source / Notes |
|---|---|---|---|
| Files | file (multi) | yes | `.pdf,.png,.jpg,.jpeg,.tiff,.tif`; per-file size validated via `getDrawingUploadFileError` |
| Drawing Set | select | yes | options from `useDrawingSets` (`/api/.../drawings/sets`); `__new__` reveals "New Set Name" text input |
| New Set Name | text | conditional | only when set = `__new__`; resolved/created via POST `/drawings/sets` before upload |
| Default Drawing Date | date (RHFDateField) | no | |
| Default Received Date | date (RHFDateField) | no | defaults to now if empty |
| Drawing Number | text | no | advanced; falls back to filename-derived identity |
| Revision | text | no | advanced; defaults "A" |
| Title | text | no | advanced; falls back to filename |
| Discipline | select | no | advanced; `DRAWING_DISCIPLINES` |
| Type | select | no | advanced; `DRAWING_TYPES` |
| Description | textarea | no | advanced |

**Submit Action:**
- Single file: POST `/drawings/upload-url` → direct `uploadToSignedUrl` to `project-files` → POST `/drawings` (creates row).
- Multiple files: `uploadMultipleDrawings` (batch, partial-failure aware via `DrawingUploadBatchError`).
- 409 DUPLICATE_DRAWING_NUMBER → shows "Drawing already exists" panel with **Upload as New Revision** (`handleUploadAsRevision` → `/drawings/{id}/revisions/upload-url` + POST `/drawings/{id}/revisions`).

**Success Criteria**
- [ ] New drawing row appears in log after single upload (toast "Successfully uploaded N drawing(s)")
- [ ] New set created + selectable when using `__new__`
- [ ] Duplicate drawing number → 409 → revision panel works, adds revision not duplicate
- [ ] Multi-file partial failure keeps only failed files selected + toasts uploaded count
- [ ] Dialog closes on success, query cache invalidated (drawings list refreshes)

**Cleanup:** Delete any drawing(s)/set(s)/revision created during test (move to recycle bin, then Delete Forever; delete set on sets page).

**Risk Notes:**
- 🚩 (1) FK/source mismatch surface: form sends `drawing_set_id` (resolved to a real set id) and `area_id`. POST `/drawings` route reads `area_id`/`drawing_set_id` directly (lines 130/135/157/162/219/256) — verify these are real `drawing_sets.id` / `drawing_areas.id` and pre-fill on edit. Upload form has NO area picker despite sending `area_id` (only set via URL elsewhere) — confirm area assignment path.
- Multiple guards against double-submit (`uploadInFlightRef`, `isBusy`). Errors are surfaced via toast + ErrorState (not silently swallowed) — good.

---

## Form: drawing_upload_as_revision 🚩
**Title:** Upload as New Revision (inline branch of upload dialog)
**URL Path:** `/67/drawings` (duplicate-detection panel inside upload dialog)
**How to Open:** Upload a file whose drawing_number matches an existing drawing → 409 → click **Upload as New Revision**.
**Fields:** reuses upload form values (revision_number, dates, set, description) + the single selected file.
**Submit Action:** `/drawings/{id}/revisions/upload-url` + POST `/drawings/{id}/revisions`.
**Success Criteria**
- [ ] New revision added to existing drawing; revisions list/count increments
- [ ] No duplicate drawing created
- [ ] Toast "New revision uploaded successfully"
**Cleanup:** Delete the revision/drawing.
**Risk Notes:** 🚩 Only reachable through duplicate flow; easy to miss in testing. Errors toasted, not swallowed.

---

## Form: drawing_edit_log 🚩
**Title:** Edit Drawing (row action dialog on the log)
**URL Path:** `/67/drawings`
**How to Open:** Row ⋯ menu → Edit, or card/list edit affordance.
**Fields:** Drawing Number (text, req), Title (text, req), Discipline (select, `allDisciplines`), Type (select, `DRAWING_TYPES`).
**Submit Action:** `updateDrawing.mutateAsync({ drawingId, data })` → PATCH `/drawings/{id}`.
**Success Criteria**
- [ ] Dialog pre-fills current values (incl. Discipline/Type dropdowns showing saved value — FK/source check)
- [ ] Row updates in place after Save
- [ ] Validation blocks empty number/title (toast)
**Cleanup:** Revert edits or delete test drawing.
**Risk Notes:** 🚩 (1) Verify Discipline/Type pre-fill — these are enum strings (not FK), low risk, but confirm `editDraft.discipline` matches an option in `allDisciplines` (which merges enum + data values).

---

## Form: drawing_bulk_edit
**Title:** Edit Selected Drawings
**URL Path:** `/67/drawings`
**How to Open:** Select ≥1 row (checkbox) → header **Edit** button.
**Fields:** Discipline (select, default `__no_change__`), Type (select, default `__no_change__`).
**Submit Action:** `Promise.all` of `updateDrawing.mutateAsync` per selected item (PATCH each). Skips fields left as `__no_change__`.
**Success Criteria**
- [ ] "Choose at least one field" toast when both left unchanged
- [ ] All selected rows update; toast "Updated N drawings"; selection cleared
**Cleanup:** Revert via bulk edit or delete test rows.
**Risk Notes:** Sequential N PATCHes — no partial-failure rollback; if one fails the Promise.all rejects and later items may be unsaved. Errors not individually toasted.

---

## Form: drawing_delete_single
**Title:** Delete drawing? (confirm)
**URL Path:** `/67/drawings`
**How to Open:** Row ⋯ → Delete (or card/list delete).
**Fields:** none (AlertDialog confirm).
**Submit Action:** `deleteDrawing.mutate(id)` → DELETE `/drawings/{id}` (soft delete → recycle bin).
**Success Criteria**
- [ ] Confirm dialog shows drawing number/title
- [ ] Row disappears from log; appears in Recycle Bin
**Cleanup:** Restore from recycle bin or leave deleted (it's a test row).
**Risk Notes:** Has confirm + DELETE — OK.

---

## Form: drawing_bulk_delete
**Title:** Delete selected drawings? (confirm)
**URL Path:** `/67/drawings`
**How to Open:** Select rows → header **Delete**.
**Submit Action:** `Promise.all(deleteDrawing.mutateAsync(id))` per item → soft delete to recycle bin.
**Success Criteria**
- [ ] Confirm shows count; rows move to Recycle Bin; selection cleared
**Cleanup:** Restore or leave.
**Risk Notes:** Note `enableBulkDelete: false` in UnifiedTablePage features — bulk delete is driven by the page's own header button/AlertDialog, not the table toolbar. Confirm present. Promise.all = no partial rollback.

---

## Form: drawing_recycle_restore
**Title:** Restore (recycle bin row action)
**URL Path:** `/67/drawings/recycle-bin`
**How to Open:** Recycle Bin tab → **Restore** on a deleted row.
**Submit Action:** `restoreDrawing.mutate(id)` → POST `/drawings/{id}/restore`.
**Success Criteria**
- [ ] Row leaves recycle bin; reappears in current drawings log
**Cleanup:** none.
**Risk Notes:** No confirm dialog on Restore (low risk — non-destructive).

---

## Form: drawing_recycle_permanent_delete
**Title:** Permanently delete drawing? (confirm)
**URL Path:** `/67/drawings/recycle-bin`
**How to Open:** Recycle Bin → **Delete Forever**.
**Submit Action:** `permanentDelete.mutate(id)` → DELETE (permanent) `/drawings/{id}` with hard-delete semantics.
**Success Criteria**
- [ ] Confirm warns about revisions/files; row disappears permanently
**Cleanup:** none (terminal).
**Risk Notes:** Has confirm + DELETE — OK. Destructive/irreversible — test on a throwaway row only.

---

## Form: drawing_set_create_inline
**Title:** New Set (inline table row)
**URL Path:** `/67/drawings/sets`
**How to Open:** **New Set** header button → inline create row appears.
**Fields:** Name (text, req), Date (date, defaults now).
**Submit Action:** `createSet.mutateAsync` → POST `/drawings/sets`. Enter submits, Escape cancels.
**Success Criteria**
- [ ] "Set name is required" toast on empty name
- [ ] New set row appears in table
**Cleanup:** No delete UI on sets page — delete via DB/API (`DELETE /drawings/sets/{setId}` exists). Flag: **no set delete in UI**.
**Risk Notes:** Raw `<Table>` primitives (not UnifiedTablePage) — acceptable here but note for parity. No set deletion UI = cleanup gap.

---

## Form: drawing_set_edit_inline 🚩
**Title:** Edit Set (inline)
**URL Path:** `/67/drawings/sets`
**How to Open:** Row **Edit** (pencil) → name/date become inputs.
**Fields:** Name (text, req), Date (date).
**Submit Action:** `updateSet.mutateAsync({ setId, data })` → PATCH `/drawings/sets/{setId}`. Enter saves, Escape cancels.
**Success Criteria**
- [ ] Pre-fills current name/date
- [ ] Row reflects new values after Save
**Cleanup:** Revert.
**Risk Notes:** 🚩 Uses **Pencil icon** for edit — violates project rule "No pencil edit icons" (use MoreVertical/Ellipsis). Cosmetic/guardrail flag, not a functional bug.

---

## Form: drawing_area_create
**Title:** Create Drawing Area
**URL Path:** `/67/drawings/areas`
**How to Open:** **Create Area** / **Create First Area** button (creates a "New Area" immediately via `handleCreateArea`), OR via `DrawingAreaCard` dialog for nested create.
**Component:** `frontend/src/components/drawings/DrawingAreaCard.tsx` (+ page handler).
**Fields (DrawingAreaCard):** Name (text, req, zod `drawingAreaSchema`), Description (textarea), Parent Area (read-only display when nested).
**Submit Action:** page **Create Area** button = optimistic `createArea.mutateAsync({ name:"New Area", ... })` directly (no dialog); `DrawingAreaCard` onSave → `createArea`/`updateArea`. → POST `/drawings/areas`.
**Success Criteria**
- [ ] Area appears in `DrawingAreaSelector`; toast success
**Cleanup:** Delete the area (see area_delete).
**Risk Notes:** "Create Area" button creates a placeholder "New Area" with no form — inconsistent UX (parity with rename-after-create). Errors toasted.

---

## Form: drawing_area_edit
**Title:** Edit Drawing Area
**URL Path:** `/67/drawings/areas`
**How to Open:** Area selector → edit action → `DrawingAreaCard` dialog (isEditing).
**Fields:** Name (req), Description, Parent (display only).
**Submit Action:** `handleSaveArea` → `updateArea.mutateAsync({ areaId, data })` → PATCH `/drawings/areas/{areaId}`.
**Success Criteria**
- [ ] Dialog pre-fills name/description; area updates after Save (toast "Drawing area updated")
**Cleanup:** Revert.
**Risk Notes:** Errors toasted in both page handler and dialog. OK.

---

## Form: drawing_area_delete
**Title:** Delete Drawing Area (confirm)
**URL Path:** `/67/drawings/areas`
**How to Open:** Area selector delete → `useConfirm` dialog (page) OR `DrawingAreaCard` delete → AlertDialog.
**Submit Action:** `deleteArea.mutateAsync(id)` → DELETE `/drawings/areas/{areaId}`.
**Success Criteria**
- [ ] Confirm dialog shown; area removed; toast success
- [ ] Area with drawings is blocked (AlertDialog disables delete when `drawing_count > 0`)
**Cleanup:** none.
**Risk Notes:** Has confirm + DELETE — OK. Two delete paths (page `useConfirm` vs `DrawingAreaCard` AlertDialog) — test whichever is wired in the selector.

---

## Form: drawing_distribute 🚩🚩
**Title:** Distribute Drawing
**URL Path:** `/67/drawings/{drawingId}` (detail page) — **Distribute** action.
**Component:** `frontend/src/components/drawings/DrawingDistributeDialog.tsx`
**How to Open:** Drawing detail page → Distribute button (`setShowDistributeDialog(true)`).
**Fields:** To (text, req, comma-separated emails), Subject (text, prefilled), Message (textarea), Include download link (checkbox).
**Submit Action:** **STUB** — `await new Promise(setTimeout 500)` then `toast.success("Distribution sent successfully")`. No API call.
**Success Criteria**
- [ ] (currently) dialog closes + success toast — but NOTHING is actually sent
**Cleanup:** none.
**Risk Notes:** 🚩🚩 (3) **FALSE SUCCESS** — handler fakes success with no backend. Comment `// TODO: wire to email API when available`. No `/drawings/{id}/distribute` route exists. This is a silent-failure / lies-to-user surface — must be flagged loudly per CLAUDE.md "never ship silent failures". Either disable the button or wire a real endpoint.

---

## Form: drawing_detail_edit
**Title:** Inline edit on drawing detail
**URL Path:** `/67/drawings/{drawingId}`
**How to Open:** Detail page → Edit (`handleStartEdit`).
**Fields:** drawing_number, title, discipline (select), drawing_type (select).
**Submit Action:** `updateDrawing.mutateAsync({ drawingId, data })` → PATCH `/drawings/{id}`.
**Success Criteria**
- [ ] Fields pre-fill from drawing; values persist after Save; edit mode exits
**Cleanup:** Revert.
**Risk Notes:** Errors routed through `reportNonCriticalFailure` (not swallowed). OK.

---

## Form: drawing_detail_revision_number_edit
**Title:** Change drawing/revision number (inline, per revision row)
**URL Path:** `/67/drawings/{drawingId}`
**How to Open:** Revision row ⋯ → "Change drawing number" → inline input.
**Fields:** revision_number (text).
**Submit Action:** raw `apiFetch` PATCH `/drawings/{id}/revisions/{revisionId}`. Enter saves, Escape cancels.
**Success Criteria**
- [ ] Revision number updates in table; toast "Revision number updated"
**Cleanup:** Revert.
**Risk Notes:** Try/catch toasts on failure — OK. Uses raw `apiFetch` (allowed — it's the api-client wrapper).

---

## Form: drawing_detail_delete
**Title:** Delete drawing (detail page confirm)
**URL Path:** `/67/drawings/{drawingId}`
**How to Open:** Detail page → Delete (`setShowDeleteDialog`).
**Submit Action:** `deleteDrawing.mutate(drawingId)` → DELETE `/drawings/{id}` (soft delete).
**Success Criteria**
- [ ] Confirm shown; drawing deleted; redirect/leave detail
**Cleanup:** Restore or leave.
**Risk Notes:** Confirm + DELETE — OK.

---

## Form: drawing_link_pin 🚩
**Title:** Add Link to Drawing (pin modal — multi-type)
**URL Path:** `/67/drawings/viewer/{drawingId}`
**Component:** `frontend/src/components/drawings/LinkPinModal.tsx`
**How to Open:** Drawing viewer → pin tool → click on drawing → modal opens at clicked position.
**Sub-forms (one per pin type):**
| Type | Mode(s) | Fields / Source | Create path |
|---|---|---|---|
| RFI | link / create | search `useRfis`; create via `RfiFormFields` (reuses canonical RFI create) | `useCreateRfi` then pin |
| Punch Item | link / create | search `usePunchItems`; create via `PunchItemFormFields` | `useCreatePunchItem` then pin |
| Drawing | link | `useDrawings({page_size:300})` command search | pin only |
| Photo | link / upload | `usePhotos` (link) or file input + `useUploadPhotos` (upload&link) | pin |
| Coordination Issue | create | Title (req) + Description; stored as pin draft only | pin (no dedicated table) |
| Task | create | Title (req) | pin (no dedicated table) |

**Submit Action:** each → `onConfirm(CreatePinInput)` → caller `createPin.mutateAsync` → POST `/drawings/{id}/pins`.
**Success Criteria**
- [ ] Pin appears on drawing at clicked coords; shows in DrawingLinksPanel grouped by type
- [ ] RFI/Punch create-tab actually creates the entity AND the pin
- [ ] Photo upload&link uploads then links
**Cleanup:** Delete pin (DrawingLinksPanel trash) and any created RFI/punch/photo.
**Risk Notes:** 🚩 (1) RFI create uses `useCreateRfi(projectIdNum)` and Punch uses `useCreatePunchItem` — verify their dropdown FK sources (assignee/spec/etc.) match per FORM-FK-VALIDATION-GATE; these reuse canonical forms so risk is inherited, not new. Coordination Issue / Task have NO backing table (pin draft_data only) — "Place Pin" succeeds but creates no real record; confirm that's intended, not a silent failure.

---

## Other mutating surfaces (non-form, no confirm dialog) — verify but lower priority

- **drawing_publish_toggle** — `publishDrawing.mutate({drawingId, publish})` → POST `/drawings/{id}/publish`. Row-action + detail. No confirm (toggle).
- **drawing_obsolete_toggle** — `obsoleteDrawing.mutate({drawingId, obsolete})` → POST `/drawings/{id}/obsolete`. No confirm (toggle).
- **drawing_subscription_toggle** — `toggleDrawingSubscription.mutate(checked)` → `/drawings/subscribe`. Switch in header.
- **drawing_related_items (panel)** — `DrawingRelatedItemsPanel`: **Link Related Item** dialog (Item Type select + raw **Item ID UUID text input** 🚩 — user must paste a UUID, no entity picker → FK source mismatch / UX trap) → `useAddRelatedItem` POST `/drawings/{id}/related-items`. Remove has AlertDialog confirm → `useRemoveRelatedItem` DELETE. 🚩 (1) the "Item ID" free-text UUID field is the dropdown-vs-FK gap manifest: no validation the UUID is a real rfi/submittal/etc.
- **drawing_sketch_upload** — `DrawingSketchPanel`: file input + optional name → `useAddSketch` (FormData) POST `/drawings/{id}/revisions/{revId}/sketches`. Delete sketch has AlertDialog confirm → `useDeleteSketch` DELETE. ⚠️ uses `alert()` for validation errors (not toast) — minor.
- **drawing_pin_delete** — DrawingLinksPanel trash → `deletePin.mutate(id)` DELETE `/drawings/{id}/pins/{pinId}`. **No confirm dialog** 🚩 (2) — single-click destructive delete of a link/pin.
- **drawing_bulk_status** — API `/drawings/bulk-status` exists; verify if any UI calls it (bulk edit currently uses per-item PATCH, not this route).

---

## Summary of flagged risks
- **drawing_distribute** 🚩🚩 — fake success, no backend (silent failure). Highest priority.
- **drawing_related_items link** 🚩 — raw UUID paste field, no entity picker / FK validation.
- **drawing_pin_delete** 🚩 — destructive, no confirmation.
- **drawing_upload / edit** 🚩 — verify `area_id`/`drawing_set_id` FK pre-fill + that upload has no area picker but sends area_id.
- **link_pin coordination_issue / task** — "success" creates no real record (pin draft only).
- **drawing_set_edit_inline** — pencil icon (guardrail violation).
- **sets page** — no set-delete UI (cleanup gap); raw Table primitives.
