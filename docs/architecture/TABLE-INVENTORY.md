# Database Table Inventory

> **Authoritative reference for every table in MAIN and RAG, including: purpose, writers (file:line + what triggers them), readers, and population schedule. Original audit 2026-05-15; post-Wave-3 corrections applied below.** Read this BEFORE writing any migration, deleting any table, or building any tool that touches data.
>
> This file is the operational counterpart to [DATABASE-ARCHITECTURE.md](./DATABASE-ARCHITECTURE.md) — that doc explains *why* the split exists; this one explains *what every table does*.

---

## 2026-05-15 → 2026-05-15 (post-Wave-3) Corrections

Several claims in the original inventory were wrong or have been resolved by Waves 1–3 + Phase 4 Day 1–2. The table below is the running diff. Always trust this section over older entries until the body is rewritten.

| Table / claim | Prior state in this doc | Reality (verified by SQL or commit) |
|---|---|---|
| `prospects` (legacy standalone table) | "live-empty — Prospects directory page exists and reads/writes. Never used in production." | **DROPPED 2026-07-24** (migration `20260724010000_drop_legacy_prospects_table.sql`; verified 0 rows, 0 inbound FKs, 0 dependent views before drop). It was a parallel CRM identity table — the exact architecture rejected on 2026-07-23. `/directory/prospects` now reads `companies` WHERE `lifecycle_stage != 'active'`; pipeline data lives in `crm_deals`/`crm_activities`/`company_qualification`; the ai-dashboard lifecycle funnel now sources open `crm_deals`. |
| 21 drift-stub tables (business_areas ×3, durable_ai_turns, schedule resource-leveling ×17) + 4 newer DB-only tables (crm_pipeline_stages, crm_deals, crm_activities, company_qualification) | 2026-07-23 drift stubs on the leadership branch said "TODO: Document this table"; the CRM/qualification set had no yaml entry at all. | **Documented 2026-07-23** from creating migrations + live DDL/comments. Schedule set = Phase 4A/4B/4C migrations (`20260722121917`, `20260722161757`, `20260722205432`) applied to prod but the files still live on unmerged feature branches. `business_area_*` (Alleato Brain plan, `docs/ops/plans/2026-07-23-alleato-brain-migration-plan.md`) and the CRM/qualification tables were created directly in the DB with no repo migration file — table comments in the DB are authoritative for the CRM set. |
| Leadership-restricted meetings (`document_metadata.access_level='leadership'`, `user_profiles.is_leadership`, `meeting_segments` RLS) | Annual Review meetings were readable by every authenticated user (all 42k docs had `access_level='team'`); `meeting_segments` had **no RLS at all**; no leadership tier existed. | **Added 2026-07-23** (migration `20260723230000_leadership_restricted_meetings.sql`, verified live with per-user RLS simulation). `category='Annual Review'` rows are trigger-stamped `access_level='leadership'` and visible only to `user_profiles.is_leadership` (Megan ×3 accounts, bclymer, jdawson) — independent of `is_admin`. `meeting_segments` now has RLS cascading from the parent doc. AI-DB `document_chunks` for restricted docs carry `metadata.access_level='leadership'` (25 chunks backfilled); service-role AI paths enforce via `frontend/src/lib/ai/leadership-restriction.ts`; `extractor.py` skips insight extraction for restricted docs. |
| CRM layer: `crm_pipeline_stages`, `crm_deals`, `crm_activities`, `company_qualification` + `companies.lifecycle_stage` / `people.lifecycle_stage` + `verified_companies` view | not previously listed | **Created 2026-07-23** (migration `20260723060000_create_crm_workflow_tables.sql`, applied + ledger-verified + smoke-tested live). Architecture decision (Megan + Brandon): the CRM gets **no parallel identity tables** — prospects/leads live in `companies`/`people` with `lifecycle_stage` (`prospect`/`qualified`/`active`; all 592 existing companies backfilled `active`), and all pipeline data lives in the new `crm_*` workflow tables that FK into the shared identity. Converting a prospect = flip `lifecycle_stage` + write a `company_qualification` row — never a row migration. PM surfaces must read companies via the `verified_companies` view (569 rows at creation; excludes prospects/qualifying/archived) so CRM entries cannot leak into vendor dropdowns. |
| `team_chat_messages` / "where are the Teams messages?" | `tables.yaml` said "Teams chat messages. Wired but unused." — repeatedly misled agents into claiming Microsoft Teams history isn't ingested. | **Corrected 2026-07-14 (live PostgREST counts + code read).** `team_chat_messages`/`team_chat_channels` back **Team Chat** (`/team-chat`) — the app's OWN internal chat product (channels, DMs, comments-inbox DM; UI built via `ChatLayout`, API `api/team-chat/*` admin-gated; not yet rolled out — launching it is a standing Megan priority). Nothing to do with Microsoft Teams. Microsoft Teams history lives in `document_metadata` `category='teams_message'` — 28,463 rows since 2026-03-18 (`type='teams_dm'` ~24.6k legacy per-message DM docs, `teams_dm_conversation` ~3.8k grouped DM daily docs, `teams_message` 13 channel threads), synced by `microsoft_graph/teams.py`, embedded as RAG `document_chunks` `source_type='teams_dm'` (~36k) / `'teams_channel'` (34). Blunt pointers added to both `tables.yaml` entries. Open question: channel coverage is thin (13 threads) — scoped or stalled? |
| This document itself | Deleted 2026-06-22 (`5d1bdffec`) during the docs reorg; the 2026-06-23 purge (`e0d39e45f`) then gitignored all of `docs/`, silently breaking the RAG-DOCS-GATE that mandates this file. | **Restored 2026-07-02** from its last committed version (2026-06-22). Entries below may predate 2026-06-22 — for live table existence/status, trust `TABLE-LIST.md` (regenerated from `tables.yaml`); use this doc for narrative + corrections only. |
| Source ingestion/vectorization cadence | Fireflies/Graph/Teams and compiler-drain behavior was described inconsistently across docs, including a 15-minute compiler drain and Fireflies inline GPT task rewrite during ingest. | **Corrected 2026-06-18.** Fireflies sync uses scheduler `_run_fireflies_sync(limit=25)` with `FIREFLIES_REWRITE_TASKS_DURING_INGEST=false`; transcript ingestion/chunking no longer calls the GPT-5.5 task rewriter inline. Graph embedding can embed RAG-only metadata rows when app metadata is absent. `alleato-intelligence-compiler-drain` is hourly in `render.yaml` (`0 * * * *`), and live Render did not have that cron service at verification time. |
| `fireflies_ingestion_jobs` (MAIN) | "STALE orphan-mirror — RAG copy is canonical, do not write to MAIN" | **No longer stale (2026-06-17).** `supabase_helpers.update_ingestion_job_state()` now dual-writes every pipeline stage transition into BOTH MAIN and RAG `fireflies_ingestion_jobs`, keyed by `COALESCE(document_metadata.fireflies_id, id)` (on_conflict=fireflies_id). MAIN status flipped orphan-mirror → live. Adopted by parser/document_parser/financial_parser/embedder/extractor/orchestrator. Always update both DBs via this helper, never one side directly. |
| `source_processing_jobs` | not previously listed | **Created in the RAG/AI database on 2026-06-17.** It is the cross-source lifecycle ledger for Fireflies, Graph, signal extraction, and project-intelligence synthesis stages. |
| `pipeline_model_usage` | not previously listed | **Created in the RAG/AI database on 2026-06-17.** It is the high-volume model usage and estimated-cost ledger for source processing, embeddings, daily briefs, Brandon email review, and project intelligence budget checks. |
| `user_profiles` | "empty — 123 code references; CRITICAL privilege bug" | **53 rows (= every auth.users row).** Backfilled in migration `20260516000000` (commit `2f32ca2c6`). Trigger keeps auth.users → user_profiles in sync going forward. Privilege bug resolved. |
| `acumatica_sync_runs` | "empty despite a writer" | **53 rows, growing every 2h.** Cron firing on schedule. |
| `acumatica_payment_applications` | "183 rows, NO WRITER" | **Now has a Python writer** (Wave 1C). Ongoing 2h sync. Initial 183 rows from backfill. |
| `document_metadata.category` "99% generic" | "99% set to 'document'" | **Actual distribution (2026-05-15):** 74% `teams_message` (27,295), 14% `document` generic (5,059), 7% `email` (2,481), 4% null (1,407), rest distributed across `financial_document`, `specification`, `Contract`, `drawing`, etc. The "99% generic" claim was based on too-narrow a sample. |
| `document_metadata.document_type` | (column did not exist) | **New column** referencing `document_type_taxonomy(type_key)`. **30,288 of 36,855 rows populated** via path-pattern backfill (migration `20260520030000`). 6,567 rows awaiting Phase 9 LLM categorization. |
| `document_user_access`, `document_group_access` | "Dormant" | **LOAD-BEARING but empty.** Wired into RLS policies on `document_metadata` / `document_rows` / `document_chunks` via `supabase/migrations/20260427130000_secure_rag_documents_rls.sql` with FK CASCADE. Empty because the management UI hasn't shipped. **KEEP — do not drop.** |
| `sop_backlog`, `finance_spend_classification_rules` | not previously listed | **Created for SAIS accounting/finance leadership reporting.** `sop_backlog` stores missing SOP requirements separately from uploaded `document_metadata`; `finance_spend_classification_rules` classifies Acumatica AP bills into finance overhead categories while keeping raw AP sync data read-only. |
| `outlook_email_intake_attachments` | "needs redesign" | **Architecture is correct.** All required columns present (`promotion_status`, `promotion_reason`, `promotion_attempt_count`, `promoted_at`, `document_metadata_id`). Promotion worker `backend/src/services/integrations/microsoft_graph/attachment_promotion.py` is wired into `run_graph_sync` post Wave 1E. **Not incomplete architecture.** |
| `graph_sync_state.resource_id` | Per-user Graph sync state key shape was easy to misread. | **Per-mailbox rows use the bare mailbox email, not `user:<email>`.** The limited Microsoft Graph sync batch must read those bare keys for stale-first mailbox ordering; prefixed lookups match zero rows and can starve every mailbox except the alphabetically first account. |
| `projects.client` (text) | "mostly null" | **DROPPED.** Migration `2269f1b12`. |
| `projects.client_id` | listed as canonical company link | **DROPPED.** `company_id` is canonical. `client_id` rows pointed at stale "Alleato Group delete" entries. |
| `projects.current_phase` | listed as a column | **RENAMED to `stage`** in migration `2269f1b12`. All code updated. |
| `chat_messages`, `chat_sessions`, `chat_threads`, `chat_thread_items`, `chat_thread_attachments`, `chat_thread_attachment_files`, `chat_thread_feedback` | "DROP CANDIDATES" | **DROPPED.** Migration `20260516020000_drop_dead_legacy_tables.sql`. `chat_history` + `conversations` remain as the live chat surface. |
| `subcontractor_contacts` | "DROP CANDIDATE" | **DROPPED.** Same migration. |
| `project_health_dashboard` view | "broke when Pipeline A dropped" | **Recreated against `insight_cards` + `intelligence_targets`** in migration `20260515100000`. Live. |
| `projects_with_counts` view | (not previously listed) | **Recreated** post Pipeline A drop. Live. |

### Newly created tables (Phase 4 Day 1–2, applied)

| Table | Rows | Source |
|---|---|---|
| `document_type_taxonomy` | 23 | Migrations `20260520000000` + `20260520010000` (seed). 8 categories × 23 type keys × `applies_to` array |

### Newly created tables (Phase 4 Day 3–6, partial)

Wave 4N is **in progress**. As of 2026-05-15 the following document-junction tables exist:

| Table | Status |
|---|---|
| `submittal_documents` | Live |
| `drawing_revisions` | Live (preexisting; now part of Pattern C hybrid) |
| `project_documents` | Preexisting (project uploads); part of unified arch |

Still to be created (planned for Phase 4 Day 3–6):

- `commitment_documents`
- `prime_contract_documents`
- `change_order_documents`
- `owner_invoice_documents` / `invoice_documents`
- `company_documents`
- `rfi_documents`

See [DATABASE-ARCHITECTURE.md §12 "Unified File Architecture (Pattern C)"](./DATABASE-ARCHITECTURE.md#12-unified-file-architecture-pattern-c) for the design.

---

## How to use this doc

- Search by table name (Ctrl+F).
- The **Critical findings** section surfaces silent bugs uncovered during the inventory pass — fix these before any other work.
- The **Cron schedule master** table is the single place to see what runs when.
- "Dormant / unused" means no application-code writer was found. Some have rows from historical loads; treat them as candidates for cleanup, not as live data.
- Row counts are from `pg_class.reltuples` (approximate). Tables with `-1` rows have never had `ANALYZE` run; verify with `SELECT count(*)` if it matters.

---

## Critical findings (fix before more work)

1. ~~**`user_profiles` is empty but 123 code paths read it.**~~ **RESOLVED 2026-05-15.** Backfilled to 53 rows (= all auth.users) via migration `20260516000000`. Trigger keeps rows in sync. Privilege bug closed.

2. **`users_auth` has 1 row despite ~6 distinct insert paths.** Most signups are not producing the auth↔people bridge row. Investigate the signup flow and `lib/supabase/auth-guard.ts`. (Still open.)

3. ~~**`acumatica_payment_applications` (183 rows) has NO writer.**~~ **RESOLVED.** Python writer added in Wave 1C; ongoing 2h sync.

4. ~~**`acumatica_sync_runs` is empty despite having a writer.**~~ **RESOLVED.** 53 rows, growing every 2h.

5. **`documents` is legacy (12,471 rows) but the project-setup wizard still writes to it** — parallel to `document_metadata`. Two indexes of project files exist; migrate or pick one.

6. **MAIN copies of `document_chunks` (103K), `packet_refresh_jobs` (1,373), `source_signal_candidates` (6,670), `source_intelligence_jobs` (10,587) are stale orphans** — RAG is the canonical destination after the migration. Truncate MAIN copies once verified.

7. **Name-collision traps:**
   - `subcontract_sov_items` (964 rows, live) vs `subcontractor_sov_items` (2 rows, dead).
   - `budget_mod_lines` (32 rows, live) vs `budget_modification_lines` (empty, dead).
   - `contract_change_orders` (commitment CCOs) vs `prime_contract_change_orders` (owner PCCOs) — name doesn't reflect scope.
   - `chat_history` (live, 2908 rows) vs `chat_messages` / `chat_sessions` / `chats` / `messages` / `notes` (all dead).

8. **Marketing vertical is entirely dormant** (4 tables, 0 rows). `isCmoWeeklyContentWorkflowRequest` path in handler-v2 writes here but no production traffic.

9. **AI learning pipeline is wired but unused.** `ai_feedback_events`, `ai_learning_promotions`, `ai_retrieval_weights` are all empty despite having writer paths.

10. **Photo system is fully wired (APIs, services, components) with zero data.** Feature shipped but never adopted: `photos`, `photo_albums`, `photo_links`, `project_photos`, `observation_photos`, `daily_logs_project_photos_links`.

---

## Pipeline B compiler refresh — enqueue and drain paths

Many readers won't know this: the intelligence compiler refreshes packets in two stages. First, source changes and periodic sweeps enqueue work. Then a Render cron drains the queue and writes current packets.

1. **Event-driven enqueue (priority 10)** — on every `promote_signal_candidate` call inside the compiler, an immediate packet refresh job is enqueued.
2. **Periodic enqueue (priority 20)** — Render cron `alleato-packet-refresh-periodic` runs `scripts/enqueue_periodic_packet_refresh.py` 4x/day for every active `intelligence_targets` row, so quiet projects do not sit stale.
3. **Compiler drain** — Render cron `alleato-intelligence-compiler-drain` is defined hourly in root render config and calls `scheduler._run_intelligence_compiler`, claiming RAG source-intelligence jobs and packet-refresh jobs. The `alleato-backend` web service intentionally has `DISABLE_SCHEDULER=true` and `INTELLIGENCE_COMPILER_ENABLED=false`, so the Render cron is the intended production drain loop when the service exists.

All three converge on the same compiler logic in `backend/src/services/intelligence/compiler.py`.

---

## Cron schedule master

| Cron | Schedule | Touches |
|---|---|---|
| `alleato-acumatica-financial-sync` | `0 0,7 * * *` (2×/day) | All `acumatica_*` mirrors → projected into `direct_costs`, `subcontracts`, `subcontract_sov_items`, `prime_contract_change_orders`, `contract_change_orders`, `commitment_payments`; updates `projects.acumatica_ap_synced_at` |
| `alleato-source-sync-health` | `*/30 * * * *` | `source_sync_health_snapshots`, `system_alerts` |
| `alleato-teams-channel-sync` | `10 * * * *` (hourly) | source_documents, `source_intelligence_jobs` |
| `alleato-teams-dm-sync` | `40 * * * *` (hourly) | source_documents, `source_intelligence_jobs` |
| `alleato-graph-sync` | `20 */2 * * *` (every 2h) | source_documents, embeddings, Teams compiler |
| `alleato-daily-recap` | `30 9 * * *` (daily) | `daily_recaps` |
| `alleato-task-extraction` | `0 7 * * *` (daily) | `tasks` |
| `alleato-rag-health` | `15 12 * * *` (daily) | `system_alerts` |
| `alleato-source-rag-health` | `5 */4 * * *` (every 4h) | `system_alerts` |
| **`alleato-packet-refresh-periodic`** | `0 2,9,15,21 * * *` (4×/day) | Enqueues `packet_refresh_jobs` (RAG) for every active `intelligence_targets` row |
| **`alleato-intelligence-compiler-drain`** | `0 * * * *` (hourly) | Drains `source_intelligence_jobs` + `packet_refresh_jobs` -> writes `insight_cards`, `insight_card_evidence`, `insight_card_targets`, `intelligence_packets`, `intelligence_packet_cards` |
| `alleato-executive-daily-brief-morning` | `0 11,12 * * 1-5` | Generates `daily_recaps` + Teams delivery |
| `alleato-executive-daily-brief-evening` | `0 22,23 * * 1-5` | Same as above, evening cadence |
| **APScheduler in FastAPI (fireflies)** | per `scheduler.py:540` | Polls Fireflies, enqueues `fireflies_ingestion_jobs` |

---

## Dual-write paths (atomic-ish writes touching multiple tables)

These are the only places in code that intentionally write to multiple tables in a single call. If you bypass these, you create drift.

| Function | File:line | Writes to | Triggered by |
|---|---|---|---|
| `SupabaseHelper.upsert_document_metadata` | `backend/src/services/supabase_helpers.py:155` | `MAIN.document_metadata` + `RAG.rag_document_metadata` | Every ingestion path: outlook sync, Teams sync, Fireflies, document parser, financial parser, knowledge upload |
| `run_acumatica_financial_sync` | `backend/src/services/acumatica_sync.py` | `acumatica_*` mirrors → projected into `direct_costs`, `direct_cost_line_items`, `subcontracts`, `subcontract_sov_items`, `prime_contract_change_orders`, `contract_change_orders`, `commitment_payments`, `subcontractor_invoices` (paid flag), `projects.acumatica_*_synced_at` | Render cron `alleato-acumatica-financial-sync` (2×/day) |
| `promote_signal_candidate` | `backend/src/services/intelligence/compiler.py:1356` | `source_signal_candidates` (RAG, status flip) + `insight_cards` (MAIN) + `insight_card_targets` (MAIN) + `insight_card_evidence` (MAIN) + `packet_refresh_jobs` (RAG, enqueue) | Compiler tick when a candidate's confidence ≥ promotion threshold |
| `compile_current_packet` | `backend/src/services/intelligence/compiler.py:1289` | `intelligence_packets` (MAIN, upsert) + `intelligence_packet_cards` (MAIN, delete+insert) | Compiler tick draining `packet_refresh_jobs` |
| `upsert_app_document_catalog` (within `upsert_document_metadata`) | `supabase_helpers.py:176` | `MAIN.document_metadata` only | Internal helper |

---

# Domain: Projects, People, Companies, Permissions (MAIN)

## Projects core

### `projects` (111 rows)
- **Purpose:** Master project record. Integer `id` is the FK target for nearly every project-scoped table.
- **Schema gotchas:** Several columns are mostly null: `address`, `city`, `state`. `stage` (renamed from `current_phase` in Wave 3) is also mostly null. `project_manager` is FK→`people.id` (uuid). `team_members` is `uuid[]`; `stakeholders` is JSONB. `company_id` (FK → companies.id) is the canonical owner/client link; the legacy `client` text and `client_id` columns were dropped in Wave 3.
- **Writers — cron / sync:**
  - `backend/src/services/acumatica_sync.py:505, :562, :948, :2038` — Acumatica project sync (cron `alleato-acumatica-financial-sync`, 2×/day).
  - `frontend/src/lib/acumatica/export-service.ts:531` — writes `acumatica_project_id` back after exporting a new project to Acumatica.
- **Writers — user actions / API:**
  - `frontend/src/app/api/projects/route.ts:348` (POST), `:378` (DELETE) — projects index page Create/Delete.
  - `frontend/src/app/api/projects/[projectId]/route.ts:38, :94` — project detail edit.
  - `frontend/src/app/api/projects/bootstrap/route.ts:122` — project setup wizard.
  - `frontend/src/app/api/projects/[projectId]/budget/route.ts:313`, `…/budget/lock/route.ts:58, :196` — budget lock flags.
  - `frontend/src/lib/ai/tools/action-tools.ts:778` — AI assistant `updateProject` tool.
- **Readers (140+ call sites):**
  - Pages: every `[projectId]/*` page, executive dashboard, document-metadata admin.
  - Shared queries: `hooks/use-projects.ts`, `lib/supabase/queries.ts`, `project-fetcher.ts`.
  - AI tools (project-tools.ts has 14 call sites): `getProjectDetails`, `getPortfolioOverview`, `getProjectBriefingSnapshot`.
  - Intelligence pipeline (Python): `operating_summary.py`, `teams_compiler.py`, `email_compiler.py`, `compiler.py`, `daily_digest.py`, `project_assignment.py`.
  - Cron routes: `progress-reports`, `acumatica-sync`, `daily-flags`.
- **Gotchas:** `id` is INTEGER (not UUID). Acumatica sync AND manual API can both write — race conditions possible.

### `projects_audit` (9,056 rows)
- **Purpose:** Append-only audit trail of changes to `projects`.
- **Writers/Readers:** Postgres trigger only; no app code touches it.
- **Gotcha:** Only useful via direct SQL. No UI.

### `projects_sync` (empty)
- No code references. Leftover staging table. **Drop candidate.**

### Project ancillary tables

| Table | Rows | Writers | Readers | Notes |
|---|---|---|---|---|
| `project_companies` | 30 | `services/companyService.ts:312,391`; `api/directory/companies/*`; `lib/ai/tools/action-tools.ts:468`; `backend/services/ingestion/project_assignment.py:470` (Graph email assignment) | Directory pages, AI tools, `api/directory/project-companies` | Many-to-many projects↔companies; `company_type` + `status` |
| `project_contact_references` | 6,040 | `backend/services/ingestion/project_assignment.py:453` (Graph sync, 30-min cron) | Same file only | Pipeline-internal — no UI; rows accumulate uncontrolled |
| `project_documents` | 2,030 | `api/projects/[projectId]/documents/*` (user uploads), `[documentId]/route.ts:93, :136` | `api/project-documents`, project home tab data | Project-scoped uploads, parallel to `document_metadata` |
| `project_emails` | 623 | `api/document-center/.../email`, project email-log routes, change-event email + RFQ flows | Email panels (commitments, prime-CO, change-events), AI assistant timeline, progress reports | Distinct from `outlook_email_intake` (raw sync) and `document_metadata` (AI relevance). Use this for outbound + project-matched inbound only |
| `project_attribution_rules` | 514 | `api/admin/project-attribution-rules/*`; `backend/services/ingestion/project_assignment.py:560` (auto-learn from confirmed) | Same admin route GET + `project_assignment.py` | Heuristic rules for Graph email project matching |
| `project_budget_codes` | 2,795 | Acumatica sync, Excel import, project-setup wizard, contract estimate import, admin activate/bulk | Budget, commitments, change-events, estimate import | Per CLAUDE.md FK-validation gate: dropdown sources from this, FK targets `budget_lines` |
| `project_budget_settings` | empty | `api/projects/[projectId]/budget/settings/route.ts:81, :149` | `…/budget/route.ts:127` (read) | Schema exists; no projects have settings saved. UI saves not happening |
| `project_directory_memberships` | 21 | ~25 sites: directory services, invite/permission flows, server actions, AI tools | Same plus shell/route, permission lookups | Core directory M2M; race-protected via `onConflict` upserts |
| `project_progress_reports` | 8 | `lib/progress-reports/server.ts:614, :695, :760` | PDF email + AI-generate routes | Triggered by `api/cron/progress-reports` (weekly) + user-triggered |
| `project_progress_report_photos` | 5 | Same as above (lines `:642, :751`) | Same | Photos for progress reports |
| `project_photos` | empty | Routes exist | Routes exist | Feature shipped, never used |
| `project_photos_punch_items_links` | empty | Routes exist | Routes exist | Same |
| `project_roles` | 356 | `api/projects/[projectId]/directory/roles/route.ts` (CRUD) | Same | Project-specific role definitions |
| `project_role_members` | empty | Referenced but empty — assignment goes through `project_directory_memberships` instead |
| `project_risk_snapshots` | 78 | **No app-level writer found.** Possibly trigger-driven or backend job not in repo. | None | **Suspect orphaned data.** |
| `project_vendors` | 5 | `api/projects/[projectId]/vendors/route.ts:37, :230`, `…/directory/vendors` | Same | User-managed |
| `project_transmittals` | empty | `api/projects/[projectId]/transmittals/route.ts` (CRUD) | Same | Feature shipped, unused |
| `user_project_preferences` | empty | `services/directoryPreferencesService.ts:74, :101, :126` | Same | UI exists; no rows |
| `user_project_roles` | empty | Not found in code | Not found | **Dormant** |
| `user_projects` | empty | Not found | Not found | **Dormant** |
| `project_notification_groups` | empty | None | None | **Dormant** |
| `project_briefings` | empty | None | None | **Dormant** — note: NOT the same as `intelligence_packets` |
| `project_resources` | empty | None | None | **Dormant** |

## Companies + People

### `companies` (652)
- **Purpose:** Master company directory (vendors, clients, subs). `is_vendor` flag drives Acumatica sync.
- **Writers:**
  - `backend/src/services/acumatica_sync.py:762, :765` — Acumatica AP vendor sync.
  - Directory CRUD: `services/companyService.ts:295, :368`, `hooks/use-companies.ts:87`, `hooks/use-clients.ts:81`, `(main)/actions/table-actions.ts:111, :147`.
  - APIs: `api/companies/route.ts:112`, `api/directory/companies/*`, `api/clients/route.ts:48`, `api/projects/bootstrap/route.ts:145`, `api/projects/[projectId]/vendors/route.ts:182, :190`.
  - AI: `lib/ai/tools/action-tools.ts:1212`.
  - Other: `api/company/logo/route.ts:103`.
- **Readers:** ~50 sites (directory pages, AI tools, commitments vendor dropdown, accounting).
- **Gotcha:** there is no `vendors` table or view — every `vendor_id` FK targets `companies.id` and the vendor dropdown returns `companies.id` (verified 2026-06-14; see FORM-FK-VALIDATION-GATE).

### `company_context` (empty)
- **Writers:** `api/admin/company-context/route.ts:96, :105, :117`.
- **Readers:** AI tools (`lib/ai/tools/operational.ts:1813`).
- Admin singleton company-info doc; not yet populated.

### `people` (1,086)
- **Purpose:** Master person directory. UUID `id`. Bridged to auth via `users_auth.auth_user_id`.
- **Writers:** ~15 sites — directory services, contacts page, vendors page, employees data table, user-link reconciliation, auth-guard (auto-create on signup), AI tools.
- **Readers:** ~100 sites (every page that shows a name).

### `person_company_templates` (empty)
- **Writers/Readers:** `lib/permissions.ts:97, :425, :441`; permission API routes; project shell. Feature defined; unused.

### Dormant directory tables
- `subcontractors`, `subcontractor_documents`, `subcontractor_projects` — superseded by `companies` (`is_vendor=true`) + `project_companies`. **Drop candidates.** (`subcontractor_contacts` was dropped 2026-05-15 via migration `20260516020000`.)
- `vendor_contacts` (empty) — UI tries to read; no writer in code.
- `prospects` (empty) — `(main)/directory/prospects/page.tsx` reads/writes; never used.

## Permissions + Auth

### `users_auth` (1 row)
- **Purpose:** Bridge between Supabase auth user (UUID) and `people.id`.
- **Writers (~7 paths):** `services/inviteService.ts:223`, `lib/supabase/auth-guard.ts:66, :100`, `lib/permissions/user-link-reconciliation.ts:249`, `api/auth/signup/route.ts:116`, `api/permissions/users/route.ts:521`, `directory/contacts/page.tsx:669`.
- **Readers:** Many `permissions.ts` and `shell/route.ts` lookups.
- **🚨 Bug:** Only 1 row despite ~7 writer paths. Most signups not producing the bridge row. Investigate.

### `user_profiles` (53 rows — fully backfilled 2026-05-15)
- **Purpose:** Per-user app preferences + `is_admin` flag. Source of truth for the `is_admin` JWT claim issued by the custom access token hook.
- **Writers:** `api/users/me/onboarding/route.ts:19`, `api/permissions/users/route.ts:432`, `api/permissions/users/[personId]/{route,company-template}.ts`, `api/admin/set-admin-status/route.ts:51`, `api/dev/make-admin/route.ts:73`. **Plus:** Postgres trigger backfills auth.users → user_profiles on signup (migration `20260516000000`).
- **Readers:** ~110 sites — but most no longer hit the table directly; the rewritten `is_admin()` reads from JWT (Phase 1.5).
- **Status:** Resolved. 53 rows = every auth.users row. The retired authentication migration runbook is historical evidence only.

### Other permission tables
| Table | Rows | Status |
|---|---|---|
| `user_email_notifications` | empty | UI present, no rows |
| `user_directory_permissions` | empty | Admin-only overrides; no rows |
| `user_module_permissions` | empty | Per-module tool access; same null-fallback as `user_profiles` |
| `user_granular_permission_overrides` | 4 | Active |
| `user_schedule_notifications` | empty | UI present |
| `permission_templates` | 11 | Live — admin UI at `/permissions/templates` |
| `permission_audit_log` | 7 | Auto-written by `lib/permissions.ts:466` |
| `distribution_groups` / `distribution_group_members` | empty | Full CRUD exists in `services/distributionGroupService.ts`; no rows |
| `groups` / `group_members` | empty | **Dormant** |
| `organizations` / `organization_members` | empty | **Dormant** — multi-tenant infrastructure not used |
| `app_roles` | empty | **Dormant** |
| `billing_invitations` | empty | **Dormant** |

## Bot identity

### `bot_user_mappings` (1 row)
- **Purpose:** `(platform, platform_user_id)` → `supabase_user_id`. Drives Teams + Telegram bot identity.
- **Writers:** `lib/bot/index.ts:115, :271`, `lib/bot/teams-chat.ts:331, :363, :566`, `api/admin/teams/seed-conversation/route.ts:252`, `api/settings/teams/link/route.ts:102` (delete), `api/settings/telegram/unlink/route.ts:27`.
- **Readers:** `lib/bot/teams-proactive.ts:19`, `lib/executive/executive-briefing-teams-delivery.ts:333`, `lib/bot/teams-chat.ts:273, :321`, `lib/bot/index.ts:76, :250, :270`, settings routes.

### `teams_conversation_refs` (RLS-protected, count unreliable from pg_class)
- **Purpose:** Per-user proactive thread cache for sending unsolicited Teams messages.
- **Writers:** `lib/bot/teams-chat.ts:154` (upsert per inbound message), `api/admin/teams/seed-conversation/route.ts:234`.
- **Readers:** `lib/bot/teams-chat.ts:86, :94`, `lib/executive/executive-briefing-teams-delivery.ts:317`, `lib/ai/tools/action-tools.ts:3649`.

### `telegram_link_codes` (empty) / `teams_link_codes` (empty)
- Short-lived link codes for bot↔account linking. Empty = no in-progress flows.

---

# Domain: Financial / Acumatica / Contracts (MAIN)

## ⚠️ Two parallel Acumatica sync systems exist

**This is a major gotcha.** Both write to the same `acumatica_*` tables on the same `external_key` conflict target. Both share `acumatica_sync_state` cursors.

1. **Backend Python sync** (`backend/src/services/acumatica_sync.py`) — runs on Render cron `alleato-acumatica-financial-sync` at `0 0,7 * * *` (00:00 + 07:00 UTC daily). **Production-authoritative today.**
2. **Frontend TypeScript mirror sync** (`frontend/src/lib/acumatica/mirror-sync.ts` + `sync-service.ts`) — invoked by `POST /api/cron/acumatica-sync`. **Not scheduled in `render.yaml`**; would need external trigger. 51 historical runs in `erp_sync_log` only.

When investigating "who wrote this row," check both.

## Acumatica ERP mirror tables

All populated by the Render cron `alleato-acumatica-financial-sync` (2×/day) via `acumatica_sync.py`, and optionally by the frontend route. Strictly ERP mirrors — no user actions touch them.

| Table | Rows | Sync path | Side-effects | Read by |
|---|---|---|---|---|
| `acumatica_ap_bills` | 6,399 | `acumatica_sync.py:898`; frontend `mirror-sync.ts:310`, `sync-service.ts:1477,1690` | Projects rows into `direct_costs` + `direct_cost_line_items` (`:905, :943`); updates `projects.acumatica_ap_synced_at` (`:948`) | Accounting pages: ap-invoices, checks, dashboard, bills; AI: `project-operating-summary-sources.ts:684`; `acumatica/export-service.ts:1439` |
| `acumatica_ap_bill_lines` | 4,016 | Delete+reinsert per sync (`:976, :1009`) | — | (joined via parent) |
| `acumatica_accounts` | 154 | **Frontend only** (`mirror-sync.ts:187`) | — | Reference data; no app reads |
| `acumatica_ar_invoices` | 464 | `acumatica_sync.py:1052`; frontend `mirror-sync.ts:252` | `customer_name` backfilled post-sync from `acumatica_customers` (frontend only) | Accounting invoices, dashboard, WIP, global invoices API |
| `acumatica_ar_invoice_lines` | 1,922 | `acumatica_sync.py:1093` | — | (joined) |
| `acumatica_change_orders` | 4,069 | `acumatica_sync.py:1337`; frontend `mirror-sync.ts:436` | Projects into `prime_contract_change_orders` (`:1568`) AND `contract_change_orders` (`:1636`); status mapping via `_map_co_status_prime/_commitment` | AI `project-operating-summary-sources.ts:690` |
| `acumatica_checks` | 2,775 | `acumatica_sync.py:1132`; frontend `mirror-sync.ts:337` | Projects into `commitment_payments` (`:1279`); updates `subcontractor_invoices` paid-flag (`:1198, :1218`) | Accounting checks, dashboard, AP-payments; `accounting/payment-guardrails.ts:29` for duplicate-payment prevention |
| `acumatica_customers` | 58 | **Frontend only** (`mirror-sync.ts:167`) | Reads back at `:882` to backfill `ar_invoices.customer_name` | None directly |
| `acumatica_payments` | 368 | `acumatica_sync.py:1963`; frontend `mirror-sync.ts:282` | — | `accounting/payments`, `accounting/invoices` (paid logic), dashboard |
| **`acumatica_payment_applications`** | 183 | **`acumatica_sync.py`** (Wave 1C, 2026-05-15) writes via `sync_payment_applications()`. Initial 183 rows from backfill; refreshed every 2h. | — | Resolved — invoice-paid logic backed again |
| `acumatica_project_budgets` | 6,172 | `acumatica_sync.py:2035`; frontend `mirror-sync.ts:467` | — | `accounting/wip/route.ts:103` only |
| `acumatica_projects` | 87 | `acumatica_sync.py:556`; also upserts to `projects` table (`:562`); frontend `mirror-sync.ts:208` | Sets `projects.acumatica_project_id` matching key | Accounting routes (invoices/projects/dashboard/bills/wip) |
| `acumatica_project_tasks` | 99 | **Frontend only** (`mirror-sync.ts:231`) | — | Accounting cross-references |
| `acumatica_purchase_orders` | 204 | `acumatica_sync.py:1458`; frontend `mirror-sync.ts:361` | Projects into `purchase_orders` (`:1808`) | AI summaries |
| `acumatica_subcontracts` | 718 | `acumatica_sync.py:1399`; frontend `mirror-sync.ts:387` | Projects into `subcontracts` + `subcontract_sov_items` (`:1738, :1797`) | AI summaries |
| `acumatica_sync_state` | 25 | `acumatica_sync.py:378`; frontend `mirror-sync.ts:553`; cron route `:159` | — | Cursor reads before sync |
| **`acumatica_sync_runs`** | 53 | Writer at `acumatica_sync.py:408` (`_record_sync_run`) | Admin sync-health views | Resolved — populating every 2h since Wave 1C |
| `erp_sync_log` | 51 | **Frontend only**: `api/cron/acumatica-sync/route.ts:231`, `sync-service.ts:299` | — | None (diagnostic) |
| `acumatica_outbound_audit_logs` | empty | Writer exists at `export-service.ts:65`; never used in prod | — | Admin view at `api/admin/acumatica-outbound-logs/route.ts:362` |

## Budget

### `budget_lines` (564)
- **Purpose:** Per-project budget line items. Core operational budget table.
- **Writers (UI/API only — no sync):**
  - `api/projects/[projectId]/budget/route.ts:208, :224, :285, :301` — main budget CRUD.
  - `api/projects/[projectId]/budget/import/route.ts:392` — CSV import.
  - `api/projects/[projectId]/budget/lines/[lineId]/route.ts:101, :253, :323, :395, :471` — line edits.
  - `api/projects/[projectId]/budget/forecast/route.ts:304, :357, :585` — forecast.
  - `api/projects/[projectId]/budget/modifications/route.ts:292` — apply mods.
  - `api/projects/[projectId]/budget/lock/route.ts:179` — lock snapshot.
  - `api/projects/bootstrap/route.ts:240` — new-project seed.
- **Readers:** Budget page, commitments line-item import, change events, AI tools (`financial.ts:151`), home dashboard, checklist, PSR, exports (25+ files).
- **Gotchas:** `change_event_line_items.budget_code_id` FK→`budget_lines` but the dropdown sources from `project_budget_codes` — there is no `project_cost_codes` table (FORM-FK-VALIDATION-GATE; resolve via `budget_lines.project_budget_code_id`). Every change mirrored into `budget_line_history` via Postgres trigger.

### `budget_line_history` (1,696)
- **Writers:** Postgres trigger `budget_line_changes_after_write` + `budget_line_delete_before` (migration `20260426000001`). No app code.
- **Readers:** Budget history tab routes.

### `budget_modifications` (22) / `budget_mod_lines` (32)
- **Purpose:** Budget revisions (formal modification documents) and their line deltas.
- **Writers:** `api/projects/[projectId]/budget/modifications/route.ts` (8 sites); `…/lock/route.ts:148` writes a "Lock" mod; `…/details/route.ts:121, :166` writes from details view.
- **Name collision:** `budget_modification_lines` (with plural "ation") is empty; `budget_mod_lines` is the live table.

### Smaller budget tables
- `budget_changes` (1) — older mechanism predating modifications. **Effectively dead.**
- `budget_views` (63) + `budget_view_columns` (312) — UI column-layout state.
- `cost_codes` (310), `cost_code_divisions` (40), `cost_code_types` (6) — global master tables.
- **Dormant:** `budget_forecast_line_items`, `budget_line_forecasts`, `budget_line_item_history`, `budget_snapshots`, `budget_modification_lines`, `cost_factors`, `cost_forecasts`, `cost_code_division_updates_audit`.

## Direct costs

### `direct_costs` (6,555) / `direct_cost_line_items` (8,436)
- **Purpose:** Domain projection of `acumatica_ap_bills`. Project-attributed AP charges with lines.
- **Writers:**
  - Sync: `acumatica_sync.py:905, :915, :926, :943`; frontend dual: `sync-service.ts:546-604`.
  - UI: `lib/services/direct-cost-service.ts` (11 sites).
- **Readers:** Direct-costs page, vendor detail, AI financial tools, project operating summary, budget direct-costs route.
- **Gotcha:** `acumatica_document_key` is the upsert key — do not edit manually. `direct_cost_line_items` is delete+reinsert per sync.

## Subcontracts + Commitments

### `subcontracts` (398)
- **Writers:** Sync (`acumatica_sync.py:1738, :1746`); UI (`api/projects/[projectId]/subcontracts/route.ts:98, :163`); commitment routes for metadata.
- **Audit:** Postgres trigger `trg_audit_subcontracts` → `commitment_audit_log`.

### `subcontract_sov_items` (964)
- **Live SOV table** for subcontract line items. Source for subcontractor invoicing.
- **Name collision:** `subcontractor_sov_items` (only 2 rows) is the near-dead sibling for subcontractor-portal submissions.

### `subcontractor_invoices` (2,433) / `subcontractor_invoice_line_items` (12)
- **Purpose:** Subcontractor pay applications. Full state machine UI under `api/projects/[projectId]/invoicing/subcontractor/invoices/*`.
- **Sync side-effect:** `acumatica_sync.py:1198` flips paid flag when matching check found.
- **Gotcha:** Only 12 line items for 2,433 invoices — legacy invoices imported header-only.

### `subcontractor_invoice_audit_log` (2,444)
- App-level audit log; hand-rolled inserts scattered across invoice routes. No DB trigger backstop — missing inserts mean silent gaps.

### `commitment_audit_log` (852)
- Postgres trigger-driven; covers `subcontracts` + `purchase_orders` mutations.

### `commitment_payments` (2,775)
- Mirror of relevant `acumatica_checks`. Only backend Python sync writes.

## Prime contracts + change orders + PCOs

### `prime_contracts` (21)
- **Routes:** Live under `/api/projects/[projectId]/contracts` (NOT `/prime-contracts` per MEMORY.md).
- Bootstrap creates one only when project has owner info — only 21 rows for ~87 active projects.

### `prime_contract_change_orders` (142)
- Projected from `acumatica_change_orders` by sync status mapping; user-facing routes for create/approve/reject.

### `prime_contract_payments` (26)
- Barely used; most owner payments tracked via `acumatica_payments` + invoice join.

### `prime_contract_change_order_related_items` (1) / `prime_contract_project_settings` (1) — barely used

### `contract_change_orders` (140) / `contract_line_items` (140)
- **🚨 Misleading name:** stores **commitment-side** change orders (subcontracts/POs), NOT prime CCOs.
- Routes: `api/commitments/[commitmentId]/change-orders/*`, `api/projects/[projectId]/commitment-change-orders/**`, `api/projects/[projectId]/commitment-pcos/{[pcoId]/promote, promote-bulk}` (PCO→CCO promotion).

### `contract_documents` (1)
- Effectively unused.

## Change events

| Table | Rows | Status |
|---|---|---|
| `change_events` | 77 | Live — project-level change event creation, neutral upstream object |
| `change_event_line_items` | 54 | Line-item detail per change event |
| `change_event_history` | 43 | Hand-rolled audit at `…/change-events/[changeEventId]/route.ts:668, :798`, `attachments/route.ts:199, :348`, `restore/route.ts:71` |
| `change_event_rfqs` | 6 | RFQs sent from a change event |
| `change_event_rfq_responses` | 1 | Vendor responses to RFQs |
| `change_event_approvals` | empty | **Dormant** |
| `change_event_attachments` | empty | Writers exist; never populated |
| `change_event_pco_links` | empty | **Dormant** |
| `change_event_related_items` | empty | **Dormant** |
| `change_events_documents_links` | empty | **Dormant** |
| `pco_change_events` | empty | **Dormant** |
| `pco_line_items` | empty | **Dormant** |
| `pco_versions` | empty | **Dormant** |
| `potential_change_orders` | empty | **Dormant** |
| `change_workflow_comments` | empty | **Dormant** |
| `change_workflow_notifications` | empty | **Dormant** |
| `change_orders` (generic) | empty | **Dormant** — all CO data lives in contract-prefixed tables |

## Purchase orders

### `purchase_orders` (129) / `purchase_order_sov_items` (198)
- Domain PO + SOV items. Populated from `acumatica_purchase_orders` and via UI.
- Postgres audit trigger `trg_audit_purchase_orders` → `commitment_audit_log`.

## Owner invoicing

### `owner_invoices` (29) / `owner_invoice_line_items` (604)
- **Purpose:** Invoices we send to the owner/client (pay applications outbound).
- Full state machine UI under `api/projects/[projectId]/invoicing/owner/*`. Avg 20 lines/invoice — line-item granularity is in active use here (unlike subcontractor invoices).

## Estimates

| Table | Rows | Status |
|---|---|---|
| `estimates` | 5 | Live, low usage |
| `estimate_line_items` | 495 | Live — main cost-of-work breakdown |
| `estimate_detail_items` | 615 | Live — sub-line drill-downs |
| `estimate_gc_items` | 281 | Live — general-conditions items |
| `estimate_alternates` | empty | **Dormant** |
| `estimate_allowances` | empty | **Dormant** |
| `estimate_sublist_subs` | empty | **Dormant** |
| `qto_items` / `qtos` | empty | **Dormant** |

Estimate-import is the bridge from estimates → budget (`project_budget_codes`) and contract line items.

## Schedule of Values

`schedule_of_values` (empty), `sov_line_items` (empty) — **referenced as readers in AI tools (`financial.ts:241, :287, :1207`) but NEVER written.** Dead reads.

## Dormant / unused (financial domain)

- `vertical_markup`, `financial_contracts`, `forecasting`, `forecasting_curves` — never written
- `invoice_attachments`, `invoice_payments`, `invoicing_settings`, `payment_application_line_items`, `payment_transactions`, `billing_periods`, `contract_billing_periods`, `contract_payments`, `contract_snapshots`, `contract_views`
- `sub_jobs`, `subcontract_attachments`, `subcontractor_invoice_emails`, `subcontractor_invoice_related_items`, `commitment_pcos`, `commitment_related_items`
- `prime_contract_payment_applications`, `prime_contract_pcos`, `prime_contract_pco_attachments`, `prime_contract_sovs`, `pcco_attachments`, `pcco_line_items`, `cco_attachments`
- `purchase_order_attachments`

---

# Domain: Documents, Communications, Storage (MAIN + RAG)

## The document pipeline (Outlook → Fireflies → Upload)

```
SOURCE (outlook / fireflies / storage upload)
   │
   ▼
upsert_document_metadata()           [supabase_helpers.py:156]  ── dual-write
   │   ├─► MAIN.document_metadata       (catalog — full business metadata)
   │   └─► RAG.rag_document_metadata    (embedding catalog — content + pipeline state)
   │
   ▼
parser / financial_parser           ─► meeting_segments
   │
   ▼
embedder                              [pipeline/embedder.py:477]
   └─► RAG.document_chunks               (halfvec 3072)
   │
   ▼
AI tools: rpc("search_document_chunks")  [operational.ts:1369, document-intelligence.ts:238]
```

## Documents

| Table | DB | Rows | Status |
|---|---|---|---|
| **`document_metadata`** | MAIN | 36,855 | LIVE — primary catalog. Written by `upsert_document_metadata` (called from all ingestion paths) + admin upload routes. **New column `document_type`** FK → `document_type_taxonomy(type_key)`; 30,288/36,855 rows populated (Phase 4 Day 2 backfill, migration `20260520030000`); 6,567 await Phase 9 LLM categorization. Actual category distribution (not 99% generic as previously claimed): 74% `teams_message`, 14% `document` generic, 7% `email`, 4% null, rest distributed |
| **`rag_document_metadata`** | RAG | 36,657 | LIVE — embedding-side mirror. `app_document_id` FK back to MAIN.id. ONLY backend pipeline reads it |
| **`document_chunks`** (RAG) | RAG | 109,171 | LIVE — THE unified vector store. `pipeline/embedder.py:477` upsert/`:487` delete. AI tools read via `rpc("search_document_chunks")` |
| `document_chunks` (MAIN) | MAIN | 103,255 | **🚨 STALE** — do not write. RAG is canonical. `database.types.ts` keeps declaration only for typing |
| `documents` (LEGACY) | MAIN | 12,471 | Project-setup wizard still writes via `project-setup-wizard/*-setup.tsx`. Parallel to `document_metadata`. Migration target |
| `document_rows` | MAIN | 12,354 | Loaded by ETL outside the repo; read by `tools/structured-queries.ts:436, :555` |
| `document_attribution_candidates` | both | MAIN 13,233 / RAG 13,193 | LIVE review queue from `ingestion/project_assignment.py`. **No UI shipped yet** (known gap) |
| `document_user_access` | MAIN | empty | **LOAD-BEARING — DO NOT DROP.** Wired into RLS policies on `document_metadata`/`document_rows`/`document_chunks` via FK CASCADE (migration `20260427130000_secure_rag_documents_rls.sql`). Per-document ACL override. Empty because management UI isn't built yet |
| `document_group_access` | MAIN | empty | **LOAD-BEARING — DO NOT DROP.** Same RLS wiring as `document_user_access`, but group-scoped |
| `document_insights` | MAIN | empty | **Dormant** |
| `document_executive_summaries` | MAIN | empty | **Dormant** |
| `documents_rfis_links` | MAIN | empty | **Dormant** |
| `documents_submittals_links` | MAIN | empty | **Dormant** |
| `search_documents` | MAIN | 4 | Scratch table — no code references. **Drop candidate.** |
| **`document_type_taxonomy`** | MAIN | 23 | LIVE — Pattern C unified file taxonomy (Phase 4 Day 1). Referenced by `document_metadata.document_type` and by junction tables (`submittal_documents.document_type`, etc.). Categories: contract, compliance, closeout, permit, drawing, photo, communication, financial, other. The applies_to array drives the per-entity file-picker dropdown |
| **`submittal_documents`** | MAIN | LIVE | Pattern C junction (Phase 4 Day 3). Submittal ↔ document_metadata, with `document_type` FK. RLS inherits from parent submittal access |

## Drawings (all MAIN)

All 8 active drawing tables owned by `frontend/src/services/Drawing*Service.ts` and `api/projects/[projectId]/drawings/*`. No backend pipeline writes. Storage bucket: `drawings`.

| Table | Rows | Owner |
|---|---|---|
| `drawings` | 44 | `DrawingService.ts`, `api/projects/[projectId]/drawings/route.ts` |
| `drawing_revisions` | 44 | `DrawingRevisionService.ts` |
| `drawing_sets` | 14 | `DrawingSetService.ts` |
| `drawing_downloads` | 1,400 | `download/route.ts`, `bulk-download/route.ts` |
| `drawing_change_history` | 11 | `change-history/route.ts`, `publish`, `obsolete` |
| `drawing_markup_pins` | 11 | `pins/route.ts` |
| `drawing_areas` | 1 | (admin only) |
| `drawing_sketches`, `drawing_related_items`, `drawings_rfis_links` | empty | **Dormant** |

## Email (Outlook)

```
Graph cron `alleato-graph-sync` (every 2h)
  └─► sync_outlook_emails (outlook.py:310)
        ├─► outlook_email_intake             (insert/update msg)
        ├─► outlook_email_intake_attachments (insert + storage upload)
        ├─► document_metadata + rag_document_metadata (via upsert_document_metadata when AI-relevant)
        └─► project_emails (if project-matched)
```

| Table | Rows | Writers | Readers |
|---|---|---|---|
| `outlook_email_intake` | 812 | `outlook.py:532-562, :750-752, :1695`; `intake_reclassification.py:78, :163`; `attachment_promotion.py` | `api/outlook-intake/*`, `api/email-attachments/[id]`, AI tools `outlook-operations.ts`, `operational.ts:2991` (`getRecentEmails`) |
| `outlook_email_intake_attachments` | 627 (355 MB) | `outlook.py:883-894`, `attachment_promotion.py:161-238`. **Promotion worker wired into `run_graph_sync()` post-Wave-1E.** Promotes pending attachments to `document_metadata` with `source_system='graph_attachment'`; respects `promotion_attempt_count` retry cap. | Outlook-intake routes, email-attachment routes. Schema has `promotion_status`, `promotion_reason`, `promotion_attempt_count`, `promoted_at`, `document_metadata_id` — no redesign needed |
| `email_attachments` | 419 (391 MB) | `api/email-attachments/route.ts`, `api/projects/[projectId]/email-attachments/[id]/route.ts` (insert/update/delete) | Same | Separate in-app attachment store (manual upload + change-event/contract attachments). NOT the same as outlook_email_intake_attachments |
| `project_emails` | 623 | `outlook.py` project-assignment + outbound API routes (5 places) | Email panels, AI assistant timeline, progress reports |
| `outlook_email_skip_audit` | empty | None | None | **Dormant** |
| `email_events` / `email_messages` | empty | None | None | **Dormant** |

**Tool routing reminder:** `getRecentEmails` queries `outlook_email_intake` by date; `searchEmails` does vector via `document_chunks`. Don't confuse.

## Meetings

```
Fireflies API ─► fireflies_ingestion_jobs queue (27K rows)
   └─► pipeline orchestrator
       ├─► document_metadata + rag_document_metadata
       ├─► meeting_segments (transcript chunks + summary embeddings)
       └─► embedder fans chunks to document_chunks
```

| Table | Rows | Notes |
|---|---|---|
| `fireflies_ingestion_jobs` | 27,095 | LIVE queue. Writers: `scheduler.py`, `refresh_fireflies_transcripts.py`, `api/documents/trigger-pipeline` |
| `meeting_segments` | 19,527 | LIVE — transcript chunks + summary embeddings. Writers: `parser.py:275`, `financial_parser.py:332`, `document_parser.py:434`, `embedder.py:263`. Read by meeting pages, lib/projectIntelligence |
| `daily_recaps` | 49 | LIVE — but legacy. Written by `daily_digest.py:290`. Used by `daily-reports` page + executive briefing workflow + admin readiness |
| `briefing_runs` / `meeting_preps` | empty | **Dormant** |

## Chat (only 2 of 11 tables are live)

| Table | Rows | Status |
|---|---|---|
| **`chat_history`** | 2,908 | LIVE — message-level persistence for Eve, Ask Alleato, feedback, and dedicated chat products. Canonical Eve projection writer: `/api/ai-assistant/messages/[sessionId]`. |
| **`conversations`** | 226 | LIVE — session/thread metadata. Canonical owner: `/api/ai-assistant/conversations`. |
| ~~`chat_messages`, `chat_sessions`, `chat_threads`, `chat_thread_items`, `chat_thread_attachments`, `chat_thread_attachment_files`, `chat_thread_feedback`~~ | DROPPED | Dropped 2026-05-15 via migration `20260516020000_drop_dead_legacy_tables.sql`. Verified zero code references first. |
| `chats`, `messages`, `notes` | empty | **Still empty, no code references.** Remaining drop candidates |

## Teams Bot + Team Chat

| Table | Rows | Notes |
|---|---|---|
| `bot_user_mappings` | 1 | LIVE — see "Bot identity" under projects domain |
| `teams_conversation_refs` | RLS-protected | LIVE — per-user proactive thread cache. Upserted on every Teams message |
| `bot_debug_log` | 336 | LIVE observability — `teams-chat.ts:186`. Not read in app |
| `team_chat_channels` | 2 | LIVE |
| `team_chat_messages` | empty | Wired but unused |
| `telegram_link_codes` / `teams_link_codes` | empty | Short-lived; populated on-demand |

## Files, Attachments, Photos

| Table | Rows | Notes |
|---|---|---|
| `files` | 2 | LIVE — project-setup wizard file index. Storage buckets: `drawings`, `specifications`, `schedules`. Parallel to `documents` legacy |
| `project_progress_report_photos` | 5 | LIVE — written by progress-report flow |
| `attachments`, `photos`, `photo_albums`, `photo_links`, `project_photos`, `observation_photos`, `daily_logs_project_photos_links` | empty | Routes fully wired (insert/update/restore/upload) but ZERO DATA. Photo feature shipped never adopted |

## Supabase Storage buckets

| Bucket | Used by |
|---|---|
| `documents` | Knowledge upload, generic document upload, marketing-service, project-setup document upload |
| `drawings` | DrawingFileService, drawings-setup wizard, drawing revisions/sketches APIs |
| `specifications` | SpecificationService, SpecificationRevisionService, specifications-setup wizard |
| `schedules` | Schedule-setup wizard |
| `project-files` | Photos upload, change-event/contract/commitment/prime-CO/submittal attachments |
| `dev-assets` | `api/dev/annotate`, `api/dev/violations` (admin/dev only) |

`document_metadata.storage_bucket` + `storage_path` columns point into these (mostly `documents` for Graph-ingested, `project-files` for in-app uploads).

---

# Domain: Intelligence, AI, Sync, Workflow

## Pipeline B (the AI brain)

Canonical compiler: `backend/src/services/intelligence/compiler.py` (1,976 lines).
Feeder compilers: `email_compiler.py` (1,274 lines), `teams_compiler.py` (1,086 lines).
Compiler version stamp: `ai_intelligence_compiler_v0_1`.

### Lifecycle: how an insight card is created

1. **Ingestion** writes a `source_document` (in MAIN.document_metadata via the dual-write) and enqueues a row in `source_intelligence_jobs` (RAG) via `enqueue_source_intelligence_job` (`compiler.py:631`).
2. **Compiler tick** — APScheduler in FastAPI, every 10 min (`scheduler.py:340-370`):
   - Claims up to 10 rows from `source_intelligence_jobs` (`claim_queued_source_jobs`).
   - For each, runs `process_source_document_to_packet` → `process_source_document` (`compiler.py:1785`).
   - Classifies the doc → writes a row in `source_signal_candidates` (RAG). For weak project attribution → row in `document_attribution_candidates` (RAG).
   - On `confidence='high'`: `promote_signal_candidate` (`:1356`) flips candidate to `promoted`, upserts `insight_cards` (MAIN), writes `insight_card_targets` + `insight_card_evidence` (MAIN), enqueues `packet_refresh_jobs` (RAG).
3. **Packet refresh** — same batch claims from `packet_refresh_jobs` and runs `compile_current_packet` (`:1289`): reads live `insight_cards` joined via `insight_card_targets`, upserts `intelligence_packets` (MAIN), clears + re-inserts `intelligence_packet_cards` (MAIN).

### Refresh enqueue and drain

- **Event-driven** (priority 10): on every promotion.
- **Periodic** (priority 20): Render cron `alleato-packet-refresh-periodic` at `0 2,9,15,21 * * *` (4×/day). Runs `scripts/enqueue_periodic_packet_refresh.py`.
- **Production drain**: Render cron `alleato-intelligence-compiler-drain` at `0 * * * *` when present. Calls `scheduler._run_intelligence_compiler` and drains both queues regardless of how rows were enqueued. The FastAPI web process keeps the in-process scheduler disabled in production.

### Pipeline B table inventory

| Table | DB | Rows | Role |
|---|---|---|---|
| `intelligence_targets` | MAIN | 77 | Registry of compile-able targets (`client_project`, etc). `status='active'` gates refresh. Writers: `compiler.py:597` `ensure_client_project_target`; `executive-briefing-actions.ts`. Read by packet-service, owner-briefing-builder, insight-cards helper, periodic refresh script |
| `intelligence_packets` | MAIN | 83 | Rendered briefing per target — latest snapshot. Writer: `compile_current_packet` (`compiler.py:1310-1326` upsert). Readers: `packet-service.ts`, `owner-briefing-builder.ts`, `project-operating-summary-sources.ts`, admin operations-readiness |
| `intelligence_packet_cards` | MAIN | 2,230 | Packet ↔ insight_card join with section + rank. Wiped + re-inserted on every refresh (`:1329-1349`) |
| `insight_cards` | MAIN | 5,991 | The durable extracted signals. Writers: `_upsert_insight_card_from_candidate` (`compiler.py:996`); `ai-memory-service.ts` (manual); `project-operating-summary-sources.ts`. Readers: acknowledge/snooze APIs, `financial-insights/scan`, `cron/daily-flags`, all AI tools, owner briefing, marketing service |
| `insight_card_evidence` | MAIN | 6,185 | Card ↔ source document join. FK to `document_metadata`/`source_documents`. Writer: `_write_insight_card_evidence` (`compiler.py:1125-1163`) |
| `insight_card_targets` | MAIN | 5,990 | Card ↔ target join with `is_primary` flag. Writer: `_ensure_insight_card_target` (`compiler.py:1088`) |
| `intelligence_reviews` | MAIN | empty | Human review queue. Insert paths exist (`packet-service.ts:514`, `feedback-event-service.ts:833`) but no UI |
| **`packet_refresh_jobs`** | **RAG** | 1,530 | Refresh job queue. Writers: `enqueue_packet_refresh`, `mark_packet_refresh_succeeded/failed`, `claim_queued_packet_refresh_jobs`, periodic refresh script. **MAIN copy (1,373) is stale/orphan** — all live writes go to RAG via `_rag_write()` |

### Source-signal feeders (RAG canonical)

| Table | DB | Rows | Role |
|---|---|---|---|
| `source_signal_candidates` | both | MAIN 6,670 / **RAG 7,527** | Pre-promotion candidates. Writers: `compiler.py:767` `write_source_signal_candidate`; `teams_compiler.py:745`, `email_compiler.py:836` (delete-and-replace on recompile) |
| `source_intelligence_jobs` | both | MAIN 10,587 / **RAG 11,071** | Compiler job queue. Writers: `enqueue_source_intelligence_job`, `mark_source_job_succeeded/failed`, `claim_queued_source_jobs`; ingestion services |
| `document_attribution_candidates` | both | MAIN 13,233 / RAG 13,193 | Low-confidence project attribution review queue. Writers: `compiler.py:820`, both compilers, `communication_project_backfill.py:141`. Readers: `/api/admin/project-attribution-candidates` (no UI) |
| `project_attribution_rules` | MAIN | 514 | Heuristic rules driving project assignment. Writers: `/api/admin/project-attribution-rules`, `project_assignment.py:560` (auto-learn) |

## Pipeline state / sync infrastructure

| Table | Rows | Notes |
|---|---|---|
| `source_sync_runs` | 3,478 MAIN / 3,639 RAG | Per-sync-run audit. Writers: `microsoft_graph/sync.py`, `outlook.py`, `project_documents.py`, Acumatica sync. Readers: admin AI system health, operations readiness, source-sync-summary, owner-briefing-delivery |
| `source_sync_health_snapshots` | 330 | Snapshots from `_run_source_sync_health_recompute`. Writer: cron `alleato-source-sync-health` (`*/30 * * * *`) |
| `graph_subscriptions` | (RLS-protected) | Microsoft Graph webhook subscriptions. Writers: `subscriptions.py`, `webhooks.py` (renewal/lifecycle), reconcile endpoint. Readers: source-health, outlook-operations tools |
| `graph_sync_state` | 325 | Per-resource delta sync tokens |
| `ingestion_jobs` | 431 MAIN / 436 RAG | Generic ingestion audit |
| `erp_sync_log` | 51 | Acumatica frontend-sync audit only |
| `system_alerts` | 646 | Health alert sink. Writers: `source_sync_health.py`, `source_rag_health.py` |
| `sources` | 1,218 | Source registry (canonical list of ingestion sources) |
| `pipeline_config`, `rag_pipeline_state`, `processing_queue`, `sync_status`, `ingestion_dead_letter` | empty | **Dormant** |

## AI assistant feedback + memory

| Table | Rows | Notes |
|---|---|---|
| `ai_memories` | 27,990 | LIVE long-term assistant memory. Writers: `ai-memory-service.ts`, `/api/ai-assistant/memories`, workspace-artifact promotions |
| `memories` | 8 | Historical conversation-summary rows. No active writer; current durable memory uses `ai_memories`. |
| `ai_retrieval_feedback` | 1,948 | Thumb/score feedback on retrieval results. Writer: `feedback-event-service.ts:710` |
| `ai_feedback_events` | empty | Wired but unused. Writer: `feedback-event-service.ts:488` |
| `ai_learning_promotions` | empty | Wired but unused. Writer: `feedback-event-service.ts:600` |
| `ai_retrieval_weights` | empty | Wired but unused |
| `ai_review_feedback`, `ai_task_feedback`, `ai_analysis_jobs`, `ai_models`, `ai_tool_write_audits` | empty | **All dormant** |

## Daily recaps + executive briefing (legacy + current)

| Table | Rows | Notes |
|---|---|---|
| `daily_recaps` | 49 | **Legacy** executive briefing packet. Still used by `alleato-executive-daily-brief-*` Render crons. Writers: `executive-briefing-workflow.ts`, `executive-briefing-actions.ts`, `executive-briefing-teams-delivery.ts` |
| `executive_briefing_follow_ups` | 108 | Follow-up actions from briefings |
| `project_risk_snapshots` | 78 | Per-project risk roll-up. Writer not on grep path — check `operating_summary.py` |
| `initiative_cards` | 8 | Strategic initiative cards (separate from `insight_cards`). Writers: `/api/initiative-cards/*`, `executive-briefing-actions.ts` |
| `briefing_runs` | empty | **Dormant** |
| `project_briefings` | empty | **Dormant** — NOT same as `intelligence_packets` |

## Workflow + tasks

| Table | Rows | Status |
|---|---|---|
| `tasks` | 845 | LIVE. Writers: `backend/services/task_extraction.py` (cron `alleato-task-extraction`, daily 7 AM UTC); `teams_compiler.py`. Read across project pages + executive views |
| `task_comments` | empty | Routes exist; no data |
| `todos` | empty | Used by SOV service (`lib/commitments/subcontractor-sov-service.ts`); empty |
| `rfis` | 11 | LIVE. Routes: `/api/projects/[projectId]/rfis/*` |
| `submittals` | 1 | LIVE. Routes: `/api/projects/[projectId]/submittals/*` |
| `schedule_tasks` | 241 | LIVE. Schedule tool surface |
| `punch_items` | 6 | LIVE. Punch-list pages |
| `recurring_issues` / `recurring_issue_evidence` | 5 / 9 | LIVE. Pattern-detection vertical (separate from insight_cards) |
| `feature_requests` | 1 | LIVE. Roadmap surface |
| `roadmap_items` | 10 | LIVE. `/api/admin/roadmap/*` |
| `admin_feedback_items` | 291 | LIVE. `/api/admin/feedback/*` — in-app feedback inbox |

## Marketing vertical (entirely dormant)

`marketing_intelligence_items`, `marketing_content_calendar_items`, `marketing_content_assets`, `marketing_performance_snapshots`, `initiatives`, `workspace_artifacts` — all 0 rows. The CMO tool path in `handler-v2.ts` writes here but has no production traffic.

## Dormant workflow tables

- `rfi_assignees`, `rfis_submittals_links`
- All `submittal_*` auxiliaries except `submittal_workflow_templates` (1)
- `schedule_deadlines`, `schedule_dependencies`
- All `specification_*` except `specification_section_revisions` (1)
- `punch_item_comments`, `punch_item_templates`, `punch_item_template_categories`
- `inspections`
- All `observation_*`
- All `daily_log*`
- `transmittal_items`
- `issues`, `discrepancies`, `timeline_events`, `requests`
- `implementation_plans`, `execution_handoffs`
- `collaboration_comments`, `collaboration_notifications`
- `recurring_issue_projects`, `reviews`, `review_comments`
- `feature_request_events`, `feature_request_linear_events`, `feature_request_linear_sub_issues`
- `admin_feedback_comments`

---

# RAG database tables (14 total)

The RAG project (`fqcvmfqldlewvbsuxdvz`) holds the embedding/content layer plus pipeline state. Most tables are mirrors of MAIN counterparts; rows in RAG are CANONICAL for these.

| Table | Rows | Live? | Notes |
|---|---|---|---|
| `document_chunks` | 109,171 | ✅ canonical | Vector store. MAIN copy (103K) is stale |
| `rag_document_metadata` | 36,657 | ✅ live mirror | `app_document_id` FK back to MAIN |
| `fireflies_ingestion_jobs` | 27,230 | ✅ canonical | Meeting ingest queue |
| `document_attribution_candidates` | 13,193 | ✅ canonical | Attribution review queue |
| `source_intelligence_jobs` | 11,071 | ✅ canonical | Compiler job queue |
| `source_signal_candidates` | 7,527 | ✅ canonical | Pre-promotion candidates |
| `source_sync_runs` | 3,639 | ✅ canonical | Per-run audit log |
| `source_processing_jobs` | empty | ✅ canonical | Per-source lifecycle/status ledger across assignment, RAG indexing, signals, and project intelligence |
| `pipeline_model_usage` | growing | ✅ canonical | Model usage, estimated-cost, and daily budget-block ledger |
| `packet_refresh_jobs` | 1,530 | ✅ canonical | Packet refresh queue |
| `ingestion_jobs` | 436 | ✅ canonical | Generic ingest audit |
| `source_sync_health_snapshots` | 330 | ✅ canonical | Sync health rollup |
| `ingestion_dead_letter` | empty | wired | DLQ for failed ingestions |
| `rag_pipeline_state` | empty | wired | Pipeline-state metadata |

---

# Domains lightly scanned (FM Global / ASRS / Procore / Test / Support)

These are smaller domains. Quick code-reference scan only — deeper investigation pending if active development resumes.

## FM Global / ASRS (sprinkler design vertical)

Most tables here have **zero code references** — feature build started, not finished.

| Table | Files referencing | Status |
|---|---|---|
| `fm_global_tables` | 5 | Lightly used |
| `fm_form_submissions` | 4 | Lightly used |
| `fm_global_figures` | 3 | Lightly used |
| `fm_sections` | 2 | Lightly used |
| `fm_sprinkler_configs` | 1 | Lightly used |
| `asrs_sections` | 2 | Lightly used |
| `asrs_blocks` | 1 | Lightly used |
| `design_violations` | 1 | Lightly used |
| `fm_blocks`, `fm_cost_factors`, `fm_documents`, `fm_table_vectors`, `fm_text_chunks`, `asrs_configurations`, `asrs_decision_matrix`, `asrs_logic_cards`, `asrs_protection_rules`, `block_embeddings`, `design_recommendations` | 0 | **Dormant** |

## Procore-related (one-off Procore parity work)

| Table | Files referencing | Status |
|---|---|---|
| `procore_tools` | 10 | LIVE — admin Procore parity tracker |
| `procore_features` | 7 | LIVE — parity audit |
| `procore_pages` | 4 | LIVE |
| `procore_modules` | 2 | LIVE |
| `procore_screenshots` / `procore_capture_sessions` | 2 each | LIVE — admin crawler artifacts |
| `qa_page_audit` | 2 | LIVE — QA audit results |
| `procore_components`, `procore_feature_implementations` | 0 | **Dormant** |

## Support articles / knowledge

| Table | Rows | Files | Notes |
|---|---|---|---|
| `support_articles` | 2,205 | 6 | LIVE — knowledge base content |
| `support_article_chunks` | 5,219 | 2 | LIVE — knowledge base embeddings |
| `nods_page` | (empty) | 2 | LIVE — page registry |
| `chunks` | (empty) | 1 | Generic chunks; likely test/legacy |
| `code_examples`, `nods_page_section` | 0 | 0 | **Dormant** |

## Test / admin / dev infrastructure

| Table | Files | Notes |
|---|---|---|
| `test_cases` / `test_results` / `test_runs` / `test_suites` / `test_screenshots` | 12/12/8/9/3 | LIVE — test plan / smoke test framework |
| `database_tables_catalog` | 6 | LIVE — schema metadata for admin |
| `dev_annotations` / `dev_panel_comments` | 4/2 | LIVE — dev/admin annotation overlay |
| `app_error_events` / `app_error_groups` | 3/4 | LIVE — error tracking |
| `app_pages` | 2 | LIVE |
| `app_ui_tables` / `app_crawl_sessions` | 2/2 | LIVE |
| `app_system_actions` | 1 | LIVE |
| `table_metadata` | 1 | LIVE |
| `app_parity_checks`, `app_schedule_*`, `app_system_states`, `app_ui_components`, `app_ui_table_columns`, `admin_view_backups` | 0 | **Dormant** |

---

# Cleanup recommendations (priority order)

1. ~~`user_profiles` bug~~ — resolved 2026-05-15. `users_auth` 1-row bug still open.
2. ~~`acumatica_payment_applications` writer gap~~ — resolved 2026-05-15 (Wave 1C).
3. ~~Drop dead chat schema~~ — `chat_messages`, `chat_sessions`, `chat_threads`, `chat_thread_*` dropped 2026-05-15. `chats`, `messages`, `notes` remain as candidates.
4. **Drop dormant subcontractor tables** — `subcontractor_documents`, `subcontractor_projects` still candidates. (`subcontractor_contacts` dropped 2026-05-15.)
5. **Truncate MAIN orphan copies** of `document_chunks`, `packet_refresh_jobs`, `source_signal_candidates`, `source_intelligence_jobs` (canonical lives in RAG).
6. **Decide on `documents` vs `document_metadata`** — they're parallel project file indexes.
7. **Drop dead CO/PCO variants** — `change_orders` generic, all dormant `pco_*`, `pcco_*`, `cco_*`, `change_event_*` link tables.
8. **Drop empty marketing vertical** if you're not building it.
9. **Drop empty observation / daily_log / specification / submittal / inspection auxiliaries** unless those features are imminent.
10. **`search_documents` (4 rows, no code)** — drop.
11. **`budget_modification_lines` (empty, dead twin of `budget_mod_lines`)** — drop.
12. **`subcontractor_sov_items` (2 rows, near-dead twin of `subcontract_sov_items`)** — investigate before drop.

If you applied all of the above, you'd remove ~120 tables and ~30K stale rows. The active surface of the system is closer to ~85 tables, not 327.
