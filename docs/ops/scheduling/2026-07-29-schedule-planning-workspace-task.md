# Task: Restore the schedule planning workspace

Status: Published; browser evidence blocked
Owner: Codex
Created: 2026-07-29
Task ID: SCHED-PLANNING
Delivery lane: Standard

## Objective

Keep the live task workspace focused on schedule editing while resource
analysis, revision controls, baseline review, lookaheads, risks, and
trade-facing reports live in one explicit Planning & reports workspace.

## Source of truth

- Canonical route: `/<projectId>/schedule`
- Workspace state: `?workspace=planning`
- Planning module owner:
  `frontend/src/components/scheduling/schedule-planning-workspace.tsx`

The URL-backed workspace state avoids adding another generated route while
preserving a linkable, back-button-safe planning surface.

## Acceptance contract

- [x] Schedule and Planning & reports are explicit page-level navigation.
- [x] The default Schedule workspace does not render planning modules above the
  task grid.
- [x] Planning & reports owns resource availability, revisions, baselines,
  lookaheads, risks, and trade activities.
- [x] Published-revision provenance remains wired to every report.
- [x] The focused scheduling regression tests pass.
- [x] Independent code and React reviews approve.
- [ ] Current desktop and 390px final-route screenshots are captured.
- [x] Exact owned files publish to `origin/main`.

## Failure-loudly contract

- Existing module-specific error and retry states remain visible inside the
  Planning & reports workspace.
- The saved-calendar error remains visible in the Schedule workspace because
  calendar integrity also protects task editing.
- The planning owner has a focused regression contract so a later page rewrite
  cannot silently orphan or duplicate its modules.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Focused Jest | Pass | 5 suites, 11 tests: workspace navigation/ownership, revisions, lookahead, risk, and trade activity. |
| Focused ESLint | Pass | Zero errors; two unchanged warnings remain in the existing schedule page. |
| Code review | Approve | Task-query failures are isolated to resource analysis; planning reports remain available. |
| React/accessibility review | Approve | URL defaults, active-page semantics, responsive PageTabs reuse, and report wiring approved. |
| TypeScript | Bounded check stopped | Full frontend `tsc --noEmit --pretty false --incremental false` emitted no diagnostics but was stopped after ten minutes of CPU contention; focused Jest compilation and ESLint passed. |
| Publication | Pass | Scheduling files published to `origin/main` at `d7e013bfaefb17d4c7774cc67876f112db55dd15`; the canonical Vercel deployment completed successfully for that exact revision. |
| Browser screenshots | Blocked | Both authenticated production schedule tabs existed, but reload, navigation, and screenshot operations timed out before the browser extension became unavailable. No live data was changed. |
