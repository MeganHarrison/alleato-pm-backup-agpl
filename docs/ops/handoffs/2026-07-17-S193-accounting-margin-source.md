# Handoff: Canonical Accounting project margin source

## Intake Block

1) Session ID: S193
2) Task ID: AAI-1157
3) Linear issue: AAI-1157
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1157/use-canonical-wip-margin-data-in-accounting-dashboard
5) Current status: Pending Review
6) Files changed (absolute paths): planned `/private/tmp/project-management-aai1149/frontend/src/app/api/accounting/dashboard/route.ts`; `/private/tmp/project-management-aai1149/frontend/src/app/(admin)/accounting/page.tsx`; focused tests; task/evidence/control-plane files
7) Commands run and outcome (pass/fail counts): PASS focused Jest 8/8; PASS targeted ESLint with 0 errors; PASS changed-type, route, incident-learning, complexity, project-map, and system-map checks; PASS authenticated responsive browser proof; PASS independent review; PASS verification contract
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-17-accounting-margin-source/**`
9) Top 3 findings (frontend-visible issues first): invalid `Unnamed project` bar is non-project code `X`; AR credit memos were unsigned; dashboard mixed all AR amounts with only open AP bills instead of canonical WIP values
10) Recommended next action (one line): Publish the isolated correction, then begin the separate Accounting hierarchy and chart-beautification slice.
11) Handoff file path: `docs/ops/handoffs/2026-07-17-S193-accounting-margin-source.md`
12) Migration ledger evidence: N/A; no migration or database contract change.

Status: Pending Review
Session: S193
Task: AAI-1157
Task file: `docs/ops/tasks/2026-07-17-accounting-margin-source.md`
Verification manifest: `docs/ops/tasks/2026-07-17-accounting-margin-source.verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-17-accounting-margin-source/verification-result.json`
Linear: https://linear.app/megankharrison/issue/AAI-1157/use-canonical-wip-margin-data-in-accounting-dashboard
Canonical route: `/accounting`

## Intake

- User request: explain and correct the invalid `Unnamed project` margin bar, then remove the chart description to reduce visual noise.
- Root cause: the route bypasses the canonical WIP portfolio owner, groups non-project code `X`, signs credit memos as positive, and subtracts only open AP bills.
- Reuse decision: restore `buildWipPortfolio` as the single margin owner and retain the existing chart component.
- Exclusions: no source-data mutation, migration, AR/AP chart change, or monthly chart semantic change.

## Progress

- Runtime and database localization completed before product edits.
- Task, verification contract, and orchestration ownership captured.
- Dashboard margin now reuses `buildWipPortfolio` and no longer owns a parallel AR-minus-open-AP calculation.
- The chart now presents Gross Margin to Date with decision-accurate tooltip labels and no redundant subtitle.
- Desktop/mobile evidence shows eight real projects, no invalid `X`/`Unnamed project` margin bar, and zero overflow.

## Verification

- Focused Jest: PASS, two suites and eight tests.
- Targeted ESLint: PASS with zero errors; eight inherited page-grid warnings are unrelated.
- Changed-type, route conflict, changed-route guardrail, complexity, learning-registry, project-map, and system-map checks: PASS.
- Authenticated desktop/mobile browser proof: PASS.
- Independent review: APPROVED by Feynman.
- Verification contract: PASS.

## Linear updates

- Kickoff comment: `7dbe0af5-6640-4d83-b801-d22450cec937`
- Verification milestone: `32c1ea5d-8c28-408c-ae6f-6b9e3501574a`
- Desktop screenshot attachment: `115687ba-465f-4b46-9b63-b9e103edd2df`
- Mobile screenshot attachment: `12f6eaaa-9126-4c60-b691-f19d0a8e9690`

## Risks and next step

- Monthly revenue/margin and the lower Revenue by Project chart remain separate calculations; the next design/data slice should address the remaining non-project revenue artifact without reopening this canonical margin owner.
