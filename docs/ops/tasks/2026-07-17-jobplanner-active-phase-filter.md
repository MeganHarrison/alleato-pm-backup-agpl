# Task: Restore active JobPlanner project selection

Status: In Progress
Owner: Codex
Created: 2026-07-17
Task ID: Follow-up to GitHub issue #29
Linear Issue: unavailable; GitHub issue #29 is the source incident

## Objective

Ensure active mapped projects are selected when the mapping snapshot uses
`Current` but live project rows use `Development`.

## Acceptance Criteria

- [ ] Dry-run selects the mapped active projects represented in live data.
- [ ] Archived and non-active projects remain excluded.
- [ ] The selector explains the accepted phase vocabulary in code.
- [ ] A live workflow run proves the corrected scope without importer mismatch.

Verification contract: Required

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Root-cause query | Supabase REST readback of `projects` | PASS | Active rows use `Development`; mapping snapshot uses `Current`. |
