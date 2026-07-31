# S205: Actionable FMDS Table and Figure Review Details

Status: In Progress
Linear: AAI-1213 — https://linear.app/megankharrison/issue/AAI-1213/build-actionable-fmds-table-and-figure-review-details

## Intake

- Scope: compact identifiers, table/figure detail routes, source evidence, and persisted review decisions/notes.
- Current publish slice: FMDS0834 table directory, PDF links, table detail comparison, and approval guard.
- Excluded: taxonomy, ingestion, estimator activation, rule-card promotion, and unrelated dirty-worktree files.

## Commands and Evidence

| Command / artifact | Result | Notes |
| --- | --- | --- |
| Dedicated ASRS read-back | Pass | The reported record is FMDS0834 table 2.1.4.5.5; evidence exists, structured rows/cells do not. |
| Focused review-form Jest | Pass | 2/2 tests. |
| Changed-file typecheck | Pass | Task-local types pass after guarding the JSON shape. |
| Targeted ESLint | Pass | No errors; nine pre-existing design warnings remain in untouched areas of the shared generic table factory. |
| Full frontend typecheck | Partial | Remaining failures are unrelated repo debt or the separately owned FMDS RAG integration. |
| Desktop screenshot | `docs/ops/evidence/2026-07-20-fmds-review-clarity/after-desktop.png` | Pass | Shows source versus explicit missing-candidate state. |
| Mobile screenshot | `docs/ops/evidence/2026-07-20-fmds-review-clarity/after-mobile-375.png` | Pass | Review flow fits 375px without horizontal overflow. |

## Changed Files

- `frontend/src/app/(main)/fm-global/fm-global-dashboard-client.tsx`
- `frontend/src/app/(main)/fm-global/page.tsx`
- `frontend/src/app/(main)/fm-global/fm_global_tables/[tableId]/*`
- `frontend/src/app/api/fmds/tables/[tableId]/review/route.ts`
- `frontend/src/components/tables/generic-config-unified-table.tsx`
- `frontend/src/components/tables/generic-table-factory.tsx`
- `frontend/src/lib/fmds/fmds-figures.server.ts`
- `frontend/src/lib/fmds/fmds-tables.server.ts`
- `frontend/src/lib/fmds/fmds-tables.ts`
- `frontend/src/lib/fmds/__tests__/fmds-tables.server.test.ts`
- `frontend/src/types/asrs-database.types.ts`
- `docs/ops/tasks/2026-07-20-fmds-review-details.md`
- `docs/ops/handoffs/2026-07-20-S205-fmds-review-details.md`
- `docs/ops/evidence/2026-07-20-fmds-review-clarity/*`

## Migration Ledger Evidence

- No migration was created. The review RPC and evidence tables already exist in the dedicated ASRS project.

## Root Cause and Guardrail

- Cause: the selected review candidate contains no structured table rows, and the UI displayed the technical JSON as though it were a candidate.
- Detection gap: prior proof checked record loading rather than reviewer decision readiness.
- Prevention: structured-data readiness gates approval in both the form and API; the page names the recovery state directly.

## Risks and Next Step

- Table slice is safe to publish but AAI-1213 remains in progress. Next: generate structured candidates for pending FMDS0834 tables, then build equivalent figure detail/review parity and verify database read-back from both flows.
