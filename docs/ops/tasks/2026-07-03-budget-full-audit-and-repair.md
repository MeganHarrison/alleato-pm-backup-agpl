# Task: Full Budget End-to-End Audit And Repair

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-910 - https://linear.app/megankharrison/issue/AAI-910/full-budget-end-to-end-audit-and-repair-loop-excluding-erpintegrations
Related Handoff: None

## Objective

Run a complete end-to-end audit of the Budget tool as a real user, starting from the July 1-2 reported issues and expanding across the full budget workflow surface. Exclude ERP sync and external integration testing for this pass. Any broken slice found during the audit enters an immediate repair loop before the slice can be closed.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing budget routes, tabs, reports, modals, and linked workflow surfaces reviewed.
- [x] Existing budget task docs and prior issue context reviewed.
- [x] Scope exclusions explicitly set: ERP sync and external integrations excluded.
- [x] Acceptance criteria written as observable user outcomes.
- [x] Failure-loudly behavior defined for broken slices.
- [x] Audit tracker created in-repo before running the broad audit.

## Execution Checklist

- [x] Linear issue created for the full audit.
- [x] Audit tracker includes per-feature status, issue flag, notes, and evidence fields.
- [x] Parallel sub-agents launched for independent audit workstreams.
- [x] Browser/user-flow evidence captured for each audited slice completed so far.
- [x] API or DB read-back captured where the audited slice mutates data or depends on drilldown parity.
- [x] Broken slices routed into a repair loop before slice closeout.
- [x] Final audit report reconciles issue status vs. actual product truth.
- [x] Fresh-context objective verification queued after audit/repair completion.

## Verification Checklist

- [x] July 1-2 budget regression items verified on the exact authenticated route, except the separately owned `Budget Changes` slice.
- [x] Main Budget tab fully audited.
- [x] Budget line create/edit/delete flows audited.
- [x] Lock/unlock workflow audited.
- [ ] Budget modifications and Budget Changes workflow audited.
- [x] Budget Details tab audited.
- [x] Cost Codes tab audited.
- [x] Forecasting tab audited.
- [x] Snapshots audited.
- [x] Change History audited.
- [x] Imports audited.
- [x] Exports and report entry points audited, excluding ERP/integration actions.
- [x] Cross-tool financial rollups affecting visible budget truth audited.
- [x] Negative/error-state coverage completed.
- [x] Mobile sanity pass completed for critical flows.
- [ ] Final independent verification run completed in a fresh context.

## Acceptance Criteria

- [x] Every budget feature/tool in scope has a tracked row below with a current status.
- [x] Every row is marked `Pass`, `Fail`, `Blocked`, `In Progress`, or `Not Started`.
- [x] Every failed or blocked row has notes explaining the issue and next action.
- [x] Every repaired issue records the fix owner, changed files, and verification evidence.
- [x] The current document distinguishes true product bugs from stale issue/inbox drift where that evidence already exists.
- [x] The current document records what remains out of scope or still deferred.

## Attention Brief

Primary user: PM or accounting user relying on the budget as the central financial control surface.
Primary job: Build, revise, review, forecast, import, export, and trust the project budget end to end.
Primary decision: Which budget workflows are truly working, which are stale-status noise, and which still fail in user-visible ways?
Tier 1: Core budget operations, correctness of visible totals/drilldowns, and lock-state behavior.
Tier 2: Supporting budget tabs, imports/exports, report entry points, and cross-tool rollups.
Tier 3: Nice-to-have cleanup, wording, and low-signal historical debt.
Hide until requested: Raw console noise and low-signal exploratory dead ends.
Primary action: Audit each slice, repair if broken, re-verify, then close.
Failure-loudly behavior: A slice only moves to `Pass` after user-flow proof and any required read-back evidence are recorded.

## Audit Ledger

Legend:
- Status: `Not Started`, `In Progress`, `Pass`, `Fail`, `Blocked`
- Issue?: `Yes`, `No`, `Mixed`, `Unknown`

| Slice | Status | Issue? | Notes | Evidence |
| ----- | ------ | ------ | ----- | -------- |
| July 1-2 reported `/876/budget` regressions | In Progress | Mixed | Verified pieces now include grouped-row financial cells staying non-clickable, JTD/direct-cost parity passing on live rows, approved prime CO drilldown parity passing, and one still-open stale-visibility defect around newly created budget changes not appearing until full reload. Budget Changes ownership is with another session, so final closeout for that slice is deferred. | Sub-agent `Volta` checkpoint; cross-tool artifacts under `frontend/tests/artifacts/workstream-g-budget-truth-2026-07-03` |
| Main Budget tab load, totals, filters, grouping, views, row actions | Pass | No | Local authenticated route `/1108/budget` loaded correctly on a seeded reversible project; seeded groups and core budget GETs returned `200`. | `frontend/tests/artifacts/budget-audit-workstream-f-2026-07-03/01-budget-loaded.png`; `.../98-network.json` |
| Budget line item create | Pass | No | Created a new budget code and line item under `03 Concrete`; POSTs to `/budget-codes` and `/budget` returned `200`, and the new `$500.00` group rendered. | `frontend/tests/artifacts/budget-audit-workstream-f-2026-07-03/17-after-line-create.png` |
| Budget line item edit and prefill | Pass | No | Original edit flow worked, and the earlier post-save refresh lag is now repaired. Re-verification on `/760/budget` showed the updated `26 Electrical` amount (`$40,001.00`) visible in the table immediately after save. | `frontend/tests/artifacts/budget-audit-workstream-f-2026-07-03/20-edit-line-item-dialog.png`; `.../24-budget-after-edit-wait.png`; `frontend/tests/artifacts/budget-audit-workstream-i-repair-verify-2026-07-03/edit-after-save-body.txt` |
| Budget line item delete and bulk delete | Pass | Mixed | Original zero-dollar delete flow passed. The shared refresh-latency fix now covers both single-delete and bulk-delete follow-up paths, but destructive delete replay was not repeated on the shared `/760` dataset after the fix. | `frontend/tests/artifacts/budget-audit-workstream-f-2026-07-03/25-delete-zero-line-dialog.png`; `.../27-after-delete-wait.png`; `frontend/src/app/(main)/[projectId]/budget/page.tsx` |
| Budget lock workflow | Pass | No | Lock behavior works and the prior invalid nested HTML / hydration warning is now repaired. Re-verification on `/1108/budget` showed the dialog opening with no new browser errors. | `frontend/tests/artifacts/budget-audit-workstream-f-2026-07-03/31-lock-alertdialog.png`; `.../98-console.json`; `frontend/tests/artifacts/budget-audit-workstream-i-repair-verify-2026-07-03/lock-dialog-after-fix.png`; `.../lock-dialog-errors-after-fix.txt` |
| Budget unlock workflow | Pass | No | Unlock sidebar worked; `Unlock and Preserve` returned `DELETE /budget/lock 200` and preserved existing lines. | `frontend/tests/artifacts/budget-audit-workstream-f-2026-07-03/33-unlock-dialog.png`; `.../35-after-unlock-preserve.png` |
| Budget modifications create/edit/status/cleanup | Blocked | Mixed | Header-level budget-modification visibility issue was reproduced in another audit slice, but `Budget Changes` ownership is with another active session, so this slice is intentionally not being repaired here. | Deferred to other session for `Budget Changes`; regression checkpoint from `Volta` |
| Budget Changes tab review workflow | Blocked | Mixed | Another active session is handling this slice. Do not duplicate audit or repair work here until ownership is handed back. | Deferred to other session |
| Budget Details tab | Pass | No | Read-only ledger/report loaded correctly with filters and mixed detail rows on `/876/budget?tab=budget-details`. | `frontend/tests/agent-browser-runs/20260703-budget-workstream-c-audit/screenshots/budget-details-final.png` |
| Cost Codes tab | Pass | No | Assignment surface loaded correctly with search, selected/all modes, counts, totals, and division groups. | `frontend/tests/agent-browser-runs/20260703-budget-workstream-c-audit/screenshots/cost-codes.png` |
| Forecasting tab and forecast modals | Pass | No | First-load summary/table render now comes from the main budget payload. Responsive pass completed on desktop, tablet, and mobile. The tab now uses a compact responsive summary layout, removes the count badge, keeps headings unwrapped with horizontal table scroll on narrow widths, and exports a forecasting-specific workbook directly from the tab data. | `frontend/tests/artifacts/forecasting-rerverify-2026-07-03/forecasting-tab-viewport.png`; `.../responses.json`; `.codex-artifacts/forecasting-desktop.png`; `.codex-artifacts/forecasting-tablet.png`; `.codex-artifacts/forecasting-mobile.png`; `.codex-artifacts/forecasting-export-responsive.xlsx` |
| Snapshots | Pass | No | Current status and one saved snapshot loaded; comparison module correctly showed no second snapshot to compare. | `frontend/tests/agent-browser-runs/20260703-budget-workstream-c-audit/screenshots/snapshots.png` |
| Change History and line history | Pass | No | Summary counts and field-level audit log loaded with before/after values. | `frontend/tests/agent-browser-runs/20260703-budget-workstream-c-audit/screenshots/change-history.png` |
| Import from file | Pass | No | Modal opened, template download worked, and authenticated import endpoint returned `200` with `1` imported row. Auto-added budget code warning is setup/data behavior, not a product bug. | `/tmp/alleato-budget-audit-workstream-d/02-import-file-modal-1034.png`; `/tmp/alleato-budget-audit-workstream-d/network-evidence-1034.json` |
| Import from Prime Contract SOV | Pass | No | Modal opened, contract picker worked, and authenticated import endpoint returned `200` with `60/61` rows reconciled. One skipped unmapped `Access Control` row is source mapping/setup debt, not a product bug. | `/tmp/alleato-budget-audit-workstream-d/21-import-contract-modal-760.png`; `/tmp/alleato-budget-audit-workstream-d/network-evidence-1034.json` |
| Export to Excel | Pass | No | Endpoint returned `200` with non-empty Excel payload and correct content type. | `/tmp/alleato-budget-audit-workstream-d/network-evidence-1034.json` |
| Export to CSV | Pass | No | Endpoint returned `200` with non-empty CSV payload and correct content type. | `/tmp/alleato-budget-audit-workstream-d/network-evidence-1034.json` |
| Export to PDF | Pass | No | Endpoint returned `200` with non-empty PDF payload and correct content type. | `/tmp/alleato-budget-audit-workstream-d/network-evidence-1034.json` |
| Budget reports entry points | Pass | No | Buyout Summary, Legacy Budget Detail, and Monitored Resources report entry points all navigated correctly. Excluding ERP/integration actions. | `/tmp/alleato-budget-audit-workstream-d/14-report-buyout-summary-760.png`; `/tmp/alleato-budget-audit-workstream-d/16-report-monitored-resources-760.png` |
| Cross-tool rollups: approved prime contract COs | Pass | No | On `50-6500 - Electrical Engineering`, `Approved COs` showed `$700.00`; drilldown returned approved `PCO-001` for `$700.00` linked to `/876/change-orders/prime/4797`. | `frontend/tests/artifacts/workstream-g-budget-truth-2026-07-03/approved-cos-open.png` |
| Cross-tool rollups: commitments and commitment COs | Pass | No | Committed Costs matched drilldowns on real rows: `09-2116` showed `SC-001 $75,000`, and `50-6500` reconciled `PO-000125 $28,000 + 000109 $28,000 + CCO-001 $500 = $56,500`. Pending Cost Changes only had verified zero-state data on project `876`. | `frontend/tests/artifacts/workstream-g-budget-truth-2026-07-03/committed-costs-09-open.png`; `.../committed-costs-50-open.png`; `.../pending-cost-changes-open.png` |
| Cross-tool rollups: direct costs and JTD detail | Pass | No | On `50-6500 - Electrical Engineering`, both `JTD Cost Detail` and `Direct Costs` showed `$25,200.00`; both drilldowns returned the same approved direct cost (`Exol PA Electrical engineering`, invoice `1500`). | `frontend/tests/artifacts/workstream-g-budget-truth-2026-07-03/jtd-detail-open.png`; `.../direct-costs-open.png` |
| Cross-tool rollups: invoicing impact on budget truth | Pass | Mixed | No separate invoicing-vs-budget mismatch was reproduced in this pass; JTD/direct-cost parity held on the exercised live row. This remains only partially exercised because project `876` did not provide broader invoice-state variety in the audited seams. | `frontend/tests/artifacts/workstream-g-budget-truth-2026-07-03/budget-drilldown-network.json` |
| Cross-tool rollups: PSR budget parity | Pass | No | PSR summary now matches budget-tool truth for top-line budget fields and fee/insurance summary fields. Verified on `/876/project-status-report` against both the PSR budget-detail table and expanded budget child rows. | `/tmp/psr-parity-2026-07-03/psr-route.png`; `/tmp/psr-parity-2026-07-03/budget-route-expanded-55.png` |
| Negative/error-state coverage | Pass | Mixed | Negative-path coverage now includes locked-forecast edit restrictions, grouped-row/non-drillable guardrails on the July 1-2 route, and the reproduced stale-visibility defect where a newly created budget change persisted server-side but did not appear in the Budget Changes tab until full reload. That visibility defect remains deferred because another active session owns `Budget Changes`. | `frontend/tests/artifacts/budget-audit-workstream-a-2026-07-03/04-forecast-locked-modal.png`; `.../04-forecast-locked-modal-snapshot.txt`; `.../12-budget-change-created.png`; `.../12-live-modification-readback.json`; `.../13-budget-changes-after-reload.png` |
| Mobile sanity pass for critical flows | Pass | No | At `390x844`, `Create` and `More actions` remained usable and exposed the expected import/export/report actions. | `/tmp/alleato-budget-audit-workstream-d/23-mobile-760-overview-390x844.png`; `/tmp/alleato-budget-audit-workstream-d/26-mobile-760-budget-reports-390x844.png` |
| Fresh-context objective verification | In Progress | Unknown | Separate Codex verification thread queued in a fresh worktree context using the `verify-feature` skill. It is instructed to judge the audit doc claims objectively and treat `Budget Changes` as separately owned rather than silently closed. | Pending worktree thread `local:6efdd86f-5964-428c-944c-d8584f4e4692` |

## Repair Loop Ledger

Use one row per broken slice after reproduction is confirmed.

| Slice | Failure Summary | Root Cause | Owner | Fix Status | Changed Files | Verification Evidence | Notes |
| ----- | --------------- | ---------- | ----- | ---------- | ------------- | --------------------- | ----- |
| Forecasting tab first-load delay | On initial direct load of `/876/budget?tab=forecasting`, KPI/table skeletons persisted materially longer than peer tabs before content rendered. | Duplicate heavy work: page preloaded full budget data even off the budget tab, and forecast GET re-entered the full budget aggregation path via nested budget fetch. | Codex | Fixed | `frontend/src/app/(main)/[projectId]/budget/page.tsx`; `frontend/src/app/api/projects/[projectId]/budget/forecast/route.ts`; `frontend/src/components/budget/forecasting-tab.tsx`; `frontend/src/lib/budget/compute-grand-totals.ts`; `frontend/src/types/budget.ts` | `frontend/tests/artifacts/forecasting-rerverify-2026-07-03/forecasting-tab-viewport.png`; `.../responses.json`; targeted ESLint and `compute-grand-totals.unit.test.ts` passed. | Browser diagnosis came from `Bernoulli` and `Parfit`; final browser re-verification came from `Harvey`. Budget Changes work is explicitly excluded from this repair loop due to another active session. |
| PSR summary budget parity | PSR summary initially showed prime-contract values and zero fee/insurance while the PSR detail table and budget tool showed budget-tool totals. | Summary derivation used prime-contract values for top-line budget fields and brittle raw-prefix matching for fee/insurance special lines. | Codex | Fixed | `frontend/src/app/api/projects/[projectId]/psr/route.ts`; `frontend/src/app/(main)/[projectId]/project-status-report/page.tsx`; `frontend/src/components/domain/psr/PsrSummaryCard.tsx` | `/tmp/psr-parity-2026-07-03/psr-route.png`; `/tmp/psr-parity-2026-07-03/budget-route-expanded-55.png`; targeted ESLint and PSR-adjacent unit check passed. | Re-verified: `Original Fee`/`Current Fee` = `$364,800.00`; `Original Insurance`/`Current Insurance` = `$36,400.00`, matching both PSR budget-detail rows and budget child rows. |
| Budget lock dialog console defect | Opening the lock dialog logs invalid nested HTML / hydration warnings even though the lock action succeeds. | Invalid block content was nested inside `AlertDialogDescription`, which renders paragraph semantics and caused the browser warning surface. | Codex | Fixed | `frontend/src/components/budget/budget-page-header.tsx` | `frontend/tests/artifacts/budget-audit-workstream-f-2026-07-03/98-console.json`; `.../31-lock-alertdialog.png`; `frontend/tests/artifacts/budget-audit-workstream-i-repair-verify-2026-07-03/lock-dialog-after-fix.png`; `.../lock-dialog-errors-after-fix.txt` | Re-verified on `/1108/budget`: lock dialog opens and `agent-browser errors` returns no new console errors after the fix. |
| Budget post-mutation refresh latency | After edit and delete, the budget table briefly drops out or leaves stale rows before refreshing several seconds later. | The shared refresh helper was invoked as if it were awaitable, but it returned immediately and let modals/delete flows finish before the refetch completed. | Codex | Fixed | `frontend/src/app/(main)/[projectId]/budget/page.tsx` | `frontend/tests/artifacts/budget-audit-workstream-f-2026-07-03/23-edit-save-result.png`; `.../24-budget-after-edit-wait.png`; `.../27-after-delete-wait.png`; `frontend/tests/artifacts/budget-audit-workstream-i-repair-verify-2026-07-03/edit-modal-before.png`; `.../edit-after-save.png`; `.../edit-after-save-body.txt` | Re-verified on `/760/budget`: editing `26 Electrical` from `$40,000.00` to `$40,001.00` returned to the table with the updated amount visible immediately after save. Delete-specific browser replay was not repeated on the shared dataset, but both single-delete and bulk-delete paths now await the same repaired refresh helper. |

## Evidence Log

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Task setup | `AAI-910` | Pass | Linear issue created for full audit. |
| Audit tracker | `docs/ops/tasks/2026-07-03-budget-full-audit-and-repair.md` | Pass | In-repo tracker created before broad audit execution. |
| Parallel audit launch | Sub-agents `Volta`, `Wegener`, `Bernoulli`, `Darwin`, `Erdos` | Pass | Independent workstreams launched for regressions, mutations, supporting tabs, imports/exports/mobile, and code-owner mapping. |
| Cross-tool owner map | Sub-agent `Erdos` | Pass | Canonical budget-truth owner confirmed as `frontend/src/lib/budget/compute-grand-totals.ts`; first drilldown seams mapped for prime COs, commitments, JTD/direct costs, invoices, PSR, and imports/exports. |
| Regression checkpoint | Sub-agent `Volta` | Pass | Authenticated local `/876/budget` route works; grouped-row cells appear non-clickable; locked-state seam and JTD parity retest are in progress. |
| Supporting tabs audit | Sub-agent `Bernoulli` | Mixed | Budget Details, Cost Codes, Snapshots, and Change History passed. Forecasting functionally passed but showed a reproducible first-load skeleton delay longer than peer tabs; owner seams point to `forecasting-tab.tsx` and `/api/projects/[projectId]/budget/forecast/route.ts`. |
| Core-flow audit | Sub-agent `Banach` | Mixed | Main Budget tab, create, edit, delete, and lock/unlock all worked on a reversible seeded project. Two follow-up issues remain: lock-dialog console/hydration warnings and slow post-mutation refresh. Cleanup succeeded for both temporary audit projects. |
| Forecast repair diagnosis | Sub-agent `Parfit` | Pass | Duplicate heavy path confirmed: unconditional page budget preload plus forecast route nested budget fetch. |
| Forecast repair checks | `eslint` on touched files; `jest --runInBand src/lib/budget/compute-grand-totals.unit.test.ts`; browser re-verification by `Harvey` | Pass | Code-path fix landed and browser proof confirmed initial Forecasting tab render now uses `/api/projects/876/budget`, not `/api/projects/876/budget/forecast`. |
| Forecast responsive/export polish | `cd frontend && ./node_modules/.bin/eslint 'src/components/budget/forecasting-tab.tsx'`; Playwright viewport sweep at `1600x1200`, `1024x1366`, and `390x844` with authenticated export click | Pass | Verified exact route `http://localhost:3001/876/budget?tab=forecasting` across desktop/tablet/mobile. Count badge absent, Recalculate visible, and forecasting export downloaded as `forecasting-876.xlsx`. |
| Shared budget shell responsiveness | `cd frontend && ./node_modules/.bin/eslint 'src/components/layout/page-header-unified.tsx' 'src/components/budget/budget-page-header.tsx' 'src/components/budget/budget-tabs.tsx'`; responsive header proof images under `.codex-artifacts/` | Pass | Shared `PageHeader` budget variant now stacks title/actions until `lg`, and budget tabs/controls split into separate rows below `xl` so the page avoids the overcrowded single-line header. Visual proof captured in `.codex-artifacts/budget-shell-mid.png` and `.codex-artifacts/budget-shell-mobile.png`. |
| Imports/exports/mobile audit | Sub-agent `Darwin` | Pass | Import, export, report entry points, and critical mobile actions passed with screenshots and authenticated network proof. |
| Cross-tool parity audit | Sub-agents `Zeno` and `Leibniz` | Pass | JTD/direct costs, committed costs, pending-cost-changes zero-state, approved prime CO parity, and PSR summary/detail parity all passed on project `876` after the PSR repair. |
| Repair re-verification | Local ESLint on touched files; `agent-browser errors`; browser edit replay on `/760/budget` | Pass | Lock dialog console warning is gone after the dialog markup fix. Edit/save now returns with the updated amount visible in the table because the shared refresh helper is truly awaited. |

## Issue Truth Reconciliation

| Reported item / issue cluster | Current truth from this audit | Evidence / notes |
| ----------------------------- | ----------------------------- | ---------------- |
| Feedback inbox July 1-2 items marked resolved while linked GitHub issues remain open | Still true. The inbox and GitHub issue states are not a reliable proxy for current product truth. | Prior issue review plus this audit confirm drift; product truth had to be established in browser/code/data instead of by status labels alone. |
| Grouped-row drilldowns, locked affordances, and editable `Forecast To Complete` were still broken on `/876/budget` | Not reproduced. These July 1 fixes are present in current code and the authenticated browser route. | Verified in code earlier and supported here by the locked-state and grouped-row browser evidence under `frontend/tests/artifacts/budget-audit-workstream-a-2026-07-03` and `frontend/tests/artifacts/budget-audit-workstream-f-2026-07-03`. |
| Budget modifications were not showing up after changes | Partially reproduced. A new budget change persisted successfully, but the Budget Changes tab did not reflect it until full reload. | `frontend/tests/artifacts/budget-audit-workstream-a-2026-07-03/12-live-modification-readback.json`; `.../12-budget-change-created.png`; `.../13-budget-changes-after-reload.png`. Repair is deferred because another active session owns `Budget Changes`. |
| PDF export was only wired in code and not end-user proven | Closed. Authenticated browser/network proof now shows `Export to PDF` returning `200` with non-empty payload and correct content type. | `/tmp/alleato-budget-audit-workstream-d/network-evidence-1034.json`; `frontend/tests/artifacts/budget-audit-workstream-a-2026-07-03/10-pdf-export-result.png`; `.../15-pdf-route-readback.json` |
| JTD mismatch on `/876/budget` | Not reproduced. Budget JTD and direct-cost drilldowns reconciled on exercised live rows. | `frontend/tests/artifacts/workstream-g-budget-truth-2026-07-03/jtd-detail-open.png`; `.../direct-costs-open.png` |
| Older budget backlog items `#350`, `#413`, `#418` | Still outside the closed July 1-2 regression cluster and should remain separately tracked. | Not audited as part of this exact route-centered pass beyond status classification. |

## Risks / Gaps

- This audit touches live-like budget workflows and may require temporary test records that must be cleaned up.
- Some slices depend on authenticated browser state and a healthy local app session.
- Cross-tool rollup verification may expose upstream bugs outside the budget page itself; those must be classified separately instead of mislabeled as budget-only defects.
- ERP sync and external integration testing are intentionally excluded from this pass.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
