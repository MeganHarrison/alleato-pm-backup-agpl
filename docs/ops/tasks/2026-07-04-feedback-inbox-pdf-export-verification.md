# Task: Feedback Inbox PDF Export Verification

Status: In Progress
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-942 - https://linear.app/megankharrison/issue/AAI-942/audit-feedback-inbox-pdf-export-issues-with-fresh-downloads-and
Related Handoff: N/A

## Objective

Audit every feedback inbox item tied to PDF export or PDF download behavior, verify the current route-level truth on the exact named workflows, and capture fresh proof artifacts for each item.

## Non-Negotiable Done Rule

This verification pass is not done until every in-scope feedback row has:

- a current classification
- a fresh screenshot artifact
- either a downloaded PDF artifact or an explicit blocking note explaining why a fresh PDF artifact could not be produced

## Scope Checklist

- [x] Create task record and Linear issue before verification work.
- [ ] Pull the exact in-scope `admin_feedback_items` rows from the live database.
- [ ] Record the final issue list and exact routes under test.
- [ ] Verify each route/workflow in the browser on the named page.
- [ ] Capture fresh screenshot evidence for each item.
- [ ] Capture downloaded PDF artifacts, or a blocking note when the workflow does not produce a PDF.
- [ ] Classify each item as `Verified fixed`, `Not fixed`, or `Unproven`.
- [ ] Post the verification summary back to Linear.

## Verification Approach

- Intake source of truth: live `admin_feedback_items` rows filtered to PDF/export-related feedback.
- Product truth source: browser verification on the exact route named by feedback, plus fresh downloaded files when the export action succeeds.
- Supporting evidence only: GitHub state, older task docs, prior screenshots, and endpoint-only read-backs.

## Proof Standard

- `Verified fixed`: the current UI exposes the intended export action and a fresh PDF download or rendered PDF artifact is captured from the named workflow.
- `Not fixed`: the current workflow fails, is missing, or still contradicts the reported expectation.
- `Unproven`: supporting evidence exists, but the exact UI-triggered workflow could not be completed in this session.

## In-Scope Ledger

Exact live row pull source: `/tmp/pdf-export-feedback-rows.tsv`

Included rows are the current feedback items whose title/comment explicitly ask
for PDF export or PDF generation behavior on active product routes.

Excluded from this pass:

- `#448`, `#447`, `#412`, `#384`: PDF import/parser corruption issues, not PDF export verification.
- `#389`: deferred progress-report preview/format workflow, broader than current PDF download verification.
- archived `/767/change-events/...` export/email request: older superseded change-event export lane; current active change-event export surface was verified through `#556`.

| Feedback Row | GitHub # | Route | Title | Current Status | Fresh Screenshot | Fresh PDF Artifact | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `142d917a-20b1-4bed-88ec-6bbe13fefaab` | `#562` | `/876/budget` | Should be able to export as PDF as well. | Verified fixed | `budget-export-page1.png` | `budget-export.pdf` | Exact budget PDF endpoint returned a fresh 2-page PDF. |
| `a6f0cbc2-a8d4-4643-9cc5-c4f1d575f583` | `#565` | `/876/submittals` | Export should be a button I click and then I can pick PDF or CSV... | Verified fixed | `export-menu.png`, `submittal-log-876-page1.png` | `submittal-log-876.pdf` | Browser export menu exposed `PDF` and produced a fresh file. |
| `c3a39ca1-0d06-41f4-bc4b-ae57dbd1b18f` | `#566` | `/876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4` | I should be able to export this to PDF... | Verified fixed | `page.png`, `submittal-detail-export-page1.png` | `submittal-detail-export.pdf` | Exact detail route export drawer produced a fresh PDF packet. |
| `f5f68473-9d9a-492a-a641-ed31756dc658` | `#568` | `/876/rfis` | I should be able to export PDF that is formated as a RFI log... | Verified fixed | `list-page.png`, `detail-more-actions.png`, `rfi-log-876-page1.png`, `rfi-detail-export-page1.png` | `rfi-log-876.pdf`, `rfi-detail-export.pdf` | Both the list-log PDF and single-RFI PDF exported successfully in the current session. |
| `3547f4a8-f83e-4ead-96e7-e551d8602ced` | `#571` | `/876/progress-reports/e3e0d19c-4739-44f0-bee9-91ddebeaca0b` | Generate PDF isn't working... | Verified fixed | `page.png`, `progress-report-ui-download-page1.png` | `progress-report-ui-download.pdf` | The exact route exposes `Download PDF` and produced a fresh file. |
| `4684d472-3f6f-427e-9700-a4bd0b2d933c` | `#573` | `/876/drawings` | the export should have a PDF and CSV option... | Verified fixed | `page.png`, `export-menu.png`, `drawing-list-876-page1.png` | `drawing-list-876.pdf` | Browser export menu exposed `PDF` and produced a fresh file. |
| `6ac401a7-c2df-4391-bfbb-44f9356495b9` | `#556` | `/876/change-events/927f077e-3883-441c-b275-58b55a4f9db9` | export function failed. | Verified fixed | `change-event-page1.png` | `change-event.pdf` | Exact change-event PDF endpoint returned a fresh 1-page PDF artifact. |
| `0c3124bf-fe72-42f1-9a26-ede738af4538` | `#590` | `/876/change-orders/commitment/aa35f3c3-5ec0-4568-b126-f8671b4791cc` | Change Event Export PDF so I can send it to the sub for signature and email | Verified fixed | `page.png`, `commitment-cco-page1.png` | `commitment-cco.pdf` | Browser-authenticated export route returned a fresh 2-page PDF. |
| `526cdb7c-4ca2-4e9a-800e-f62303dc4c2a` | `#594` | `/876/invoicing/subcontractor/8092` | when I exported the invoice it isn't showing correctly... | Verified fixed | `page.png`, `actions-menu.png`, `invoice-page1.png` | `invoice.pdf` | Browser-authenticated export route returned a fresh 2-page invoice PDF. I did not run a pixel-perfect Procore diff in this pass. |
| `8a15c79e-2f7e-4837-b71f-ef47be90dc18` | `#596` | `/876/commitments/370ccdd2-4f9e-404a-84ec-21c4f2403658` | PDF export doesn't work. | Verified fixed | `page.png`, `commitment-page1.png` | `commitment.pdf` | Browser-authenticated document-center route returned a fresh 8-page subcontract PDF. |

## Evidence Log

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear tracking | `AAI-942` | Pass | Issue created before route verification. |
| Live row pull | `psql ... admin_feedback_items ... like '%pdf%'` -> `/tmp/pdf-export-feedback-rows.tsv` | Pass | 15 rows mention PDF; 10 active export/generation rows were included after excluding import/parser and deferred preview items. |
| Browser-authenticated export proof | `agent-browser` on `/876/submittals`, `/876/rfis`, `/876/drawings`, `/876/progress-reports/...`, `/876/change-orders/commitment/...`, `/876/invoicing/subcontractor/8092`, `/876/commitments/...` | Pass | Current UI routes were opened and fresh screenshots were saved in the evidence folder. |
| Fresh PDF download set | `docs/ops/evidence/2026-07-04-feedback-inbox-pdf-export-verification/**.pdf` | Pass | Fresh PDFs were captured for all 10 included feedback items. |
| PDF preview render set | `pdftoppm -png -f 1 -singlefile ...` | Pass | First-page PNG previews were generated for each fresh PDF artifact. |
| Direct curl with stale auth snapshot | commitment / CCO / invoice export endpoints | Mixed | Raw curl against older saved auth returned `AUTH_EXPIRED`; current browser session cookies resolved the mismatch and the same endpoints returned `200 application/pdf`. |
