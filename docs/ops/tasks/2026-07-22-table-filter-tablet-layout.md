# Task: Tablet Table Controls

Status: In Progress
Owner: Codex
Created: 2026-07-22
Task ID: LOCAL-FILTER-TABLET-20260722
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-filter-tablet-layout.md`

## Objective

Make the shared table filter sheet and Company header controls usable and orderly on mobile and tablet.

## Scope

- Size filter-sheet controls for touch and constrain the tablet sheet to a practical width.
- Reserve the close-control gutter so Clear never overlaps the close icon.
- Preserve add-before-more action order and remove the redundant Company subtitle on mobile.
- Make the shared mobile navigation drawer light, keep the backdrop dark, use a quiet active state, and fill the dynamic viewport.

## Acceptance Criteria

- [x] Tablet filter controls are touch-sized and fill their available row space.
- [x] The filter close icon never overlaps Clear.
- [x] The Company header hides its redundant description below the mobile breakpoint.
- [x] The add control appears before the more menu at mobile and tablet widths.
- [ ] Targeted checks and mobile/tablet visual evidence are recorded.
- [x] Mobile navigation uses a light surface, dark overlay, neutral active state, and full dynamic viewport height.

## Failure-Loudly Contract

- Cause surfaced as: visual regression checks expose overlapping controls or a header action order mismatch.
- Detection path: focused regression test plus rendered mobile/tablet screenshots.
- Recovery path: the shared table toolbar and table page action owners are corrected, not page-local overrides.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Writer lease | `checkout-session-gate.mjs claim` | Pass | `SROOT-FILTER-TABLET` owns only the task paths. |
| Focused unit tests | `npx jest --runInBand --runTestsByPath ...table-toolbar...` | Pass | 5 tests passed, including the tablet filter-sheet regression. |
| Targeted lint | `npx eslint ...` | Pass with warnings | No errors. Six existing warnings are outside this change's scope. |
| Mobile/tablet browser proof | `agent-browser open https://projects.alleatogroup.com` | Blocked | The available browser session redirects to `/auth/login`; no authorized screenshot can be attached. |
| Mobile navigation unit tests | `npx jest --runInBand --runTestsByPath src/components/nav/__tests__/mobile-bottom-nav.test.tsx` | Pass | 8 tests passed. |
| Mobile navigation lint and complexity audit | targeted ESLint + `audit-surface-complexity.mjs app-sidebar.tsx` | Pass | No lint errors; complexity budget passes. |
