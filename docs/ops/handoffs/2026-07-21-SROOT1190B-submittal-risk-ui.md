# Handoff: 2026-07-21 — AAI-1190 Submittal Risk UI

## Intake Block

1) Session ID: SROOT1190B
2) Task ID: AAI-1190
3) Linear issue: AAI-1190
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1190/link-submittals-to-activities-and-surface-schedule-risk
5) Current status: In Progress — canonical editor reads, links, unlinks, and refreshes server-calculated submittal risk; browser proof remains.
6) Files changed (absolute paths): schedule page, task edit modal, focused modal test, this handoff.
7) Commands run and outcome (pass/fail counts): PASS focused modal Jest (1 suite / 2 tests).
8) Evidence artifacts (screenshot/video/report/log paths): focused UI behavior test output.
9) Top 3 findings (frontend-visible issues first): unlink now re-reads the server risk contract instead of retaining a stale at-risk warning; link failures are visible in the modal; at-risk activity names the blocking reason and dependent work.
10) Recommended next action (one line): capture canonical desktop/mobile browser proof against the next successful production deployment.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-SROOT1190B-submittal-risk-ui.md`
12) Migration ledger evidence: `20260722000000_schedule_task_submittal_links.sql` applied and verified by SROOT1190A.
13) Task file: `docs/ops/tasks/2026-07-21-aai-1190-submittal-risk.md`

## Linear Updates

- UI risk display, link picker, failure-loudly handling, and post-unlink risk refresh are ready for publication.
- Follow-up: production Webpack compilation exposed an unbalanced promise chain in the project-submittals loader. It is now an explicit async/await effect with error handling; focused modal/risk tests pass (5/5). The workspace-local ESLint run remains blocked by the missing `eslint-plugin-storybook` dependency, unrelated to this page.
- Browser localization: the canonical project-submittals endpoint returns a bare array, while the picker expected a `{ data }` envelope. The adapter now supports the endpoint's array contract; the next deployed browser run must show selectable project submittals and a completed link/unlink round trip.
- Review correction: when the authoritative linked-submittal/risk read fails, the editor now shows the specific failure and suppresses the false-safe “No submittals linked” state. TDD: the new modal assertion failed before the error prop/rendering existed and passes after it (3/3 focused modal tests). The parent page clears stale data before read and carries the read error into this visible state.
