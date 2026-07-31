# Detail-Page Inventory

Last verified: 2026-07-16

This is the source-of-truth inventory of record-detail routes in the frontend. A detail page is a route that resolves one identifiable business record; create, edit, list, configuration, dashboard, and scoped sub-view routes are listed separately so they are not mistaken for independent record templates.

## Shared template adoption

| Shared owner | Current consumers |
| --- | --- |
| `frontend/src/components/layout/record-detail-page.tsx` (`RecordDetailPage`) | Punch item; Direct cost |

## Project-scoped record details

| Record | Canonical route | Route owner | Notes |
| --- | --- | --- | --- |
| Billing period | `/:projectId/billing-periods/:periodId` | `frontend/src/app/(main)/[projectId]/billing-periods/[periodId]/page.tsx` | Record detail |
| Change event | `/:projectId/change-events/:changeEventId` | `frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/page.tsx` | Record detail |
| Commitment change order | `/:projectId/change-orders/commitment/:commitmentCoId` | `frontend/src/app/(main)/[projectId]/change-orders/commitment/[commitmentCoId]/page.tsx` | Record detail |
| Prime change order | `/:projectId/change-orders/prime/:primeCoId` | `frontend/src/app/(main)/[projectId]/change-orders/prime/[primeCoId]/page.tsx` | Record detail |
| Commitment PCO | `/:projectId/commitment-pcos/:pcoId` | `frontend/src/app/(main)/[projectId]/commitment-pcos/[pcoId]/page.tsx` | Record detail |
| Commitment | `/:projectId/commitments/:commitmentId` | `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/page.tsx` | Record detail |
| Commitment invoice | `/:projectId/commitments/:commitmentId/invoices/:invoiceId` | `frontend/src/app/(main)/[projectId]/commitments/[commitmentId]/invoices/[invoiceId]/page.tsx` | Nested record detail |
| Direct cost | `/:projectId/direct-costs/:costId` | `frontend/src/app/(main)/[projectId]/direct-costs/[costId]/page.tsx` | Uses `RecordDetailPage` |
| Document | `/:projectId/documents/:documentId` | `frontend/src/app/(main)/[projectId]/documents/[documentId]/page.tsx` | Record detail |
| Drawing | `/:projectId/drawings/:drawingId` | `frontend/src/app/(main)/[projectId]/drawings/[drawingId]/page.tsx` | Record detail |
| Estimate | `/:projectId/estimates/:estimateId` | `frontend/src/app/(main)/[projectId]/estimates/[estimateId]/page.tsx` | Record detail |
| Project intelligence source | `/:projectId/intelligence/sources/:sourceDocumentId` | `frontend/src/app/(main)/[projectId]/intelligence/sources/[sourceDocumentId]/page.tsx` | Source-record detail |
| Owner invoice | `/:projectId/invoicing/:invoiceId` | `frontend/src/app/(main)/[projectId]/invoicing/[invoiceId]/page.tsx` | Record detail |
| Subcontractor invoice | `/:projectId/invoicing/subcontractor/:invoiceId` | `frontend/src/app/(main)/[projectId]/invoicing/subcontractor/[invoiceId]/page.tsx` | Record detail |
| Meeting | `/:projectId/meetings/:meetingId` | `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx` | Record detail; has scoped companion views below |
| PCO | `/:projectId/pcos/:pcoId` | `frontend/src/app/(main)/[projectId]/pcos/[pcoId]/page.tsx` | Record detail |
| Prime-contract PCO | `/:projectId/prime-contract-pcos/:pcoId` | `frontend/src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/page.tsx` | Record detail |
| Prime contract | `/:projectId/prime-contracts/:contractId` | `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx` | Canonical legacy detail-page reference |
| Prime-contract PCO | `/:projectId/prime-contracts/:contractId/change-orders/pcos/:pcoId` | `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/change-orders/pcos/[pcoId]/page.tsx` | Nested record detail |
| Prime-contract invoice | `/:projectId/prime-contracts/:contractId/invoices/:invoiceId` | `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/invoices/[invoiceId]/page.tsx` | Nested record detail |
| Progress report | `/:projectId/progress-reports/:reportId` | `frontend/src/app/(main)/[projectId]/progress-reports/[reportId]/page.tsx` | Record detail |
| Punch item | `/:projectId/punch-list/:punchItemId` | `frontend/src/app/(main)/[projectId]/punch-list/[punchItemId]/page.tsx` | Uses `RecordDetailPage` through `punch-item-detail.tsx` |
| RFI | `/:projectId/rfis/:rfiId` | `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/page.tsx` | Record detail |
| Specification section | `/:projectId/specifications/:sectionId` | `frontend/src/app/(main)/[projectId]/specifications/[sectionId]/page.tsx` | Record detail |
| Submittal | `/:projectId/submittals/:submittalId` | `frontend/src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx` | Record detail |

## Global and table-scoped record details

| Record | Canonical route | Route owner | Notes |
| --- | --- | --- | --- |
| Feature request | `/ai/feature-requests/:requestId` | `frontend/src/app/(main)/ai/feature-requests/[requestId]/page.tsx` | Global record detail |
| Company | `/directory/companies/:companyId` | `frontend/src/app/(main)/directory/companies/[companyId]/page.tsx` | Global record detail |
| Contact | `/directory/contacts/:contactId` | `frontend/src/app/(main)/directory/contacts/[contactId]/page.tsx` | Global record detail |
| Vendor | `/directory/vendors/:vendorId` | `frontend/src/app/(main)/directory/vendors/[vendorId]/page.tsx` | Global record detail |
| FM Global submission | `/fm-global/submissions/:submissionId` | `frontend/src/app/(main)/fm-global/submissions/[submissionId]/page.tsx` | Global record detail |
| Intelligence source | `/intelligence/sources/:sourceDocumentId` | `frontend/src/app/(main)/intelligence/sources/[sourceDocumentId]/page.tsx` | Global source-record detail |
| Daily brief | `/daily-briefs/:briefId` | `frontend/src/app/(tables)/daily-briefs/[briefId]/page.tsx` | Table-scoped record detail |
| Daily log | `/daily-logs/:dailyLogId` | `frontend/src/app/(tables)/daily-logs/[dailyLogId]/page.tsx` | Table-scoped record detail |
| Insight | `/insights/:insightId` | `frontend/src/app/(tables)/insights/[insightId]/page.tsx` | Table-scoped record detail |
| Meeting | `/meetings/:meetingId` | `frontend/src/app/(tables)/meetings/[meetingId]/page.tsx` | Table-scoped record detail |
| Teams conversation/source | `/teams-conversations/:sourceDocumentId` | `frontend/src/app/(tables)/teams-conversations/[sourceDocumentId]/page.tsx` | Table-scoped source detail |

## Admin and operations record details

| Record | Canonical route | Route owner | Notes |
| --- | --- | --- | --- |
| Procore tool | `/admin/procore-tools/:slug` | `frontend/src/app/(admin)/(procore)/procore-tools/[slug]/page.tsx` | Admin tool detail |
| Support article | `/admin/support-articles/:articleId` | `frontend/src/app/(admin)/(procore)/support-articles/[articleId]/page.tsx` | Admin content detail |
| Daily brief | `/admin/daily-briefs/:briefId` | `frontend/src/app/(admin)/admin/daily-briefs/[briefId]/page.tsx` | Admin record detail |
| Meeting template | `/admin/meeting-templates/:templateId` | `frontend/src/app/(admin)/meeting-templates/[templateId]/page.tsx` | Admin configuration detail |
| Test case | `/admin/testing/:tool/cases/:caseId` | `frontend/src/app/(admin)/testing/[tool]/cases/[caseId]/page.tsx` | Test artifact detail |
| Test run | `/admin/testing/runs/:runId` | `frontend/src/app/(admin)/testing/runs/[runId]/page.tsx` | Test-run detail |
| Test-run case | `/admin/testing/runs/:runId/case/:caseNumber` | `frontend/src/app/(admin)/testing/runs/[runId]/case/[caseNumber]/page.tsx` | Nested test artifact detail |
| Training document | `/admin/training-docs/:docId` | `frontend/src/app/(admin)/training-docs/[docId]/page.tsx` | Admin content detail |
| User-management template | `/admin/user-management/templates/:templateId` | `frontend/src/app/(admin)/user-management/templates/[templateId]/page.tsx` | Admin configuration detail |
| User | `/admin/user-management/users/:userSlug` | `frontend/src/app/(admin)/user-management/users/[userSlug]/page.tsx` | Admin identity detail |

## Detail-adjacent routes (not independent templates)

| Parent record | Route | Purpose |
| --- | --- | --- |
| Change event | `/:projectId/change-events/:changeEventId/edit` | Edit flow |
| Change order | `/:projectId/change-orders/:changeOrderId/edit` | Edit flow |
| Commitment | `/:projectId/commitments/:commitmentId/edit` | Edit flow |
| Daily log | `/:projectId/daily-log/:dailyLogId/edit` | Edit flow |
| Drawing | `/:projectId/drawings/viewer/:drawingId` and `viewer-v2/:drawingId` | Drawing viewers |
| Estimate | `/:projectId/estimates/:estimateId/edit` | Edit flow |
| Meeting | `/:projectId/meetings/:meetingId/agenda`, `/lineage`, `/prep` | Record sub-views |
| PCO | `/:projectId/pcos/:pcoId/edit` | Edit flow |
| Prime-contract PCO | `/:projectId/prime-contract-pcos/:pcoId/edit` | Edit flow |
| Prime contract | `/:projectId/prime-contracts/:contractId/edit` | Edit flow |
| Prime-contract PCO | `/:projectId/prime-contracts/:contractId/change-orders/pcos/:pcoId/edit` | Edit flow |
| Submittal | `/:projectId/submittals/:submittalId/edit` | Edit flow |

## Exclusions

This inventory excludes dynamic documentation/content routers (`[...slug]`, `[[...slug]]`, knowledge routes), public token-response pages, and generic route parameters such as `/:projectId`. Those routes resolve content, tools, configuration, or workflows rather than a product record-detail template.

## Maintenance rule

When a new record detail route is added, add it here in the same change. If it uses the shared record-detail contract, list `RecordDetailPage` in the Notes column; otherwise state the canonical existing owner and why the shared template does not fit yet.
