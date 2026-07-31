# Direct Costs — Dead Code Removal Report

**Date:** 2026-06-14
**Scope:** `frontend/src/components/direct-costs/**`, `frontend/src/app/(main)/[projectId]/direct-costs/direct-costs-client.tsx`

---

## What Was Deleted

### Files deleted (11 files + 1 empty directory)

| File | Grep evidence of zero consumers |
|------|--------------------------------|
| `components/direct-costs/CreateDirectCostForm.tsx` | `grep -rn "CreateDirectCostForm" frontend/src` → only `index.ts` re-export. Zero live mounts. |
| `components/direct-costs/DirectCostForm.tsx` | `grep -rn "DirectCostForm" frontend/src` → only `index.ts` re-export + one changelog string literal in `(admin)/updates/page.tsx:219` (not an import). Zero live mounts. |
| `components/direct-costs/LineItemsManager.tsx` | Only imported by `DirectCostForm.tsx` (now deleted). |
| `components/direct-costs/AttachmentManager.tsx` | Only imported by `DirectCostForm.tsx` (now deleted). |
| `components/direct-costs/AutoSaveIndicator.tsx` | Only imported by `DirectCostForm.tsx` (now deleted). |
| `components/direct-costs/form-options.ts` | Only imported by `DirectCostForm.tsx` (now deleted). |
| `components/direct-costs/__tests__/form-options.test.ts` | Only tested `form-options.ts` (now deleted). Directory also removed. |
| `components/direct-costs/DirectCostsImportDialog.tsx` | `grep -rn "DirectCostsImportDialog" frontend/src` → zero results (not even `index.ts`). |
| `components/direct-costs/BulkActionsToolbar.tsx` | `grep -rn "BulkActionsToolbar" frontend/src` → only `index.ts` re-export. Zero live mounts. |
| `components/direct-costs/FiltersPanel.tsx` | `grep -rn "FiltersPanel" frontend/src` → only `index.ts` re-export + own file. Zero live mounts. |
| `components/direct-costs/DirectCostSummaryCards.tsx` | `grep -rn "DirectCostSummaryCards" frontend/src` → only `index.ts` re-export + own file. Zero live mounts. |

### `components/direct-costs/index.ts` — stripped to live exports only

Before: re-exported all 9 dead components plus `ExportDialog`.
After: re-exports only `ExportDialog` (the only live component consumed outside the directory).

### `direct-costs-client.tsx` — removed dead state + handlers

Removed:
- State: `deleteDialogOpen`, `directCostToDelete`, `editingCostId`, `isEditSheetOpen`, `isEditLoading`, `editingInitialData`, `updatingStatusId`, `bulkAction`
- Handlers: `handleDeleteConfirm`, `handleOpenEdit`, `handleCloseEditSheet`, `handleEditSuccess`, `handleInlineStatusChange`, `runBulkStatusUpdate`, `runBulkDelete`, `executeBulkAction`
- Imports: `Plus` (lucide-react), `apiFetchRaw`, `type DirectCostUpdate`
- Header action: "Add Direct Cost" button that navigated to the read-only `/new` stub

Evidence: All removed handlers called 405 endpoints (`DELETE /direct-costs/[id]`, `PUT /direct-costs/[id]`, `POST /direct-costs/bulk`). None were wired to any UI trigger — `onBulkDelete: undefined` in the toolbar, row actions menu rendered only "View", no delete dialog mounted, no edit sheet mounted.

---

## What Was Kept

- `components/direct-costs/ExportDialog.tsx` — live, used by `direct-costs-client.tsx`
- `app/(main)/[projectId]/direct-costs/new/page.tsx` — kept as the read-only stub (correctly tells users this tool is read-only)
- `app/api/projects/[projectId]/direct-costs/*.ts` — all API routes kept including 405 guards
- `lib/schemas/direct-costs.ts` — used by API routes (GET list, GET export) and remaining client code
- `lib/services/direct-cost-service.ts` — used by API routes
- `app/api/sync/acumatica/direct-costs/route.ts` — the only working write path (ERP sync)

---

## Verification

```
npx tsc --noEmit 2>&1 | grep -i "direct.cost"  → (empty — zero new errors)
npx eslint direct-costs-client.tsx index.ts     → (empty — zero warnings)
grep -rn "DirectCostForm|CreateDirectCostForm|DirectCostsImportDialog|BulkActionsToolbar|FiltersPanel|DirectCostSummaryCards|LineItemsManager|AttachmentManager|AutoSaveIndicator|form-options" frontend/src
  → only: (admin)/updates/page.tsx:219 — changelog string literal, not an import
```

Pre-existing type errors: 19 errors in `executive-brief-tools.ts`, AI orchestrator, invoicing, directory, commitments — all pre-existed before this change.
