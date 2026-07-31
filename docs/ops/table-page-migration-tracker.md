# Table Page Migration Tracker

Last updated: 2026-06-14

This tracks user-facing table pages that have been moved to the shared
`UnifiedTablePage` pattern or deliberately reviewed against that pattern.
It is intentionally scoped to app pages and reusable table tabs, not PDF exports,
email templates, admin diagnostics, or small read-only detail-page tables.

## Updated / Reviewed

| Area                 | Route / Surface                             | Status  | Notes                                                                                                           |
| -------------------- | ------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| Directory            | `/directory/companies`                      | Updated | Unified table page with shared toolbar and inline edit behavior.                                                |
| Directory            | `/directory/contacts`                       | Updated | Unified table page with inline-edit-focused row behavior.                                                       |
| Directory            | `/directory/vendors`                        | Updated | Unified table page.                                                                                             |
| Directory            | `/directory/employees`                      | Updated | Unified table page.                                                                                             |
| Directory            | `/directory/groups`                         | Updated | Unified table page.                                                                                             |
| Directory            | `/directory/prospects`                      | Updated | Unified table page.                                                                                             |
| Directory            | `/[projectId]/directory`                    | Updated | Project-scoped directory migrated from old table sections.                                                      |
| Files                | `/files`                                    | Updated | Unified table page.                                                                                             |
| Drawings             | `/drawings`                                 | Updated | Shared table/list handling reviewed during table migration batch.                                               |
| Stats                | `/stats` All Meetings                       | Updated | Raw meetings table replaced with `UnifiedTablePage`.                                                            |
| Change Orders        | `/[projectId]/change-orders`                | Updated | Already on `UnifiedTablePage`; dead selection checkboxes removed because bulk delete is not wired.              |
| Change Events / RFQs | `/[projectId]/change-events?tab=rfqs`       | Updated | RFQ tab runs through the shared Change Events `UnifiedTablePage`; selection is backed by send-RFQ/bulk actions. |
| Invoices             | `/[projectId]/invoices` Owner               | Updated | Already on `UnifiedTablePage`; dead selection checkboxes removed.                                               |
| Invoices             | `/[projectId]/invoices?tab=subcontractor`   | Updated | Already on `UnifiedTablePage`; dead selection checkboxes removed.                                               |
| Invoices             | `/[projectId]/invoices?tab=billing-periods` | Updated | Already on `UnifiedTablePage`; dead selection checkboxes removed.                                               |
| Payments             | Reusable invoice payments tab               | Updated | Raw payments table replaced with `UnifiedTablePage`; currently not mounted by the canonical invoices route.     |
| Payments             | Prime contract Payments Received tab        | Updated | Old `DataTable` replaced with compact `UnifiedTablePage`.                                                       |
| Payments             | Commitment Payments Issued tab              | Updated | Old `DataTable` replaced with compact `UnifiedTablePage`.                                                       |
| RFQs                 | Commitment RFQs tab                         | Updated | Old `DataTable` replaced with compact `UnifiedTablePage`.                                                       |
| RFIs                 | `/[projectId]/rfis`                         | Updated | Old `AleatoDataTable`/`useDataTable` page replaced with `UnifiedTablePage`.                                     |
| Daily Logs           | `/daily-logs`                               | Updated | Old `GenericDataTable` page replaced through the shared generic-config `UnifiedTablePage` adapter.              |
| Meeting Segments     | `/meeting-segments`                         | Updated | Old `GenericDataTable` page replaced through the shared generic-config `UnifiedTablePage` adapter.              |
| Daily Reports        | `/daily-reports`                            | Updated | Old `GenericDataTable` page replaced through the shared generic-config `UnifiedTablePage` adapter.              |
| AI Insights          | `/insights`                                 | Updated | Old `GenericDataTable` page replaced through the shared generic-config `UnifiedTablePage` adapter.              |
| FM Global            | `/fm-global` table and figure tabs          | Updated | Old embedded `GenericDataTable` tabs replaced through the shared generic-config `UnifiedTablePage` adapter.     |
| FM Global            | `/fm-global/fm_global_tables`               | Updated | Old `GenericDataTable` page replaced through the shared generic-config `UnifiedTablePage` adapter.              |

## Remaining Candidate Batches

| Area                | Route / Surface                        | Next Action                                                                                     |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Drawings Helpers    | Deprecated `DrawingLogTable` component | Leave parked unless a mounted route still uses it; canonical drawing routes use unified config. |
| Admin / Debug       | Admin diagnostics and database tools   | Treat as separate low-priority batch; many raw tables are intentional inspection surfaces.      |
| Detail / Line Items | SOV, invoice lines, change-event lines | Do not force into `UnifiedTablePage`; use the canonical line-item table primitive instead.      |

## Guardrails

- Use `UnifiedTablePage` from `@/components/tables/unified`.
- Do not pass `selection` or `selectedCount` unless a visible bulk action is wired.
- Use the table toolbar for search, filters, column visibility, and export.
- Header actions should stay limited to the primary create/add action.
- Prefer shared table config files for columns and filters.
