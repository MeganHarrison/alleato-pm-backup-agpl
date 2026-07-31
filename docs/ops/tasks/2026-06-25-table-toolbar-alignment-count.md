# Task: Table toolbar alignment and count label

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: Not linked in-thread
Related Handoff: N/A

## Objective

Globally align unified table toolbar actions with the tabs and simplify the row count text to show only the total row count.

## Attention Brief

Primary user: Users scanning table pages.
Primary job: Switch tabs/views and read the table total without visual misalignment.
Primary decision: Which table view/tab to use and how many records exist.
Tier 1: Active tab and primary table controls.
Tier 2: Total row count.
Tier 3: Secondary filters/settings/search controls.
Hide until requested: Filtered-vs-total count detail.
Remove: Verbose `filtered of total` count text.
Primary action: Use table controls without the toolbar looking detached from tabs.
Failure-loudly behavior: Shared toolbar tests/lint catch regressions; browser proof captures homepage table.

## Acceptance Criteria

- [x] Right-side unified table controls are vertically centered with tabs.
- [x] Row count globally shows only total rows, e.g. `113 rows`.
- [x] Change is made in shared table implementation, not page-local.
- [x] Browser proof captured on `http://localhost:3001/`.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/lint | `cd frontend && npx eslint src/components/tables/unified/table-toolbar.tsx` | Pass | Focused shared toolbar lint passed. |
| Browser | `tests/agent-browser-runs/2026-06-25-table-toolbar-alignment-count/homepage-toolbar.png` | Pass | Homepage toolbar shows `113 rows` and right-side controls aligned with the tabs. |

## Files Changed

- `frontend/src/components/tables/unified/table-toolbar.tsx`
- `docs/ops/tasks/2026-06-25-table-toolbar-alignment-count.md`

## Risks / Gaps

- This is a global table toolbar change, so all unified table pages inherit the simpler total-only count.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
