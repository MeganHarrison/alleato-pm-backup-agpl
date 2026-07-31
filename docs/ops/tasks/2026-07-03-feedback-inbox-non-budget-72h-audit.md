# Task: Feedback Inbox Non-Budget 72-Hour Audit

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: Not created in this session (audit-only pass)
Related Handoff: N/A

## Objective

Audit all feedback inbox items created within the last 72 hours that are not budget-related, with emphasis on items marked `resolved` or `closed`. Verify current product truth against the claimed status and identify which items are truly fixed, clearly unfixed, or still unproven.

## Non-Negotiable Done Rule

This audit is not done until every in-scope route cluster below has a status,
an evidence note, and an explicit classification for the linked feedback items.

## Scope Checklist

- [x] Last-72-hour feedback rows pulled directly from `admin_feedback_items`.
- [x] Budget-related rows excluded from this pass.
- [x] Route clusters identified for the remaining feedback.
- [x] Existing task docs and linked PR metadata skimmed for prior claims.
- [ ] Current repo/app truth checked for every remaining cluster.
- [ ] Final audit report distinguishes `Verified fixed`, `Not fixed`, `Deferred`, and `Unproven claim`.

## Verification Approach

- Source of truth for issue intake: `admin_feedback_items` rows from the last 72 hours.
- Source of truth for claim status: actual browser-verified end-to-end behavior on the named route, with artifacts or explicit route-level proof.
- GitHub issue state, PRs, task docs, code inspection, and targeted tests are supporting evidence only. They do not count as proof by themselves.
- This pass is an audit, not a fix loop. Any broken item found should be recorded as broken, not silently repaired.

## Proof Standard

- `Proven`: verified end-to-end in the browser on the actual route/workflow the feedback named.
- `Not fixed`: contradicted by live issue state or current route truth.
- `Deferred`: explicitly not fixed by design/product decision.
- `Unproven`: code/PR/task/test evidence exists, but no route-level browser verification is present in the current evidence set.

## Route Cluster Ledger

| Cluster | Count | Feedback Title Themes | Frontend Page | Verification Screenshot | Current Audit Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/876/change-events` | 9 | horizontal scrollbar; settings; markup on wrong side; qty/unit-cost alignment; financial markups; vendor add/deselect | [Open page](http://localhost:3001/876/change-events) | [Current list proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/change-events/change-events-list-current.png) | Partial audit complete | Local route verification completed for list, expanded row, exact detail route, and new-form vendor workflow. |
| `/876/change-orders/commitment/*` | 6 | PDF/email parity; approved-state gating; markup visibility; labeling and workflow clarity | [Open page](http://localhost:3001/876/change-orders/commitment) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/commitment-change-orders/commitment-change-orders-page-current.png) | In Progress | Multiple `resolved` claims around markup, gating, export/email, and labeling. |
| `/876/drawings` | 6 | edit after upload; wheel zoom; export PDF/CSV; QR deep link; cloud annotation actions | [Open page](http://localhost:3001/876/drawings) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/drawings/drawings-page-current.png) | Partial audit complete | Edit access and export output are verified on the live route; QR/deep-link callback currently fails into access denied; cloud-annotation action parity is still unproven. |
| `/876/commitments*` | 5 | locked approved view; export formatting; filters/labels; workflow state behavior | [Open page](http://localhost:3001/876/commitments) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/commitments/commitments-page-current.png) | In Progress | One item still `in_progress`; others claim `closed` or `resolved`. |
| `/876/submittals*` | 4 | export; settings; edit-vs-view access; workflow completeness | [Open page](http://localhost:3001/876/submittals) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/submittals/submittals-page-current.png) | In Progress | Export/settings/view-vs-edit concerns. |
| `/876/rfis*` | 3 | export; recipients; attachment workflow | [Open page](http://localhost:3001/876/rfis) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/rfis/rfis-page-current.png) | Partial audit complete | List, exact detail route, and create route are verified; attachment dropzone exists, PDF log export works, but CSV export is currently broken and assignee-project scoping is only partially proven. |
| `/876/invoicing/subcontractor*` | 2 | percent autofill; export formatting | [Open page](http://localhost:3001/876/invoices?tab=subcontractor) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/invoicing-subcontractor/invoicing-subcontractor-page-current.png) | Partial audit complete | List route, exact current detail route, and create route are reachable; the detail PDF export endpoint works, but percent autofill and visual PDF parity are still not fully exercised end to end. |
| `/tasks` | 2 | feedback controls; filtering behavior | [Open page](http://localhost:3001/tasks) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/tasks/tasks-page-current.png) | In Progress | Task feedback controls and filtering. |
| `/meetings*` | 4 | create meeting flow; agenda/minutes workflow; route ownership; detail rendering | [Open page](http://localhost:3001/876/meetings) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/meetings/meetings-page-current.png) | In Progress | Create flow, route ownership, and meeting detail rendering. |
| `/876/directory` and `/89/directory` | 3 | rollup correctness; add-person flow; company creation restrictions | [Open 876](http://localhost:3001/876/directory) / [Open 89](http://localhost:3001/89/directory) | [876 route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/directory/directory-876-page-current.png) / [89 access proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/directory/directory-89-page-current.png) | In Progress | Rollup, add-person flow, and company-creation restrictions. |
| `/876/documents` | 1 | source-of-truth clarity | [Open page](http://localhost:3001/876/documents) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/documents/documents-page-current.png) | In Progress | Source-of-truth clarity issue. |
| `/876/progress-reports/*` | 1 | PDF generation; action-item workflow | [Open page](http://localhost:3001/876/progress-reports/e3e0d19c-4739-44f0-bee9-91ddebeaca0b) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/progress-reports/progress-report-page-current.png) | In Progress | PDF generation and action-item workflow claim. |
| `/876/transmittals` | 1 | overall product-shape/workflow gap | [Open page](http://localhost:3001/876/transmittals) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/transmittals/transmittals-page-current.png) | In Progress | Broad product-shape claim. |
| `/notifications` | 1 | mentions; prioritization | [Open page](http://localhost:3001/notifications) | [Current route proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/notifications/notifications-page-current.png) | In Progress | Mentions and prioritization claim. |
| `/feedback-inbox` | 1 | compact left rail; PR status mapping | [Open page](http://localhost:3001/feedback-inbox) | [Current access proof](../evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/feedback-inbox/feedback-inbox-page-current.png) | In Progress | Inbox-left-column compaction and PR status mapping. |

## Evidence Log

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Last-72-hour row pull | `/tmp/feedback-last72.json` generated from Supabase service-role query | Pass | 55 total rows in window. |
| Non-budget filter | Node classification against path/title/comment/tool metadata | Pass | 49 non-budget rows, 6 budget rows excluded. |
| Cluster map | Console summary grouped by route family | Pass | Change Events, Commitment COs, Drawings, Commitments, Submittals, and RFIs are the largest remaining clusters. |
| Live GitHub read-back | `gh issue view` on sampled linked issues (`#579`, `#593`, `#596`) | Pass | Confirmed `#579`, `#593`, and `#596` are currently `OPEN` with `stateReason=REOPENED`, despite feedback rows claiming `resolved` or `closed` for `#579` and `#593`. |
| Feedback inbox route evidence | `docs/ops/tasks/2026-07-02-feedback-inbox-side-page-layout.md`, `docs/ops/tasks/2026-07-03-feedback-inbox-publish-cleanup.md` | Mixed | Code/task work exists, but `/feedback-inbox` browser proof is blocked by admin allowlist auth and the publish-cleanup task is still incomplete. |
| Notifications route evidence | `docs/ops/tasks/2026-07-02-comment-notification-workflow.md` plus current route code | Mixed | Comment-activity replacement is implemented in code, but browser/user-flow proof remains incomplete in the task ledger. |
| Drawings zoom route evidence | `docs/ops/tasks/2026-07-01-drawings-procore-zoom-pan.md`, `docs/ops/handoffs/2026-07-01-S105-drawings-procore-zoom-pan.md`, current canonical viewer code | Mixed | Canonical viewer now imports `OsdDrawingViewerWithComments` and `viewer-v2` redirects into it, but the task itself is still in progress with missing final verification. |
| Commitment approved-lock evidence | `docs/ops/tasks/2026-07-01-issue-593-approved-commitment-lock.md` and live GitHub issue read-back | Mixed | The original approved-lock fix shipped with targeted tests, but GitHub issue `#593` is now reopened for follow-up UX gaps around read-only line items. |
| Commitment PDF export evidence | `docs/ops/tasks/2026-07-01-commitment-contract-template-and-letterhead.md` and live GitHub issue read-back | Fail for closeout integrity | Earlier PDF export failures were repaired, but issue `#596` is reopened for formatting regressions, so the feedback item cannot be treated as complete. |
| Commitment CCO PDF/email evidence | `docs/ops/tasks/2026-07-02-commitment-change-order-pdf-parity.md`, `docs/ops/tasks/2026-07-02-commitment-change-order-email-delivery.md` | Mixed | Email send has live Resend proof; PDF parity has render/test proof but is still missing end-to-end workflow closure. |
| Meeting creation evidence | `docs/ops/tasks/2026-07-02-real-create-meeting-page.md` and live GitHub issue read-back for `#579` | Mixed | The exact create-meeting page was implemented and browser-verified on `/760/meetings/new`, but the broader meetings workflow issue remains reopened. |
| Deployed closeout evidence | `gh issue view` on `#547` and `#542` | Pass | `#547` has an explicit July 1, 2026 comment that PR `#604` merged and deployed; `#542` has explicit production-route proof on July 1, 2026 for `/876/drawings` and the canonical viewer route. |
| Additional GitHub closeout evidence | `gh issue view` on `#545`, `#590`, `#595` | Mixed | `#545` shows earlier validation/publish failures and no clean final proof; `#590` closed with implementation summary only; `#595` closed with targeted test proof but weak browser proof. |
| Progress report route proof | `gh issue view` on `#571`; `docs/ops/tasks/2026-07-01-commitment-contract-template-and-letterhead.md` | Pass | GitHub issue `#571` includes an explicit July 1, 2026 verification comment for `/876/progress-reports/e3e0d19c-4739-44f0-bee9-91ddebeaca0b`, and the task ledger separately records Playwright UI download proof on the same route. |
| Change Events list + expanded-row proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/change-events/change-events-list-current.png`, `change-events-list-expanded-loaded.png`, `change-events-list-narrow.png` | Mixed | The current list route renders locally; the expanded row now shows a simplified single line-item view with revenue total above cost total, and the overflow container reports `scrollWidth > clientWidth` with `scrollbarWidth = thin` at narrow width. |
| Change Events detail-route proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/change-events/change-events-detail-current-loaded.png` | Fail | The exact route `/876/change-events/927f077e-3883-441c-b275-58b55a4f9db9` remains stuck on `Loading...` locally even after the data APIs return `200`, so detail-page claims on that route are not currently verifiable end to end. |
| Change Events PDF endpoint read-back | `curl -I http://localhost:3001/api/projects/876/change-events/927f077e-3883-441c-b275-58b55a4f9db9/pdf` with auth cookie | Partial pass | The PDF endpoint now returns `200 OK` with `content-disposition: attachment; filename=\"change-event-001.pdf\"`, but the broken detail route prevents verification of the actual in-product export button flow. |
| Change Events new-form vendor workflow | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/change-events/change-events-new-vendor-open.png`, `change-events-new-vendor-selected.png`, `change-events-new-vendor-pointer-clear.png` | Mixed | The vendor dropdown no longer exposes `Add Company to Directory`, but pointer-based attempts to clear a selected vendor still leave the selection intact even though a `Clear vendor` affordance is rendered. |
| Change Events settings surface check | `rg --files frontend/src/app | rg 'change-events/.*/settings|change-events/settings'` | Pass for deferred classification | There is still no dedicated Change Events settings route in the app surface, which matches the earlier deferred/product-definition classification rather than a shipped fix. |
| Drawings edit action proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/drawings/drawing-card-menu-current.png`, `drawings-list-row-menu-current.png` | Pass | Grid/card and list row menus now expose `Edit`, which makes post-upload drawing name/discipline changes reachable on the exact route named by the feedback. |
| Drawings viewer route proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/drawings/drawings-viewer-working-current.png` | Pass | The canonical viewer route `/876/drawings/viewer/e3d94aff-7d3c-491f-8374-fb8e5b2529fa` renders the drawing successfully in a fresh authenticated browser session. |
| Drawings export proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/drawings/drawings-export-menu-current.png`, downloaded CSV/PDF under `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/drawings/downloads/` | Pass | The page-level export menu exposes both `PDF` and `CSV`; CSV export produced a parseable drawing log with the expected headers and rows, and the PDF endpoint returned a downloadable 3-page `application/pdf` file (`drawing-list-876.pdf`, 150459 bytes). |
| Drawings QR/deep-link callback proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/drawings/drawings-callback-access-denied.png` | Fail | In a cold browser session, opening a drawings route and then signing in does not return to the requested drawings surface; the callback flow lands on `/access-denied?reason=admin-dashboard-allowlist` instead. |
| Commitments list route proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/commitments/commitments-page-current.png` | Partial pass | The live `/876/commitments` route renders correctly and the primary route label is `Commitments` rather than `Subcontracts`, which supports the naming-cleanup claim. |
| Commitments issue state read-back | `gh issue list --limit 200 --state all --json number,title,state,stateReason` filtered to `#592`, `#593`, `#596` | Mixed | `#593` and `#596` are currently `OPEN/REOPENED`; `#592` is `CLOSED/COMPLETED`. |
| Commitment/CCO exact detail-route verification attempt | Playwright saved-state run against `/876/commitments/a0d9d40d-37c5-4739-872e-e5412cbc785b` and `/876/change-orders/commitment/aa35f3c3-5ec0-4568-b126-f8671b4791cc`; direct `agent-browser` opens after frontend reinstall | Blocked | Saved local auth state now redirects those exact detail routes back to `/auth/login`, and fresh browser-session login is flaky after the frontend reinstall, so current-session end-to-end proof for the detail-page-specific claims is incomplete. |
| Submittals list/settings proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/submittals/submittals-page-current.png`, `submittal-settings-tab-current.png` | Pass | The live `/876/submittals` route now exposes both a gear-style `Submittal settings` control and a working `Settings` tab at `/876/submittals?tab=settings`. |
| Submittals export proof | Live export menu snapshot plus direct endpoint read-back on `/api/projects/876/submittals/export?format=csv` and `/api/projects/876/submittals/pdf` | Pass | The current export menu exposes both `PDF` and `CSV`; CSV export returns `200 text/csv` with `content-disposition: attachment; filename=\"submittals-876.csv\"`, and the PDF export returns `200 application/pdf` (`submittal-log-876.pdf`, 140711 bytes). |
| Submittal detail route proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/submittals/submittal-detail-current.png`, `submittal-email-current.png` | Mixed | The exact detail route `/876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4` now loads with explicit `Switch to edit mode`, `Export PDF`, and `Email submittal` actions, and the email action opens a real distribution dialog. The workflow-step ordering/approver-disable portion of the complaint was not fully exercised in this pass. |
| RFI list/export proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/rfis/rfis-page-current.png`; live endpoint read-back on `/api/projects/876/rfis/export?format=csv` and `/api/projects/876/rfis/pdf` | Mixed | The live `/876/rfis` route exposes both `Export RFI Log PDF` and `Export` actions. The PDF log endpoint returns `200 application/pdf` (`rfi-log-876.pdf`, 129859 bytes), but the CSV export path currently fails with `500` and `invalid input syntax for type uuid: \"export\"`, which means the list-export complaint is not actually closed. |
| RFI detail route proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/rfis/rfi-detail-current.png` | Pass | The exact feedback route `/876/rfis/fe13bf4e-dbb6-494a-bb50-b8fc821b694e` now loads successfully and includes an attachment dropzone labeled `Drop files here or browse to upload`, which satisfies the missing drag-and-drop attachment section complaint. |
| RFI create-route assignee proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/rfis/rfi-new-current.png`; live assignee-picker snapshot on `/876/rfis/new` | Mixed | The current create route loads cleanly and the `Assignees` combobox expands to a project-scoped-looking people list rather than failing open. That is positive evidence for `#569`, but I did not independently reconcile every listed person against a separate project-membership source in this pass, so strict end-to-end scoping proof is still incomplete. |
| Subcontractor invoice route proof | `docs/ops/evidence/2026-07-03-feedback-inbox-non-budget-72h-audit/invoicing-subcontractor/invoicing-subcontractor-page-current.png`, `invoicing-subcontractor-detail-current.png`, `invoicing-subcontractor-new-current.png` | Mixed | The list route `/876/invoices?tab=subcontractor` is live, the exact current detail route `/876/invoicing/subcontractor/8092` loads, and the create route `/876/invoicing/subcontractor/new` is reachable. The older feedback detail URL shape needed a retry, which is another sign that this surface still needs careful route-level verification. |
| Subcontractor invoice PDF export proof | Live endpoint read-back on `/api/projects/876/invoicing/subcontractor/invoices/8092/pdf` | Partial pass | The exact invoice named by feedback now returns `200 application/pdf` with `content-disposition: attachment; filename=\"26-116-Exol_Morrisville-1-Invoice_1-2026-07-04.pdf\"` and a non-empty payload (38223 bytes), but I did not complete a visual parity comparison against the Procore/Job Planner reference in this pass. |

## Current Findings

### Do not trust these closures as complete

- `#596` Commitment PDF export: feedback says `in_progress`, GitHub is `OPEN/REOPENED`, and the reopened complaint is about current formatting quality, not the old renderer crash.
- `#593` Approved commitment lock: feedback says `closed`, but GitHub is `OPEN/REOPENED` after follow-up UX defects on approved line items.
- `#579` Meetings create workflow: feedback says `resolved`, but GitHub is `OPEN/REOPENED`; the create page exists, yet the broader “creation, agenda, and minutes workflow” is still not closed.
- `#545` Feedback inbox compact left rail / PR status mapping: route work exists, but both visual verification and clean publish proof are incomplete.

### Stronger supporting evidence exists, but these are still not proven unless route verification exists

- `#547` Notifications mentions/prioritization: stronger than first classified, but still not proven by the standard above because I do not have browser evidence in hand from this session.
- `#542` Drawings wheel zoom: this does meet the stronger proof bar, because the GitHub closeout includes explicit production-route browser proof on July 1, 2026 for `/876/drawings` and the canonical viewer route, with artifact paths recorded.
- `#571` Progress report PDF + editability: this also meets the proof bar, because the GitHub closeout includes an explicit July 1, 2026 browser verification comment on `/876/progress-reports/e3e0d19c-4739-44f0-bee9-91ddebeaca0b`, and the linked task ledger records Playwright PDF-download proof on that exact route.
- `#590` Commitment CCO email/send workflow: live Resend send + audit read-back exists, so this is closer to verified than most.
- `#591` Commitment CCO PDF parity: template/render proof and unit coverage exist, but the task still lacks end-to-end route proof.
- `#593` original approved-lock bug: targeted API guards and route changes shipped, but the reopened issue means the follow-up UX slice is still open.
- `#579` exact create-meeting page slice: the route was browser-verified on a real project, but the broader meetings workflow remains open.
- `#595` Subcontractor invoice percent autofill: GitHub is closed and the issue thread includes targeted unit/type/lint proof, but browser proof is weak and environment-blocked, so it remains below true route verification.

### Change Events cluster now has route-level truth

- `#549` Horizontal scrollbar: verified fixed. At narrow width the current Change Events table overflows horizontally and the live scroll container reports `scrollbarWidth = thin` instead of `none`, which is the exact affordance the original screenshot lacked.
- `#550` Settings function: still deferred. The current app does not expose a Procore-style Change Events settings route or action, so this remains a product-definition defer, not a completed fix.
- `#553` Markup on wrong side: verified fixed. The current expanded row shows revenue total above cost total with no cost-side markup rows rendered, which matches the intended “markup belongs on the revenue side” behavior.
- `#554` Qty/unit-cost alignment on detail page: not fixed by proof standard. The exact detail route named in the feedback is currently stuck on `Loading...`, so the line-item alignment claim cannot be treated as complete.
- `#555` Financial markups showing up: verified fixed on the current list/expanded route. The expanded row now renders a simplified line-item view without the extra markup rows visible in the old feedback cycle.
- `#557` Vendor add/deselect workflow: not fixed. The current vendor dropdown removes the old `Add Company to Directory` action, but a real pointer-click clear attempt still does not deselect the chosen vendor.

### Drawings cluster now has route-level truth

- `#541` Edit drawing name/discipline after upload: verified fixed. The exact `/876/drawings` card/grid and list views now expose an `Edit` action in the per-drawing menu, which makes the existing edit dialog reachable without switching to table view.
- `#542` Drawings wheel zoom: verified fixed. Prior July 1, 2026 production-route evidence already proved wheel zoom on `/876/drawings` plus the canonical viewer, and the current session separately confirms the canonical viewer route still renders a working drawing surface.
- `#573` Export should include PDF and CSV and be formatted correctly: verified fixed. The current export menu exposes both `PDF` and `CSV`; CSV export produced a well-formed drawing log with expected columns and rows, and the PDF export route returned a 3-page downloadable `application/pdf` artifact.
- `#574` QR code should open the drawing instead of stranding at login: not fixed. In a cold browser session, signing in after opening a drawings deep link lands on `/access-denied?reason=admin-dashboard-allowlist` rather than returning to the requested drawings page/viewer.
- `#575` Cloud annotation actions/parity: unproven. The viewer route loads, but I do not yet have route-level proof of the specific selected-cloud action bar shown in the original feedback screenshot.
- `#576` Duplicate wheel-zoom complaint: verified fixed as a duplicate of `#542`, backed by the same production-route evidence and current viewer-route confirmation.

### Commitments and Commitment CCO cluster now has partial route truth

- `#592` Delete subcontracts, they are the same as commitments: verified fixed on the current list route. The live `/876/commitments` page is labeled `Commitments` and no current `Subcontracts` surface is exposed there.
- `#593` Approved commitment edit lock: not fixed. The GitHub issue is currently `OPEN/REOPENED`, so the feedback closeout cannot be treated as complete.
- `#596` Commitment PDF export: not fixed. The GitHub issue is currently `OPEN/REOPENED`, so the current workflow is still considered live follow-up work.
- `#588` Approved CCO line-item lock: not fixed by inheritance from `#593`. GitHub marks `#588` duplicate/closed, but it points at the same still-reopened lock behavior family and I do not have current exact-route proof of a resolved approved-state lock on the CCO detail route.
- `#590` Commitment CCO PDF export/email for signature: unproven. Prior task evidence is strong, but I do not yet have fresh end-to-end proof on the exact detail route in this session.
- `#591` Commitment CCO markup parity: unproven. Prior task evidence exists, but exact-route proof on `/876/change-orders/commitment/aa35f3c3-5ec0-4568-b126-f8671b4791cc` is still missing in the current session.
- `#585` Retainage invoice label wording: unproven. This is detail-page-specific and I do not have stable current-session proof on the exact route.
- `#586` Commitment CCO source/label clarity: unproven. This also depends on exact detail-page verification that is currently blocked.
- `#587` Commitment CCO created/requested date ordering: unproven. I do not have a current detail-page read-back proving the date fields now render correctly.
- `#584` Subs can't create change events: unproven. This is role-sensitive behavior and I do not have a subcontractor-auth route verification in the current session.

### Submittals cluster now has route-level truth

- `#564` Submittal settings entry point: verified fixed. The live `/876/submittals` page now exposes both a header settings control and a working `Settings` tab route.
- `#565` Submittals export menu/options: verified fixed. The current list route exposes `PDF` and `CSV`, and both export endpoints return downloadable files.
- `#566` Submittal detail PDF export / email send affordances: verified fixed for the requested actions. The exact detail route now exposes `Export PDF` and `Email submittal`, the PDF route returns a real file, and the email action opens a distribution dialog.
- `#567` View-vs-edit separation / workflow behavior: unproven with partial positive evidence. The exact detail route now opens in a non-edit state with explicit `Switch to edit mode`, which addresses the first half of the complaint, but I did not fully verify the workflow-step ordering/approver-disabled behavior in this pass.

### RFI cluster now has route-level truth

- `#544` Attachment drag/drop section: verified fixed. The exact detail route `/876/rfis/fe13bf4e-dbb6-494a-bb50-b8fc821b694e` now renders a real attachment area with `Drop files here or browse to upload` plus `Add Link`.
- `#568` RFI export workflow: not fixed. The current list route exposes PDF and export actions and the PDF log route works, but the CSV export path currently fails live with `500` / `invalid input syntax for type uuid: "export"`, so the export request is not actually complete by route-proof standard.
- `#569` Restrict assignee picker to project members: unproven with positive current evidence. The live `/876/rfis/new` form now opens cleanly and the `Assignees` picker expands to a scoped list of named people, but I did not finish a separate project-membership reconciliation proving every option is strictly project-only in this pass.

### Subcontractor invoicing cluster now has partial route truth

- `#594` Invoice export formatting / Procore-style invoice surface: unproven with positive evidence. The current detail route `/876/invoicing/subcontractor/8092` is live and its PDF endpoint returns a real downloadable file, but I did not complete a visual parity comparison against the attached Procore/Job Planner reference in this pass.
- `#595` Percent autofill from percent input: unproven with positive evidence. The create route `/876/invoicing/subcontractor/new` is reachable and the page still clearly owns the percent-autofill workflow, but I did not complete the full contract-selection and line-item autofill interaction end to end in this pass.

### Remaining clusters still need fresh route truth

- Change Events follow-up only (`#551`, `#552`, `#556`)
- Directory (`#539`, `#540`, `#577`)
- Submittals follow-up only (`#567`)
- Invoicing follow-up only (`#594`, `#595`)
- Tasks (`#582`, `#583`)
- Meetings / detail (`#578`, `#580`, `#581`)
- Documents / Progress Reports / Transmittals (`#572`, `#563`)

## Issue Classification Snapshot

Source artifact: `/tmp/nonbudget-audit-classification.json`

- `verified_fixed`: 13 issues
- `not_fixed`: 8 issues
- `deferred`: 1 issue
- `unproven`: 27 issues

### `verified_fixed`

- `#542` Drawings wheel zoom: explicit production browser proof recorded on July 1, 2026 for `/876/drawings` plus the canonical viewer route.
- `#541` Drawings edit after upload: local route verification confirms `Edit` is available from the exact card/grid and list menus on `/876/drawings`.
- `#573` Drawings export format/options: local route verification produced both a downloadable CSV drawing log and a downloadable 3-page PDF drawing list.
- `#576` Drawings duplicate wheel zoom complaint: same verified route evidence as `#542`.
- `#592` Subcontracts naming cleanup: local `/876/commitments` verification shows the route is now surfaced as `Commitments`.
- `#564` Submittal settings: local `/876/submittals` verification shows both the settings affordance and the `?tab=settings` route.
- `#565` Submittal export menu/options: local verification plus endpoint read-back confirms both CSV and PDF export surfaces.
- `#566` Submittal detail PDF/email actions: the exact detail route now exposes both actions and the PDF endpoint returns a real file while the email action opens a dialog.
- `#544` RFI attachment drag/drop section: the exact feedback route now renders a live attachment dropzone and link action.
- `#571` Progress report PDF + editability: explicit local browser verification recorded on July 1, 2026 for `/876/progress-reports/e3e0d19c-4739-44f0-bee9-91ddebeaca0b`, plus route-level PDF download proof in the linked task ledger.
- `#549` Change Events horizontal scrollbar: local narrow-width verification shows the live table now overflows with a visible thin scrollbar style instead of the hidden-scrollbar state captured in the original feedback.
- `#553` Change Events markup on revenue side: the current expanded row keeps the markup effect on the revenue total rather than rendering a cost-side markup row.
- `#555` Change Events financial markup visibility: the current expanded row no longer shows the old extra markup rows that triggered the complaint.

### `not_fixed`

- `#596` Commitment PDF export: feedback row is still effectively open work, and the GitHub issue is `OPEN/REOPENED` for current formatting regressions.
- `#593` Commitment approved-lock workflow: feedback row says `closed`, but GitHub is `OPEN/REOPENED`; prior fix evidence exists, yet the issue was reopened for follow-up UX defects.
- `#579` Meetings create workflow: feedback row says `resolved`, but GitHub is `OPEN/REOPENED`; the create page shipped, but the broader workflow issue remains open.
- `#554` Change Events detail alignment: the exact detail route remains stuck on `Loading...`, so the claimed detail-table fix is not holding on the current route.
- `#557` Change Events vendor workflow: the dropdown no longer offers `Add Company to Directory`, but the user still cannot clear a selected vendor through a normal pointer interaction.
- `#574` Drawings QR deep link: a cold-session sign-in callback lands on `/access-denied?reason=admin-dashboard-allowlist` instead of returning to the requested drawings route.
- `#568` RFI export workflow: the PDF log export works, but the CSV export path currently throws a live `500` server error on the route the user would use.
- `#588` Commitment CCO approved-lock duplicate: cannot be treated as complete while the parent lock-behavior family remains reopened and unproven on the exact route.

### `deferred`

- `#550` Change Events settings function: feedback row and task history agree this was deferred for product-definition reasons rather than fixed.

### High-risk `unproven` items

- `#545` Feedback inbox compact left rail / PR status mapping: task work exists, but browser proof and publish proof are still incomplete.
- `#590` and `#591` Commitment change order email/PDF: evidence is stronger than most, but neither task is fully closed in its own ledger.
- `#595` Subcontractor invoice percent autofill: targeted tests exist, but there is still no strong route/browser proof in the current evidence set.
- `#575` Drawings cloud annotation actions: the viewer is working, but I still do not have a route-level reproduction proving the selected-cloud action toolbar behavior.
- `#584`, `#585`, `#586`, `#587`: all are still missing stable exact-route proof on the commitment/CCO detail pages in the current session.
- `#567` Submittal view-vs-edit/workflow behavior: the explicit edit-mode gate is now present, but the workflow ordering/disable portion is still not fully proven.
- `#569` RFI assignee scoping: the picker now shows a scoped list on the live create route, but I did not fully reconcile that list against independent project-membership truth in this pass.

### Lower-confidence closed items

These are closed in GitHub or marked resolved in feedback, but I do not yet have enough exact-route evidence in this session to call them truly verified:

- Change Events: `#551`, `#552`, `#556`
- Drawings: `#575`
- Commitments / related: `#584`, `#585`, `#586`, `#587`, `#590`, `#591`
- Submittals: `#567`
- Directory: `#539`, `#540`, `#577`
- RFIs: `#569`
- Invoicing: `#594`, `#595`
- Tasks: `#582`, `#583`
- Meetings / detail: `#578`, `#580`, `#581`
- Documents / Progress Reports / Transmittals: `#563`, `#572`

## Final Status

- [ ] All in-scope clusters audited.
- [ ] Evidence recorded for every final claim.
- [ ] Final response includes what is done, what remains, and recommended next steps.
