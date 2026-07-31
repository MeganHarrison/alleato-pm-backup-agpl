# Task: Remove live legacy compatibility paths

Status: In Progress
Owner: Codex SROOT-LEGACY-COMPAT-R2-0722
Created: 2026-07-22
Task ID: LEGACY-COMPATIBILITY-ERADICATION
Linear Issue: Unavailable: no Linear connector is configured in this session.

## Objective

Remove or migrate every live compatibility path and stale tooling surface while preserving active domain lifecycle states and applied migration history.

## Acceptance Criteria

- [x] Archived artifacts and retired schema contracts were removed in the preceding cleanup.
- [x] Email source and budget snapshot records were migrated to canonical contracts.
- [x] Budget-line code ownership and change-event commitment pairs were migrated and database-enforced.
- [x] Drawing annotation storage is reduced to the canonical page-percent contract.
- [ ] Remaining stale tools and compatibility readers are removed or proven active canonical behavior.
- [ ] A repository guard prevents reintroduction and the integrated focused suite passes.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| `20260722130000_retire_live_compatibility_contracts.sql` | Pass | Remote applied; zero retired email-source and compact snapshot payload rows remain. |
| `20260722131500_complete_budget_and_commitment_backfills.sql` | Pass | Remote applied; zero null budget-code FKs and incomplete commitment pairs remain. |
| `20260722133000_canonicalize_drawing_annotation_storage.sql` | Pass | Remote applied and ledger-verified; all 30 rows remain canonical page-percent payloads after retired columns were removed. |
| Targeted directory test and route check | Pass | Removed unused directory-permission adapter and fake monitoring routes. |
| Focused drawing/budget/contracts test batch | Partial | 27 budget/contract assertions passed; five drawing suites were blocked before execution by the repository Jest/date-fns ESM transform configuration in this fresh workspace. |

## Remaining Risk

- Acumatica staging keys include ambiguous duplicate historical identities and require separate FK-aware reconciliation; current ERP link fields are active and retained.
- The generated database inventory cannot be refreshed until unrelated schedule-table entries are reconciled in `docs/architecture/tables.yaml`; the generator correctly stops on schema drift instead of writing stale output.
