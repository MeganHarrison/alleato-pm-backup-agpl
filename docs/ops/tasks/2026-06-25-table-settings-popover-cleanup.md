# Task: Table settings popover cleanup

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: Not linked in-thread
Related Handoff: N/A

## Objective

Make the `/user-management` table settings dropdown cleaner and quieter, closer to Linear/Notion, with no orange checkbox background.

## Attention Brief

Primary user: Admin managing app users.
Primary job: Adjust table density and visible columns without visual noise.
Primary decision: Which columns should be visible while scanning the table.
Tier 1: Column labels and checked state.
Tier 2: Density selector.
Tier 3: Reorder affordance.
Hide until requested: Explanatory helper copy.
Remove: Orange checkbox fill, heavy backgrounds, extra visual weight.
Primary action: Toggle columns and reset defaults.
Failure-loudly behavior: Existing table settings behavior remains keyboard accessible and visible checked state remains clear.

## Acceptance Criteria

- [x] Table settings popover has quieter Linear/Notion-style spacing and typography.
- [x] Column checked state no longer uses orange checkbox background.
- [x] Density control no longer reads as a heavy segmented card.
- [x] Shared table toolbar implementation is used; no page-local visual override.
- [x] Browser proof captured on `http://localhost:3001/user-management`.

## Implementation Checklist

- [x] Existing shared component identified before edits.
- [x] Source-of-truth owner chosen: `frontend/src/components/tables/unified/table-toolbar.tsx`.
- [x] UI patched with shared tokens and low-noise styling.
- [x] Targeted lint/check run.
- [x] Browser artifact captured.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/lint | `cd frontend && npx eslint src/components/tables/unified/table-toolbar.tsx` | Pass | Root-level direct eslint used wrong config path; frontend-scoped command passed. |
| Browser | `tests/agent-browser-runs/2026-06-25-table-settings-popover-cleanup/table-settings-clean.png` | Pass | `/user-management` table settings popover captured with neutral checkboxes and quieter density/menu styling. |

## Files Changed

- `frontend/src/components/tables/unified/table-toolbar.tsx`
- `docs/ops/tasks/2026-06-25-table-settings-popover-cleanup.md`

## Risks / Gaps

- This shared toolbar is used by multiple table pages, so the visual cleanup intentionally applies beyond `/user-management`.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
