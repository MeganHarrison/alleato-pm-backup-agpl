# Handoff: Human project names in Accounting charts

## Intake Block

1) Session ID: S192
2) Task ID: AAI-1149
3) Linear issue: AAI-1149
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1149/show-human-project-names-in-accounting-charts
5) Current status: Accepted
6) Files changed (absolute paths): `/private/tmp/project-management-aai1149/frontend/src/app/(admin)/accounting/page.tsx`; `/private/tmp/project-management-aai1149/frontend/src/app/(admin)/accounting/__tests__/accounting-project-balance-charts.test.ts`; `/private/tmp/project-management-aai1149/frontend/src/lib/projects/project-display-name.ts`; `/private/tmp/project-management-aai1149/frontend/src/lib/projects/__tests__/project-display-name.test.ts`; `/private/tmp/project-management-aai1149/DESIGN.md`; canonical generated project/system-map artifacts; task/evidence/control-plane files
7) Commands run and outcome (pass/fail counts): PASS focused Jest 10/10; PASS targeted ESLint with 0 errors and 8 inherited warnings; PASS changed-type guard; PASS route guard; PASS Impeccable audit; PASS authenticated desktop/mobile readback; PASS independent review; PASS verification contract
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-17-accounting-project-name-labels/**`
9) Top 3 findings (frontend-visible issues first): AR/AP now show human names; formatted code prefixes are stripped from Acumatica descriptions; all Accounting project charts share the same safe fallback contract
10) Recommended next action (one line): Preserve the shared helper for future project labels and expand its source-format tests when a new identifier shape appears.
11) Handoff file path: `docs/ops/handoffs/2026-07-17-S192-accounting-project-name-labels.md`
12) Migration ledger evidence: N/A; no migration or database contract change.

Status: Accepted
Session: S192
Task: AAI-1149
Task ID: AAI-1149
Task file: `docs/ops/tasks/2026-07-17-accounting-project-name-labels.md`
Verification manifest: `docs/ops/tasks/2026-07-17-accounting-project-name-labels.verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-17-accounting-project-name-labels/verification-result.json`
Linear: https://linear.app/megankharrison/issue/AAI-1149/show-human-project-names-in-accounting-charts
Canonical route: `/accounting`

## Intake

- User request: show project names instead of IDs/codes in both AR and AP project charts and make that a global rule.
- Root cause: the shared chart maps `projectCode` into visible labels while `description` is treated as secondary tooltip detail.
- Reuse decision: preserve the shared Accounting chart primitive and source data; centralize only the human display-name contract.
- Exclusions: no data aggregation, database, sync, permissions, totals, or chart-order changes.

## Planned ownership

- `frontend/src/app/(admin)/accounting/page.tsx`
- `frontend/src/lib/projects/project-display-name.ts`
- focused tests under matching owners
- `DESIGN.md`
- task, manifest, evidence, handoff, and control-plane files

## Progress

- Task and verification contract created before product edits.
- Linear AAI-1149 is In Progress.
- One shared helper now rejects raw IDs/codes, strips formatted code prefixes, and returns human-safe missing-name states.
- AR, AP, Net Margin, Revenue, and retainage labels use the same helper.
- `DESIGN.md` records the product-wide human-readable entity-label rule.
- User refinement: remove the duplicate page-purpose description and the Acumatica/on-hold explanation so the dashboard remains visual; both are now removed from the visible page.

## Verification

- Focused Jest: PASS, 2 suites and 10 tests.
- Targeted ESLint: PASS, 0 errors. Eight inherited page-grid warnings are outside this label change.
- Changed-type guard and route conflict check: PASS.
- Impeccable surface complexity audit: PASS.
- Authenticated browser readback: PASS at 1440x1000 and 375x812 with no horizontal overflow.
- Exact live names include `Exol Morrisville`, `Ulta Beauty`, `Goodwill Noblesville`, and `Westfield Collective`; raw/formatted code variants are absent.
- Independent design reviews: APPROVED by Descartes for the human-name contract and by Hypatia for the final copy-removal screenshots.
- Verification contract: PASS.
- Canonical project-map regeneration required by the pre-commit guardrail: PASS.
- Canonical system-map regeneration required by the pre-commit guardrail: PASS using the existing main-checkout `js-yaml` dependency; no package or lockfile changed.
- Temporary local auth allowlist access removed; production allowlist file has no diff.

## Linear updates

- Kickoff comment: `8f8ab05b-d6b2-4668-8b5b-9e83dd268f1b`
- Verification milestone: `a1ad46a1-bd83-4570-907d-305c47a46dea`
- Desktop screenshot attachment: `a2d03ebf-692c-443f-8ceb-26a8c1f4584f`
- Mobile screenshot attachment: `a932cf6d-4691-4d18-bb81-38844fab6bf6`
- Final desktop screenshot attachment after copy removal: `ed27f5b5-c0c9-401c-88d5-4e737c3fa876`
- Final mobile screenshot attachment after copy removal: `f1f9fff6-0033-47f3-a7a8-699fe8db2e9a`

## Publication

- Product/evidence commit: `31e9c2cbf`
- Push: `HEAD -> origin/main` succeeded.
- Readback: local `HEAD` equaled `origin/main` at `31e9c2cbf9dcd4d8ac3821af444513c16270b33c`.

## Risks and next step

- Long names are compacted to 18 characters in visible chart ticks; full names remain in tooltips and accessible summaries.
- Accepted: publication and exact revision readback passed; no blocking risk remains.
