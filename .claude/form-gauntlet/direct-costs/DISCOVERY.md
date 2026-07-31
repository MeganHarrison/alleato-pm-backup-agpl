# Form Gauntlet — Direct Costs Discovery

**Tool:** direct-costs
**Project for testing:** 67 → `/67/direct-costs`
**Discovered:** 2026-06-13

## CRITICAL CONTEXT — Direct Costs is a READ-ONLY tool

Every **write** API route for direct-costs intentionally throws `READ_ONLY_RESOURCE` (HTTP 405):

| Route | Methods | Behavior |
|-------|---------|----------|
| `app/api/projects/[projectId]/direct-costs/route.ts` | GET ✅, **POST ❌ 405** | POST always throws "read-only…sync from Acumatica" |
| `app/api/projects/[projectId]/direct-costs/[costId]/route.ts` | GET ✅, **PUT ❌ 405**, **DELETE ❌ 405** | PUT/DELETE always throw read-only |
| `app/api/projects/[projectId]/direct-costs/bulk/route.ts` | **POST ❌ 405** | bulk status-update + delete both blocked |
| `app/api/projects/[projectId]/direct-costs/export/route.ts` | POST ✅ | export works (CSV/Excel/PDF) |

Data is synced from Acumatica via `POST /api/sync/acumatica/direct-costs` (the ERP sync button), not created/edited in-app.

Because of this, **most "forms" in the codebase are dead code against blocked endpoints.** Only one form is actually reachable AND backed by a working endpoint: **ExportDialog**.

---

## Form: export_dialog  ← ONLY LIVE FORM

- **Title:** Export Direct Costs
- **URL Path:** `/67/direct-costs`
- **How to Open:** Click the export (download) icon in the table toolbar — `onExport: () => setIsExportDialogOpen(true)` in `direct-costs-client.tsx`. Mounted at the bottom of the same file.
- **Component:** `frontend/src/components/direct-costs/ExportDialog.tsx`

### Fields
| Field | Type | Options / Notes |
|-------|------|-----------------|
| Export Format | RadioGroup | csv (default) / excel / pdf |
| Template | RadioGroup | standard (default) / accounting / summary |
| Include line items | Checkbox | default checked |

### Submit Action
- `POST /api/projects/67/direct-costs/export` via `apiFetchBlob` with `{ format, template, include_line_items, filters: {} }`.
- On success: triggers browser download `direct-costs-YYYY-MM-DD.{ext}`, toast "Direct costs exported as CSV/EXCEL/PDF", closes dialog.
- `selectedCostIds` is passed to the component for the scope label but is **NOT sent in the request body** (filters is always `{}`). The export ignores selection — known minor gap, not a blocker.

### Success Criteria
- [ ] Dialog opens from toolbar export icon
- [ ] File downloads with correct extension for chosen format
- [ ] Success toast appears
- [ ] Dialog closes after export
- [ ] No console errors

### Cleanup
None — export produces a downloaded file only, no DB writes. Delete the downloaded file if desired.

### Risk Notes
- 🚩 LOW: Export scope label says "N selected costs" but body sends `filters: {}` and no IDs — export always returns all rows regardless of selection. Misleading but not a crash.
- Error path: `catch` shows generic `toast.error("Failed to export direct costs")` and swallows the real error (no message surfaced). Minor — violates "no generic errors" but non-blocking.

---

## Form: erp_sync (action, not a classic form)

- **Title:** Sync direct costs from Acumatica
- **URL Path:** `/67/direct-costs`
- **How to Open:** RefreshCw icon button in toolbar `customActions`.
- **Submit Action:** `POST /api/sync/acumatica/direct-costs` with `{ projectId }`. Toast with created/updated counts, `router.refresh()`.
- **Success Criteria:** [ ] toast shows "ERP sync complete: X created, Y updated" [ ] table refreshes.
- **Cleanup:** None (idempotent sync). May create/update rows from Acumatica.
- **Risk Notes:** Depends on live Acumatica connectivity. Not a user-input form. Out of normal gauntlet scope but the only working write path.

---

## ORPHANED / DEAD FORMS (do not test as live — endpoints are 405 and/or unmounted)

These exist in the codebase but are **not reachable** from the live direct-costs UI, and/or submit to blocked read-only endpoints. Flagging for cleanup, not for gauntlet execution.

### Form: create_edit_direct_cost_form  🚩 DEAD
- **Component:** `frontend/src/components/direct-costs/DirectCostForm.tsx` (+ wrapper `CreateDirectCostForm.tsx`)
- **Intended URL:** `/67/direct-costs/new` — but that page (`new/page.tsx`) is now a **read-only stub** ("Direct Costs Are Read-Only") and does NOT mount the form.
- **Importers of `CreateDirectCostForm`: NONE.** Importers of `DirectCostForm` (excluding its own dir): only `app/(admin)/updates/page.tsx` (changelog reference, not a live mount).
- **Submit:** create → `POST /direct-costs` (405); edit/auto-save → `PUT /direct-costs/[costId]` (405). Both fail by design.
- 🚩 **Risk:** Full RHF + Zod form with vendor/employee comboboxes, line-item field array, 30s auto-save, budget-code modal — all wired to dead endpoints. If ever re-mounted it would let users fill a form and then fail on submit with a generic `toast.error("Failed to save direct cost")` (error swallowed — onSubmit catch discards the real message). FK-mismatch handling for `vendor_id` (FK→companies, dropdown→vendors) IS present (`buildVendorOptions` + `selectedLabel` guardrail in `form-options.ts`) so the "Select…" regression is defended against — but moot while endpoints are 405.
- **Recommendation:** dead code; candidate for deletion or gating behind a feature flag.

### Form: csv_import_dialog  🚩 DEAD
- **Component:** `frontend/src/components/direct-costs/DirectCostsImportDialog.tsx`
- **Importers: NONE.** Not mounted anywhere.
- **Submit:** loops rows → `POST /direct-costs` per row (all 405). Would report "No rows imported" for every file.
- 🚩 **Risk:** Fully built CSV importer (header detection, vendor/employee/budget-code resolution, fallback selects) pointed at a blocked endpoint. Dead code.

### Per-row Delete + Bulk actions  🚩 DEAD (handlers exist, UI not wired)
- **Location:** `direct-costs-client.tsx` — `handleDeleteConfirm`, `runBulkDelete`, `runBulkStatusUpdate`, `executeBulkAction`, edit-sheet state (`isEditSheetOpen`, `handleOpenEdit`, `handleInlineStatusChange`).
- These handlers are defined but **NOT reachable from the UI**: row actions menu only renders "View"; `onBulkDelete: undefined`; no edit sheet is rendered; no delete confirm dialog is rendered (state `deleteDialogOpen` / `directCostToDelete` is never set true by any control).
- 🚩 **Risk:** Significant dead state + handlers. `handleDeleteConfirm` calls `DELETE /direct-costs/[costId]` (405) → would toast "Failed to delete direct cost". Bulk handlers POST to `/bulk` (405). None of it is wired to a trigger, so users can't invoke it, but it's confusing dead code. Note: delete handler IS guarded by a confirm-dialog pattern in state (good), but the dialog itself isn't rendered.
- **Recommendation:** remove dead edit/delete/bulk handlers and state, or finish wiring only if direct-costs becomes writable.

---

## Summary for executor

Run the gauntlet against **ONE** live form: `export_dialog`. Optionally smoke `erp_sync` (requires Acumatica). Everything else is read-only-blocked dead code — flag for cleanup, do not attempt create/edit/delete/import test flows (they will 405 by design, which is correct behavior, not a bug).
