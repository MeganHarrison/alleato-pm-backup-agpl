# Table Cleanup Candidates

> **AUTO-GENERATED** by `scripts/audits/generate-table-cleanup-report.mjs`.
> Source: `frontend/src/components/dev-tools/db-inventory.generated.json`
> (regenerate the underlying inventory with `npm run db:inventory`, then re-run this script).
> Inventory generated at: 2026-07-22T11:09:06.156Z

This report ranks every table as a decommission candidate using three independent
signals: **code refs** (`.from("table")` reads/writes in app code), **rows** (live
row estimate), and **status** (lifecycle in `tables.yaml`).

## ⚠️ Read this before dropping anything

"Code refs" is a literal `.from()` grep of `frontend`, `backend`, and `alleato-ai`.
A table with **0 refs can still be in use** via:

- an RPC / Postgres function,
- a **generic attachment helper** that builds the table name dynamically (this is why
  `*_documents` / `*_links` tables show 0 refs but are live),
- a **view or materialized view** that reads the table (the grep does not parse view
  definitions — e.g. `payment_transactions` shows 0 code refs but is the `FROM` source
  of the live `contract_financial_summary` / `_mv` views),
- backend Python or one-off cron scripts,
- FK cascade targets.

So **0 refs is the candidate filter, not the verdict.** Confirm each table before dropping.

> **Before renaming or dropping any candidate, run
> `node scripts/audits/scan-table-drop-dependencies.mjs`** — it checks each table for view /
> materialized-view / FK / PostgREST-embed / dynamic-map / script dependencies that the
> code-ref count cannot see. A soft-drop rename is OID-safe (views/FKs follow the rename),
> but a name-resolved ref (embed, dynamic `.from`, raw-SQL script) breaks on rename, and
> `DROP ... CASCADE` silently drops dependent views.

### Recommended safe process

1. **This report** — review the tiers below.
2. **Soft-drop (reversible):** rename candidate → `zz_deprecated_<name>` (or move to a
   `graveyard` schema). Nothing is lost; rollback is an instant rename-back.
3. **Hard drop:** after a grace period with no errors/Sentry hits, a real `DROP` migration.
4. For **Tier C** (tables that still hold rows), archive the rows first (dump to storage
   or a `*_archive` table) before dropping.

## Summary

| Tier | Definition | Count |
|---|---|---:|
| **A — safest** | `dead`/`dormant`, 0 refs, 0 rows, not a dynamic attachment table | 58 |
| **B — needs judgment** | 0 refs + 0 rows AND (`live`/`live-empty` status **or** an attachment-name pattern `*_documents`/`*_links`) | 27 |
| **C — stale data** | `dormant`/`dead`, 0 refs, but **has rows** (archive before drop) | 22 |
| Keep | has refs, or live with data — not a candidate | 397 |
| **Total tables** | | 504 |

---

## Tier A — safest to remove (58)

Empty, no code references, already flagged `dead`/`dormant`. Nothing to lose.
Recommended: soft-drop the whole set in one reversible migration.

| Table | DB | Domain | Status | Rows | Refs | Purpose |
|---|---|---|---|---:|---:|---|
| `ai_weekly_reflections` | MAIN | ai | dormant | 0 | 0 | TODO: Document this table. Zero code references in this repo (no migration, reader, or wri |
| `app_parity_checks` | MAIN | admin | dormant | 0 | 0 | Dormant parity check results. |
| `app_roles` | MAIN | auth | dormant | 0 | 0 | Dormant role definitions. |
| `app_schedule_bulk_operations` | MAIN | admin | dormant | 0 | 0 | Dormant app schedule bulk operation records. |
| `app_schedule_task_hierarchy` | MAIN | admin | dormant | 0 | 0 | Dormant app schedule task hierarchy records. |
| `app_system_states` | MAIN | admin | dormant | 0 | 0 | Dormant app system state snapshots. |
| `app_ui_components` | MAIN | admin | dormant | 0 | 0 | Dormant UI component registry. |
| `app_ui_table_columns` | MAIN | admin | dormant | 0 | 0 | Dormant UI table column definitions. |
| `asrs_decision_matrix` | MAIN | fm-asrs | dormant | 0 | 0 | Dormant ASRS decision matrix. No code references. |
| `asrs_logic_cards` | MAIN | fm-asrs | dormant | 0 | 0 | Dormant ASRS logic cards. No code references. |
| `asrs_protection_rules` | MAIN | fm-asrs | dormant | 0 | 0 | Dormant ASRS protection rules. No code references. |
| `billing_invitations` | MAIN | auth | dormant | 0 | 0 | Dormant billing/invite infrastructure. |
| `block_embeddings` | MAIN | fm-asrs | dormant | 0 | 0 | Dormant block embeddings. No code references. |
| `briefing_runs` | MAIN | intelligence | dormant | 0 | 0 | Dormant briefing run tracker. |
| `budget_line_item_history` | MAIN | financial | dormant | 0 | 0 | Dormant. Likely superseded by budget_line_history (trigger-driven). |
| `change_workflow_comments` | MAIN | financial | dormant | 0 | 0 | Dormant change workflow comments. |
| `change_workflow_notifications` | MAIN | financial | dormant | 0 | 0 | Dormant change workflow notifications. |
| `contract_payments` | MAIN | financial | dormant | 0 | 0 | Dormant contract payments. Not the same as prime_contract_payments. |
| `contract_snapshots` | MAIN | financial | dormant | 0 | 0 | Dormant contract snapshots. |
| `contract_views` | MAIN | financial | dormant | 0 | 0 | Dormant contract view state. |
| `discrepancies` | MAIN | workflow | dormant | 0 | 0 | Dormant discrepancy tracking. |
| `document_group_access` | MAIN | documents | dormant | 0 | 0 | Dormant per-group document access control. |
| `document_user_access` | MAIN | documents | dormant | 0 | 0 | Dormant per-user document access control. |
| `email_messages` | MAIN | communications | dead | 0 | 0 | Dead schema. No code references. Drop candidate. |
| `fm_optimization_suggestions` | MAIN | fm-asrs | dormant | 0 | 0 | Dormant FM optimization suggestions. |
| `forecasting` | MAIN | financial | dormant | 0 | 0 | Dormant forecasting header table. |
| `group_members` | MAIN | permissions | dormant | 0 | 0 | Dormant. No active code references. |
| `groups` | MAIN | permissions | dormant | 0 | 0 | Dormant. No active code references. |
| `inspections` | MAIN | workflow | dormant | 0 | 0 | Dormant inspections feature. |
| `marketing_performance_snapshots` | MAIN | marketing | dormant | 0 | 0 | Dormant marketing performance snapshots. |
| `nods_page_section` | MAIN | support | dormant | 0 | 0 | Dormant knowledge base page sections. No code references. |
| `observation_comments` | MAIN | workflow | dormant | 0 | 0 | Dormant observation comments. |
| `observation_history` | MAIN | workflow | dormant | 0 | 0 | Dormant observation change history. |
| `observations` | MAIN | workflow | dormant | 0 | 0 | Dormant observations (site conditions, safety, quality). Feature wired but no production t |
| `optimization_rules` | MAIN | fm-asrs | dormant | 0 | 0 | Dormant generic optimization rules. |
| `organization_members` | MAIN | auth | dormant | 0 | 0 | Multi-tenant infrastructure scaffolding. Not in use. |
| `organizations` | MAIN | auth | dormant | 0 | 0 | Multi-tenant infrastructure scaffolding. Not in use. |
| `payment_transactions` | MAIN | financial | dormant | 0 | 0 | Dormant payment transactions. |
| `procore_feature_implementations` | MAIN | admin | dormant | 0 | 0 | Dormant Procore feature implementation tracker. No code references. |
| `project_briefings` | MAIN | intelligence | dormant | 0 | 0 | Dormant. NOT the same as intelligence_packets. No writer found. |
| `project_notification_groups` | MAIN | projects | dormant | 0 | 0 | Dormant. No writer or reader found in codebase. |
| `project_resources` | MAIN | projects | dormant | 0 | 0 | Dormant. No writer or reader found in codebase. |
| `punch_item_comments` | MAIN | workflow | dormant | 0 | 0 | Dormant punch item comments. |
| `punch_item_template_categories` | MAIN | workflow | dormant | 0 | 0 | Dormant punch item template categories. |
| `punch_item_templates` | MAIN | workflow | dormant | 0 | 0 | Dormant punch item templates. |
| `qto_items` | MAIN | financial | dormant | 0 | 0 | Dormant quantity takeoff items. |
| `qtos` | MAIN | financial | dormant | 0 | 0 | Dormant quantity takeoff headers. |
| `recurring_issue_projects` | MAIN | workflow | dormant | 0 | 0 | Dormant recurring issue to project links. |
| `review_comments` | MAIN | workflow | dormant | 0 | 0 | Dormant review comments. |
| `reviews` | MAIN | workflow | dormant | 0 | 0 | Dormant review records. |
| `rfi_assignees` | MAIN | workflow | dormant | 0 | 0 | Dormant RFI assignee table. |
| `sub_jobs` | MAIN | financial | dormant | 0 | 0 | Dormant sub-job tracking. |
| `submittal_notifications` | MAIN | workflow | dormant | 0 | 0 | Dormant submittal notifications. |
| `submittal_performance_metrics` | MAIN | workflow | dormant | 0 | 0 | Dormant submittal performance metrics. |
| `timesheets` | MAIN | workflow | dormant | 0 | 0 | Dormant timesheet records. |
| `transmittal_items` | MAIN | workflow | dormant | 0 | 0 | Dormant transmittal items. |
| `user_project_roles` | MAIN | projects | dormant | 0 | 0 | Dormant. No writer or reader found in codebase. |
| `user_projects` | MAIN | projects | dormant | 0 | 0 | Dormant. No writer or reader found in codebase. |

---

## Tier B — needs per-table judgment (27)

0 `.from()` refs and 0 rows, but either marked `live`/`live-empty` **or** matching an
attachment-name pattern (`*_documents` / `*_links`) regardless of status. **Do not
bulk-drop.** The attachment/link tables are frequently reached through a shared dynamic
helper that never appears in a `.from()` grep, so they can be in active use despite 0
refs. Verify each before touching.

| Table | DB | Domain | Status | Rows | Refs | Purpose |
|---|---|---|---|---:|---:|---|
| `admin_feedback_assistant_threads` | MAIN | admin | live | 0 | 0 | Links an admin feedback item to an assistant session/thread that works it, tracking status |
| `agent_learning_usages` | MAIN | ai | live | 0 | 0 | Session-level usage/outcome log for injected agent learnings. Proves whether a retrieved l |
| `app_ui_tables` | MAIN | admin | live | 0 | 0 | App UI table registry for admin tooling. 2 code references. |
| `change_events_documents_links` | MAIN | financial | dormant | 0 | 0 | Dormant change event to document links. |
| `change_order_documents` | MAIN | documents | live | 0 | 0 | Pattern C junction: change orders ↔ document_metadata. TODO: expand metadata, identify wri |
| `contract_documents` | MAIN | financial | live | 0 | 0 | Contract-level documents. 1 row. Effectively unused. |
| `daily_deep_read_fanout_runs` | MAIN | project_intelligence | live | 0 | 0 | Run ledger for daily deep-read fanout processing and its bounded projection work. |
| `daily_logs_project_photos_links` | MAIN | documents | live-empty | 0 | 0 | Link table between daily logs and project photos. Feature shipped, never adopted. |
| `design_recommendations` | MAIN | fm-asrs | live | 0 | 0 | Persistence for FM Global sprinkler optimization recommendations. Columns mirror the RETUR |
| `distribution_groups` | MAIN | permissions | live-empty | 0 | 0 | Distribution groups for notifications. Full CRUD service exists, no rows. |
| `drawings_rfis_links` | MAIN | documents | dormant | 0 | 0 | Dormant drawing to RFI links. |
| `fm_sprinkler_configs` | MAIN | fm-asrs | live | 0 | 0 | FM Global sprinkler configurations. Lightly referenced. |
| `observation_photos` | MAIN | workflow | live-empty | 0 | 0 | Photos for observations. Feature shipped, never adopted. |
| `observations_project_photos_links` | MAIN | workflow | dormant | 0 | 0 | Dormant link table between observations and project photos. |
| `operational_loss_occurrences` | MAIN | project_intelligence | live | 0 | 0 | Detected operational-loss occurrences emitted by daily deep-read projections. |
| `owner_invoice_documents` | MAIN | documents | live | 0 | 0 | Pattern C junction: owner invoices ↔ document_metadata. TODO: expand metadata, identify wr |
| `photo_links` | MAIN | documents | live-empty | 0 | 0 | Photo links. Feature shipped, never adopted. |
| `photos` | MAIN | documents | live-empty | 0 | 0 | Photo feature. Routes wired, zero data. Feature shipped but never adopted. |
| `prime_contract_change_order_documents` | MAIN | documents | live | 0 | 0 | Pattern C junction: prime contract change orders ↔ document_metadata. Replaces pcco_attach |
| `prime_contract_pco_documents` | MAIN | documents | live | 0 | 0 | Pattern C junction: prime contract PCOs ↔ document_metadata. Replaces prime_contract_pco_a |
| `project_photos_punch_items_links` | MAIN | projects | live-empty | 0 | 0 | Link table joining project photos to punch items. Feature not yet adopted. |
| `rfi_documents` | MAIN | documents | live | 0 | 0 | Pattern C junction: RFIs ↔ document_metadata. TODO: expand metadata, identify writers/read |
| `schedule_alert_deliveries` | MAIN | schedule | live | 0 | 0 | Idempotent delivery ledger for schedule-revision alerts and notification links. |
| `schedule_baseline_events` | MAIN | schedule | live | 0 | 0 | Append-only lifecycle events for a named schedule baseline. |
| `subcontractor_invoice_documents` | MAIN | documents | live | 0 | 0 | Pattern C junction: subcontractor invoices ↔ document_metadata. Replaces subcontractor sid |
| `submittal_analytics_events` | MAIN | workflow | live-empty | 0 | 0 | Analytics events for submittal workflows. Wired but no data. |
| `user_phone_links` | RAG | unknown | dormant | 0 | 0 | TODO: Document this table. Discovered as pre-existing schema drift while regenerating TABL |

---

## Tier C — stale data, archive before dropping (22)

No readers/writers in code, but the table still holds rows. Dropping loses data, so
archive first. Sorted by row count (most data at risk first).

| Table | DB | Domain | Status | Rows | Refs | Purpose |
|---|---|---|---|---:|---:|---|
| `procore_components` | MAIN | admin | dormant | 864 | 0 | Dormant Procore component tracker. No code references. |
| `fm_blocks` | MAIN | fm-asrs | dormant | 629 | 0 | Dormant FM blocks. No code references. |
| `ai_tool_write_audits` | MAIN | ai | dormant | 185 | 0 | Dormant AI tool write audit log. |
| `requests` | MAIN | workflow | dormant | 50 | 0 | Dormant generic requests table. |
| `fm_table_vectors` | MAIN | fm-asrs | dormant | 45 | 0 | Dormant FM table vectors. No code references. |
| `fm_text_chunks` | MAIN | fm-asrs | dormant | 43 | 0 | Dormant FM text chunks. No code references. |
| `observation_types` | MAIN | workflow | dormant | 12 | 0 | Dormant observation type definitions. |
| `cost_code_division_updates_audit` | MAIN | financial | dormant | 11 | 0 | Dormant audit table for cost code division changes. |
| `cost_factors` | MAIN | financial | dormant | 8 | 0 | Dormant cost factor table. |
| `fm_cost_factors` | MAIN | fm-asrs | dormant | 7 | 0 | Dormant FM cost factors. No code references. |
| `parts` | MAIN | admin | dormant | 7 | 0 | Dormant parts catalog. Purpose unclear. |
| `contract_billing_periods` | MAIN | financial | dormant | 5 | 0 | Dormant contract billing period definitions. |
| `asrs_configurations` | MAIN | fm-asrs | dormant | 4 | 0 | Dormant ASRS configurations. No code references. |
| `processing_queue` | MAIN | pipeline | dormant | 3 | 0 | Dormant processing queue. |
| `initiatives` | MAIN | marketing | dormant | 3 | 0 | Dormant marketing initiatives table. Not the same as initiative_cards. |
| `fm_optimization_rules` | MAIN | fm-asrs | dormant | 3 | 0 | Dormant FM optimization rules. |
| `forecasting_curves` | MAIN | financial | dormant | 2 | 0 | Dormant forecasting curves. |
| `admin_view_backups` | MAIN | admin | dormant | 2 | 0 | Dormant admin view backup snapshots. |
| `submittal_distribution_recipients` | MAIN | workflow | dormant | 2 | 0 | Dormant submittal distribution recipient records. |
| `submittal_distributions` | MAIN | workflow | dormant | 2 | 0 | Dormant submittal distribution records. |
| `projects_sync` | MAIN | projects | dormant | 1 | 0 | Leftover staging table from early project sync work. No code references found. |
| `fm_documents` | MAIN | fm-asrs | dormant | 1 | 0 | Dormant FM documents. No code references. |
