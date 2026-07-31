# Handoff: Accounting AR and AP project balance charts

## Intake Block

1) Session ID: S190
2) Task ID: AAI-1147
3) Linear issue: AAI-1147
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1147/group-accounting-ar-and-ap-charts-by-project
5) Current status: Accepted
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(admin)/accounting/page.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/components/accounting/financial-position-layout.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(admin)/accounting/__tests__/accounting-project-balance-charts.test.ts`; `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-17-accounting-project-balance-charts.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-17-accounting-project-balance-charts.verification-manifest.json`; `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-17-S190-accounting-project-balance-charts.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-17-accounting-project-balance-charts/**`; orchestration rows
7) Commands run and outcome (pass/fail counts): PASS focused Jest 6/6; PASS targeted ESLint with 0 errors and 8 inherited warnings outside Financial Position; PASS route check; PASS surface-complexity audits 2/2; PASS responsive browser readback 3/3 widths plus complete mobile AP capture; PASS independent design review; PASS verification contract; one initial Jest path-pattern invocation and one local auth-bootstrap navigation timed out, both corrected or bypassed with exact evidence and no product failure
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/desktop-1440x1000.png`; `tablet-768x1024.png`; `mobile-375x812.png`; `mobile-ap-375.png`; `browser-readback.json`; `source-readback.md`; `independent-review.md`; `verification-result.json`
9) Top 3 findings (frontend-visible issues first): AR and AP now show project exposure rather than aging ranges; both charts share equal hierarchy and responsive layout with one orange series; totals, aging-based attention logic, empty recovery, and invoice/bill drilldowns remain intact
10) Recommended next action (one line): Preserve the project-grouping contract when the Accounting chart suite is next expanded.
11) Handoff file path: `docs/ops/handoffs/2026-07-17-S190-accounting-project-balance-charts.md`
12) Migration ledger evidence: N/A; no migration or database contract changed.

Status: Accepted
Session: S190
Task: AAI-1147
Task ID: AAI-1147
Task file: `docs/ops/tasks/2026-07-17-accounting-project-balance-charts.md`
Verification manifest: `docs/ops/tasks/2026-07-17-accounting-project-balance-charts.verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/verification-result.json`
Linear: https://linear.app/megankharrison/issue/AAI-1147/group-accounting-ar-and-ap-charts-by-project
Canonical route: `/accounting`

## Linear Updates

- Kickoff comment: `037c5c7c-21ce-4f3c-9ed2-7152358d3cc1`
- Verification milestone comment: `935ae4da-a844-4948-94db-195e48ad179f`
- Desktop screenshot attachment: `499ebca7-25e2-4c74-a2fb-e4e44e5af90f`
- Mobile AP screenshot attachment: `f0be788f-a2c6-4022-9b49-ef033a66fab1`
- Closeout comment: `db9dd417-80b7-43ed-8fb0-b3a737fe3e46`

## Intake

- User request: group the AR chart by project instead of aging days and apply the same change to AP.
- Canonical source: `frontend/src/app/(admin)/accounting/page.tsx` with the existing `/api/accounting/dashboard` response.
- Reuse decision: consume existing `arByProject` and `apByProject`; do not create another aggregation path.
- Exclusions: no database, sync, permission, aging-alert, or child-report behavior changes.

## Planned ownership

- `frontend/src/app/(admin)/accounting/page.tsx`
- focused Accounting chart contract test
- `docs/ops/tasks/2026-07-17-accounting-project-balance-charts*`
- `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/**`
- this handoff and control-plane rows

## Progress

- Existing API response already exposes sorted project-grouped AR and AP balances.
- The mismatch is localized to the page chart choosing `arAging` and `apAging` as its visual grouping.
- One shared `ProjectBalanceBarChart` now renders the six largest AR/AP project balances with exact totals and project/customer tooltips.
- `(No Project)` is explicitly presented as `Unassigned`.
- `FinancialPositionLayout` owns the responsive three-module composition; approved `p-6` spacing is used throughout the section.
- Aging remains the source for outstanding totals and the AR attention calculation.

## Changed files

- `frontend/src/app/(admin)/accounting/page.tsx`
- `frontend/src/components/accounting/financial-position-layout.tsx`
- `frontend/src/app/(admin)/accounting/__tests__/accounting-project-balance-charts.test.ts`
- task, manifest, evidence, and control-plane files listed above

## Verification

- Focused Jest: PASS, 2 suites and 6 tests.
- Targeted ESLint: PASS, 0 errors. Eight warnings are inherited elsewhere in the legacy Accounting page and do not touch Financial Position.
- Route conflict check: PASS.
- Impeccable surface-complexity audit: PASS for both changed UI files.
- Authenticated browser readback: PASS at 1440x1000, 768x1024, and 375x812 with no horizontal overflow.
- Responsive evidence: desktop, tablet, mobile context, and complete 375px AP chart screenshots.
- Independent design review: PASS from Plato; no material blocker.
- Verification contract: PASS.
- Auth allowlist readback: clean after removing temporary local-only verification access.

## Known verification infrastructure failure

- Exact command: `BASE_URL=http://localhost:3000 PLAYWRIGHT_TEST_DIR=. npx playwright test tests/auth.setup.ts --config=tests/playwright.config.ts --project=setup`
- Result: timed out after 60 seconds while navigating to `/tasks` during saved-session verification.
- Likely owner: `frontend/tests/auth.setup.ts:143` and local Next.js compilation/runtime latency.
- Relation: unrelated to AR/AP chart behavior; a direct authenticated Playwright readback using the existing valid test session completed successfully.

## Evidence

- `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/desktop-1440x1000.png`
- `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/tablet-768x1024.png`
- `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/mobile-375x812.png`
- `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/mobile-ap-375.png`
- `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/browser-readback.json`
- `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/independent-review.md`
- `docs/ops/evidence/2026-07-17-accounting-project-balance-charts/verification-result.json`

## Risks and next step

- Non-blocking risk: source-string contracts do not render Recharts; responsive runtime evidence closes that gap for this slice.
- The eight inherited raw-grid warnings elsewhere in the page remain separate design debt.
- Published revision: `d3e040f0e1f0f9da9ff8454798fb29864dde7d58` on `origin/main`.
- Production deployment: Ready at `https://project-management-agent-eys9ex03i-the-alleato-group.vercel.app`, aliased to `https://projects.alleatogroup.com`.
- Linear: AAI-1147 is Done with desktop and mobile AP screenshot attachments.
- Next: preserve the focused grouping contract and complete ledger links during future Accounting chart changes.
