# Schema Cleanup Review — 2026-07-27

Status: advisory only. This review makes no schema changes and is not drop authorization.

## Evidence and limitation

The repository already has a mature cleanup trail:

- `scripts/audits/generate-table-cleanup-report.mjs` generates the lifecycle and
  usage report from the database inventory.
- `scripts/audits/scan-table-drop-dependencies.mjs` is the required dependency
  check before a rename or drop.
- `supabase/migrations/20260719120000_soft_drop_tier_a_unused_tables.sql` is a
  reversible, dependency-reviewed Tier A rename batch.
- `docs/ops/tasks/2026-06-27-finalize-env-db-cleanup-proof.md` records a prior
  applied eight-table removal and its remote-ledger proof.

This review used the generated inventory dated 2026-07-24, `tables.yaml`,
migrations, and runtime-source references. It could not make a fresh remote
catalog read: local Supabase CLI access lacks `SUPABASE_ACCESS_TOKEN`, and this
task must not deploy or alter the database. Treat row counts and lifecycle labels
as a recent snapshot, not current production proof.

## Confirmed active or retain tables

These are not cleanup candidates despite any empty-row state; their current
application ownership is explicit.

| Table / family | Evidence of active ownership | Decision |
| --- | --- | --- |
| `projects`, `companies`, `people`, `user_profiles` | Core project shell, directory hooks, and auth/permission guards rely on them; `user_profiles.is_admin` and `is_developer` are read in the server authorization boundary. | Retain. |
| `budget_lines`, `budget_mod_lines`, `project_cost_codes` | Budget routes and the budget-change guardrail own the financial write/read path. | Retain. |
| `commitments`, `commitment_sov_lines`, subcontractor-SOV tables | Commitment forms and subcontractor SOV services own these records. | Retain; review only a named legacy sibling with a full portal-flow test. |
| `prime_contracts`, `prime_contract_line_items`, contract change-order tables | Prime-contract and AI contract-tool workflows retain an explicit atomic/RPC boundary. | Retain. |
| `change_events`, `potential_change_orders`, PCO line/link tables | The change-management workflow and atomic PCO RPCs use this graph; a dormant label is insufficient evidence. | Retain pending user-flow and RPC checks. |
| `document_metadata`, `project_documents`, RAG document tables | Native FastAPI ingestion/OCR/RAG ownership; the PM App/RAG split is deliberate. | Retain. |
| `ingestion_jobs`, `ingestion_dead_letter` in RAG | The AI database is canonical. PM App mirrors are a separate migration/retention decision. | Retain canonical RAG tables. |
| `document_insights` | `actionable_insights` depends on it. | Blocked: retire/migrate the view first. |
| `payment_transactions`, `sub_jobs`, `observations`, `recurring_issue_projects` | Prior dependency audit found view, PostgREST embed, dynamic table-map, or raw-SQL consumers. | Retain until those named consumers are removed. |

## Candidate classes, not deletion orders

| Confidence | Candidates | Rationale | Required proof before any mutation |
| --- | --- | --- | --- |
| High, already soft-drop reviewed | The 46 names in `20260719120000_soft_drop_tier_a_unused_tables.sql` (for example `ai_weekly_reflections`, `app_parity_checks`, `app_roles`, `app_schedule_*`, `email_messages`, `qto_items`, `timesheets`). | The migration's comments record zero app-code references, zero estimated rows, dormant/dead lifecycle, and no hidden dependency from the prior scanner. | Fresh catalog check must determine whether each name now exists as `zz_deprecated_*`; do not schedule a second rename. Monitor the renamed objects during the grace window, then run a fresh dependency check before a later hard drop. |
| Medium: stale PM mirrors | PM App `ingestion_jobs` and `ingestion_dead_letter`. | Inventory labels them `orphan-mirror` and identifies the RAG equivalents as canonical; PM rows still exist. | Verify every reader/writer uses the RAG resolver, establish retention/backup requirements, compare records, then stop PM writes before archival. |
| Medium: explicitly dead but referenced | `budget_changes`, `budget_modification_lines`, `change_orders`, `schedule_of_values`, `sov_line_items`, `subcontractor_sov_items`. | Inventory calls them dead/legacy, but it also records readers, writers, migrations, or data. | Trace each call site, compare against its successor, and test the full budget/contract/subcontractor user flow before even a soft-drop. |
| Low: dormant feature families | Change-management, specification, submittal, invoice, marketing, and schedule tables with readers/writers or retained rows. | The inventory has 153 non-live classifications, but most still have code references, data, or relational links. | Feature-owner decision plus live catalog dependency/RLS/function scan. Do not infer unused from `dormant`. |

## Risk checks that are mandatory per candidate

1. Query `pg_depend`, FK constraints, views/materialized views, triggers, and
   functions for the exact table.
2. Check RLS policies, grants, and PostgREST embeds; policies/functions can
   refer to a table with no application `.from()` call.
3. Search dynamic table maps, raw SQL, backend/cron scripts, and external
   integration payloads. The generated inventory's grep is a filter, not proof.
4. Take a restorable backup and record row count/checksum before an archive,
   rename, or drop.
5. Prefer a reversible rename or a read-only deprecation phase; alert on 42P01
   relation errors and relevant route/job failures for a defined grace period.
6. Only then make a separate, reviewed hard-drop migration with a rollback and
   remote-ledger evidence.

## Current inconsistency to resolve first

The generated 2026-07-24 inventory still lists several pre-soft-drop names,
while the 2026-07-19 migration is written to rename them to `zz_deprecated_*`.
That could mean the artifact is stale, the migration was not applied to the
database that generated it, or a later restore occurred. The live schema explorer
introduced in this task is designed to make that discrepancy observable on the
next authorized refresh. Do not classify any of those names as a fresh drop
candidate until the live catalog resolves it.
