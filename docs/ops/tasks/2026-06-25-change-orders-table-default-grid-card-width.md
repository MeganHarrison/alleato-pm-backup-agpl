# Task: Change Orders View Defaults and Card Width

Status: In Progress
Owner: Codex
Created: 2026-06-25
Scope: frontend

## Objective

Set `/25125/change-orders` to open in table view by default (both tabs), while keeping card view available and limiting card widths in grid mode to the standard card width.

## Non-Negotiable Done Rule

This task is not done until all checklist items are complete and evidence is added.

## Scope Checklist

- [x] Update default view state for both Prime and Commitment Change Orders tabs to `table`.
- [x] Constrain grid card width so cards use a standard card maximum width instead of full-width card columns.
- [ ] Verify the table remains the default entry state for `/change-orders` on load.

## Implementation Checklist

- [x] Update `useUnifiedTableState` defaults in `change-orders-client.tsx`.
- [x] Update card renderer classes in `change-orders-table-config.tsx` to enforce a standard max width.
- [x] Update `cardGridClassName` in `change-orders-client.tsx` as needed to keep centered card rows.

## Verification Checklist

- [ ] Browser verification artifact showing Change Orders page opens in table view.
- [ ] Browser verification artifact showing a representative card grid with max-width-limited cards.
- [ ] Confirm no type/lint failures from touched files.

## Planned Files

- `docs/ops/tasks/2026-06-25-change-orders-table-default-grid-card-width.md`
- `frontend/src/app/(main)/[projectId]/change-orders/change-orders-client.tsx`
- `frontend/src/features/change-orders/change-orders-table-config.tsx`

## Risks / Open Items

- Changes are UI-only and should not affect API behavior.
- Browser verification is pending until completed.
