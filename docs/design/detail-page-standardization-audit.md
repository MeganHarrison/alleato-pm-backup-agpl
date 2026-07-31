# Detail Page Standardization Audit

Generated from `frontend/src/app/(main)/[projectId]` detail routes.

Scope:
- Includes project record detail pages.
- Excludes list/table pages, create pages, edit pages, drawing viewers, meeting prep, and source-document drilldowns.

Status definitions:
- `Updated`: currently uses the shared detail-page shell pattern and does not trip the detail primitive guardrail.
- `Partial`: uses at least one shared primitive, but still has page-local or legacy detail styling to remove.
- `Needs update`: still needs to be moved onto the shared detail primitives.

| Page | Status | Review Link | Current Gap |
| --- | --- | --- | --- |
| Change Event detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/page.tsx) | Uses shared detail shell; General Information now uses `DetailFieldGrid` while the financial summary stays on `LabelValueRow`. |
| Commitment Change Order detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx) | Uses shared detail shell and `DetailPanel` for the key dates summary. |
| Prime Change Order detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/change-orders/prime/[primeCoId]/page.tsx) | Updated to shared `PageShell`, `PageTabs`, `DetailPanel`, and `ErrorState`; General Information now uses `DetailFieldGrid` while Financial Summary and Key Dates remain compact ledger rows. |
| Commitment PCO detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/commitment-pcos/[pcoId]/page.tsx) | Uses shared detail shell, `PageTabs`, and `ErrorState`. |
| Subcontract invoice detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/invoices/[invoiceId]/page.tsx) | Delegates to the shared `SubcontractorInvoiceDetail` detail shell; active Summary metadata now uses `DetailFieldGrid`. |
| Commitment detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx) | Uses shared `PageTabs`; General Information now uses `DetailFieldGrid` while financial summaries remain compact ledger rows. |
| Direct Cost detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx) | Uses shared detail shell, `DetailPanel`, `InlineTable`, and `apiFetch`. |
| Document detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/documents/[documentId]/page.tsx) | Specialized preview route delegates to `ProjectDocumentPreviewClient`, which uses shared `PageShell` content structure. |
| Drawing detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/drawings/[drawingId]/page.tsx) | Uses shared detail shell, `PageTabs`, and `InlineTable` for revisions. |
| Estimate detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/estimates/[estimateId]/page.tsx) | Delegates to `EstimateDetailClientV2`, which uses shared `PageShell` and `PageTabs`; wrapper uses shared `ErrorState`. |
| Owner invoice detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/invoicing/[invoiceId]/page.tsx) | Uses shared detail shell and shared inline table primitives for the SOV table. |
| Subcontractor invoice detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/invoicing/subcontractor/[invoiceId]/page.tsx) | Delegates to the shared `SubcontractorInvoiceDetail` detail shell; active Summary metadata now uses `DetailFieldGrid`. |
| Meeting detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx) | Delegates to `MeetingDetailContent`, now on shared `PageShell` detail structure. |
| Legacy PCO detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/pcos/[pcoId]/page.tsx) | Uses shared detail shell, `PageTabs`, `ErrorState`, and `apiFetch` for conversion. |
| Prime Contract PCO detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/page.tsx) | Uses shared detail shell and `ErrorState`; General Information now uses `DetailFieldGrid`. |
| Prime Contract nested PCO detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/change-orders/pcos/[pcoId]/page.tsx) | Re-exports the updated Prime Contract PCO detail implementation. |
| Prime Contract invoice detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/invoices/[invoiceId]/page.tsx) | Uses shared detail shell and `PageTabs`. |
| Prime Contract detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx) | Uses shared detail shell and `PageTabs`; keep in visual regression queue because file has unrelated dirty work. |
| Progress Report detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/progress-reports/[reportId]/page.tsx) | Uses shared detail shell. |
| Punch List item detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/punch-list/[punchItemId]/page.tsx) | Uses shared detail shell. |
| RFI detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx) | Uses shared detail shell. |
| Specification section detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/specifications/[sectionId]/page.tsx) | Uses shared detail shell. |
| Submittal detail | Updated | [page.tsx](../../frontend/src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx) | Delegates to `SubmittalDetailClient`, which uses shared detail shell and `PageTabs`. |

## Guardrail Enforcement

- `npm run guardrails:detail-pages` now always scans the audited detail-page inventory, including delegated implementation files for routes whose page file hands off the actual detail UI.
- Delegated owners are checked for shared `PageShell` usage and raw tab/style drift, so thin wrapper routes do not create false confidence.
- The guardrail still includes changed dynamic project routes as a compatibility safety net while the audited inventory remains the source of truth for these detail pages.
- Page-local `DetailField` helpers are forbidden. Use shared `DetailField` / `DetailFieldGrid` for general read-only metadata.

## Label/Value Primitive Ownership

- `DetailField` / `DetailFieldGrid` is the default for read-only record metadata: general information, IDs, dates, vendor/contact info, audit fields, and ordinary responsive label/value grids.
- `LabelValueRow` remains valid for row-scanned panels where horizontal label alignment matters: financial summaries, compact key-date blocks, side panels, and detail panels that read like a vertical ledger.
- Do not introduce a third label/value pattern. If a page needs label/value display, choose one of those two primitives based on layout semantics.
- Direct Cost detail now follows this split: Cost Information uses `DetailFieldGrid`; Record Information remains a compact `DetailPanel` with `LabelValueRow`.

## Recommended Next Steps

1. Add real-record browser screenshots for each module group so the audit has visual evidence beyond static guardrails and error-state checks.
2. Continue moving repeated general metadata layouts onto shared `DetailField` / `DetailFieldGrid`; keep `LabelValueRow` for compact row-scanned financial/key-date panels.
3. Add this guardrail to the finish/check path if it is not already included in the targeted Codex finish checks.
