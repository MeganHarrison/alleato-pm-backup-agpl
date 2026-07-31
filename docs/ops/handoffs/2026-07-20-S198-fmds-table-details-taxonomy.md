# S198 — FMDS Table Details and Governed Taxonomy

Status: Blocked/Deferred
Linear: AAI-1206 — https://linear.app/megankharrison/issue/AAI-1206/add-fmds-table-details-and-governed-filtering-taxonomy

## Intake

- Scope: relational FMDS taxonomy, table detail route, row navigation, and filtering.
- Ownership: `supabase/migrations/*fmds*taxonomy*.sql`, `frontend/src/lib/fmds/**`, `frontend/src/app/(main)/fm-global/**`, exact related tests/evidence.
- Stop condition: no migration is applied or published without a canonical-route screenshot and live ledger read-back.

## Commands and Evidence

| Command / artifact | Result | Notes |
| --- | --- | --- |
| `supabase --version` | Passed | CLI 2.108.0 available. |
| `supabase projects list --output json` | Blocked | The dedicated ASRS project backing `fmds_tables` is not available to the configured CLI. |
| `docs/ops/orchestration/session-board.md` | Blocked | S197 owns the canonical FMDS adapter/page needed for the user journey. |

## Changed Files

- `docs/ops/tasks/2026-07-20-fmds-table-details-taxonomy.md`
- `docs/ops/handoffs/2026-07-20-S198-fmds-table-details-taxonomy.md`
- `docs/ops/orchestration/session-board.md`

## Risks and Next Step

- Cause: canonical data lives in dedicated ASRS Supabase while only PM APP is linked locally; active S197 owns the source adapter/page. Detection gap: no checked-in ASRS migration link or ownership split. Prevention: add controlled ASRS migration access and hand off the canonical owner. Next: establish ASRS CLI/MCP linkage and accept/transfer S197 scope before implementation.
