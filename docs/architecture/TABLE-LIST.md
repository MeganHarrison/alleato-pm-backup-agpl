# Database Tables — Live List

> **AUTO-GENERATED — DO NOT EDIT BY HAND.**
> Regenerate with `npm run db:inventory`. Source: `docs/architecture/tables.yaml` + live Supabase stats.
> Last generated: 2026-07-24T06:42:03.140Z

This file lists every table in both Supabase projects with its current status, row count, code-reference count, one-line purpose, and any gotchas/notes. It is the fastest way to answer "does table X exist, what does it do, is it live, does anything use it?"

Column meanings:
- **Rows** — approximate row count from `pg_class.reltuples` (refreshed each regenerate).
- **Code refs** — count of `.from("table")` / `.table("table")` references in `frontend/src`, `backend/src`, and `alleato-ai`. Does NOT include migration files or one-off scripts. **0 code refs + 0 rows = strong drop candidate.** **0 code refs + N rows = stale data, no readers.**
- **Notes** — uses notesForAi when set, otherwise gotchas, from tables.yaml.

For richer information (full writer/reader file lists, columns, line numbers), open the admin UI at `/database-inventory` or read the source: `docs/architecture/tables.yaml`. For architectural narrative + dated corrections, read `docs/architecture/TABLE-INVENTORY.md`.

**How to update:** edit `docs/architecture/tables.yaml` and run `npm run db:inventory`. This file is regenerated from that source.

---

## MAIN — PM App database (`lgveqfnpkxvzbnnwuled`)

506 tables · 281 live · 153 dormant · 58 live-empty · 8 dead · 2 active · 2 orphan-mirror · 1 legacy · 1 blocked

| Table | Domain | Status | Rows | Code refs | Purpose | Notes |
|---|---|---|---:|---:|---|---|
| `admin_feedback_assistant_threads` | admin | live | 0 | 0 | Links an admin feedback item to an assistant session/thread that works it, tracking status, runtime, relay comments, and last message/error. |  |
| `admin_view_backups` | admin | dormant | 2 | 0 | Dormant admin view backup snapshots. |  |
| `app_crawl_sessions` | admin | live | 7 | 0 | App crawl sessions for admin auditing. |  |
| `app_error_events` | admin | live | 7.7k | 3 | Application error event tracking. |  |
| `app_error_groups` | admin | live | 1.9k | 6 | Error group aggregation. |  |
| `app_page_access_policies` | admin | active | 21 | 2 | Admin-managed route access inventory. Records explicit per-page access levels (route, access_level, permission_module) so page visibility decisions are reviewa… |  |
| `app_page_tag_assignments` | admin | live | 114 | 4 | Join table mapping a route from the app route inventory to a tag in app_page_tags. |  |
| `app_page_tags` | admin | live | 2 | 5 | Admin-managed catalog of page tags applied from the site map. Reusable across pages; drives curated tagged-page views. |  |
| `app_pages` | admin | live | 1 | 0 | App page registry. |  |
| `app_parity_checks` | admin | dormant | 0 | 0 | Dormant parity check results. |  |
| `app_schedule_bulk_operations` | admin | dormant | 0 | 0 | Dormant app schedule bulk operation records. |  |
| `app_schedule_task_hierarchy` | admin | dormant | 0 | 0 | Dormant app schedule task hierarchy records. |  |
| `app_system_actions` | admin | live | 831 | 0 | App system action log. |  |
| `app_system_states` | admin | dormant | 0 | 0 | Dormant app system state snapshots. |  |
| `app_ui_components` | admin | dormant | 0 | 0 | Dormant UI component registry. |  |
| `app_ui_table_columns` | admin | dormant | 0 | 0 | Dormant UI table column definitions. |  |
| `app_ui_tables` | admin | live | 0 | 0 | App UI table registry for admin tooling. |  |
| `database_tables_catalog` | admin | live | 318 | 1 | Schema metadata catalog for admin tooling. Separate from db-inventory.generated.ts. |  |
| `dev_annotations` | admin | live | 498 | 14 | Dev/admin annotation overlay for the UI. |  |
| `dev_panel_comments` | admin | live | 4 | 2 | Dev panel inline comments. |  |
| `parts` | admin | dormant | 7 | 0 | Dormant parts catalog. Purpose unclear. |  |
| `procore_capture_sessions` | admin | live | 6 | 0 | Procore crawler capture sessions. |  |
| `procore_components` | admin | dormant | 864 | 0 | Dormant Procore component tracker. No code references. |  |
| `procore_feature_implementations` | admin | dormant | 0 | 0 | Dormant Procore feature implementation tracker. No code references. |  |
| `procore_features` | admin | live | 138 | 0 | Procore feature parity audit. |  |
| `procore_modules` | admin | live | 24 | 0 | Procore module groupings. |  |
| `procore_pages` | admin | live | 391 | 0 | Procore page registry for parity audit. |  |
| `procore_screenshots` | admin | live | 22 | 0 | Admin crawler screenshots from Procore. |  |
| `procore_tools` | admin | live | 35 | 11 | Admin Procore parity tracker. |  |
| `psr_comments` | admin | live | 1 | 4 | PSR (Project Status Report) comments. |  |
| `qa_page_audit` | admin | live | 148 | 0 | QA audit results for page parity. |  |
| `table_metadata` | admin | live | 19 | 1 | Table-level metadata for admin tooling. |  |
| `test_cases` | admin | live | 812 | 12 | Test plan case definitions. |  |
| `test_results` | admin | live | 307 | 11 | Test run results. |  |
| `test_runs` | admin | live | 51 | 12 | Test run sessions. |  |
| `test_screenshots` | admin | live | 40 | 3 | Test run screenshots. |  |
| `test_suites` | admin | live | 42 | 10 | Test suite groupings. |  |
| `tool_features` | admin | live | 40 | 1 | Feature flags or tool feature definitions. |  |
| `tool_form_fields` | admin | live | 31 | 1 | Form field definitions for tool configuration. |  |
| `agent_learning_usages` | ai | live | 0 | 0 | Session-level usage/outcome log for injected agent learnings. Proves whether a retrieved learning was used and whether later feedback marked that session posit… | Rows are written opportunistically when learnings are injected into assistant context. Treat it as effectiveness telemetry, not the source of the learning itse… |
| `agent_learnings` | ai | live | 106 | 11 | Durable AI failure-pattern and prevention-prompt memory. Read and upserted by agent-learning-service.ts from thumbs-down feedback, eval failures, and admin fee… | PM APP stores the structured learning record only. Embeddings for retrieval are synced separately into the RAG database and must not be written into this table. |
| `ai_agent_runs` | ai | live | 0 | 1 | Run history for configured AI agents. Used by admin AI agent drilldowns and operational review. |  |
| `ai_agents` | ai | live | 20 | 2 | AI agent registry rows for configured assistant agents, approvals, thresholds, and admin-visible agent metadata. |  |
| `ai_feedback_events` | ai | live-empty | 47 | 19 | AI feedback events. Writer wired in feedback-event-service.ts but never triggered. |  |
| `ai_learning_promotions` | ai | live-empty | 2 | 35 | AI learning promotion records. Writer wired but never triggered. |  |
| `ai_memories` | ai | live | 59.7k | 12 | Long-term AI assistant memory store. 27,990 rows. Written by ai-memory-service.ts and workspace artifact promotions. |  |
| `ai_operation_events` | ai | live | 65 | 2 | AI Ops event ledger for scheduled/manual AI workflow events, accepted/rejected event state, and run conversion. |  |
| `ai_retrieval_feedback` | ai | live | 2.1k | 4 | Thumb/score feedback on AI retrieval results. 1,948 rows. Written by feedback-event-service.ts. |  |
| `ai_retrieval_weights` | ai | dormant | 0 | 6 | Dormant AI retrieval weight tuning table. |  |
| `ai_review_feedback` | ai | dormant | 0 | 1 | Dormant AI review feedback. |  |
| `ai_skill_usage_events` | ai | live | 0 | 1 | Telemetry ledger for selected Skill Library context attached to assistant responses. |  |
| `ai_skills` | ai | live | 0 | 6 | Approved Skill Library definitions consumed by assistant surface-specific skill injection. |  |
| `ai_task_feedback` | ai | dormant | 21 | 11 | Dormant AI task feedback. |  |
| `ai_tool_write_audits` | ai | dormant | 188 | 1 | Dormant AI tool write audit log. |  |
| `ai_weekly_reflections` | ai | dormant | 0 | 0 | TODO: Document this table. Zero code references in this repo (no migration, reader, or writer found 2026-07-14) — likely created directly in the DB by an agent… |  |
| `ai_work_run_artifacts` | ai | live | 91 | 3 | Inspectable generated and delivered artifacts for AI workflow runs, including Executive Daily Brief packets, Teams/email payloads, source-health reports, deliv… |  |
| `ai_work_run_delivery_attempts` | ai | live | 36 | 4 | Per-channel delivery attempt ledger for AI workflow runs, with recipient, status, exact failure code/message, retryability, provider response, and artifact lin… |  |
| `ai_work_run_sources` | ai | live | 190 | 1 | Evidence/source rows linked to AI workflow runs. |  |
| `ai_work_run_steps` | ai | live | 349 | 1 | Step-level execution log for canonical AI workflow runs, including source fetch, tool call, synthesis, artifact persistence, delivery, and verification outcome… |  |
| `ai_work_runs` | ai | live | 78 | 9 | Canonical AI workflow run ledger for Executive Daily Brief and related AI Ops workflows. |  |
| `chat_history` | ai | live | 5.4k | 23 | AI assistant chat message persistence. 2,908 rows. The live chat store. |  |
| `conversations` | ai | live | 678 | 22 | AI assistant chat session metadata. 226 rows. Thread/session header for chat_history. |  |
| `durable_ai_turns` | ai | live | 7 | 0 | Exactly-once submission ledger and reconnect locator for the Vercel Workflow durable AI chat canary (/ai-workflow): one row per (user, session, client_message_… | Canary feature — created by migration 20260722175451_create_durable_ai_turns.sql on the codex/durable-ai-chat-canary branch, applied to prod DB but not yet in… |
| `memories` | ai | live | 150 | 4 | Historical per-session conversation summaries with 3072-dim embeddings. There is no active writer; current durable Assistant memory uses ai_memories. |  |
| `notes` | ai | dead | 0 | 1 | Dead schema. No code references. Drop candidate. |  |
| `app_roles` | auth | dormant | 0 | 0 | Dormant role definitions. |  |
| `billing_invitations` | auth | dormant | 0 | 0 | Dormant billing/invite infrastructure. |  |
| `organization_members` | auth | dormant | 0 | 0 | Multi-tenant infrastructure scaffolding. Not in use. |  |
| `organizations` | auth | dormant | 0 | 0 | Multi-tenant infrastructure scaffolding. Not in use. |  |
| `user_email_notifications` | auth | live-empty | 1 | 5 | Email notification preferences per user. UI present, no rows. |  |
| `user_profiles` | auth | live | 45 | 139 | Per-user app flags: is_admin, is_developer, is_leadership, role. Read by 123+ code paths for permission checks and embedded into JWT claims by custom_access_to… | Table is NOT empty (verified live 2026-07-23: 30+ rows with real is_admin values — the earlier 'appears empty' note was an RLS-masked read). is_leadership (add… |
| `user_schedule_notifications` | auth | live-empty | 0 | 2 | Schedule notification preferences per user. UI present, no rows. |  |
| `user_table_views` | auth | live | 0 | 7 | Per-user named presets for UnifiedTablePage — captures visible columns, column order, sort, and filters. Lets PMs/testers save 'Quick view', 'Full detail', etc. | scope_key is project-agnostic (e.g. 'meetings'), not 'meetings-25125'. A view created on project A's meetings page applies on project B's. is_default is enforc… |
| `users_auth` | auth | live | 44 | 39 | Bridge between Supabase auth user (UUID) and people.id. Critical for all permission checks. | CRITICAL BUG: Only 1 row despite ~7 writer paths. Most signups not producing the bridge row. Silent privilege degradation for all users without a row. |
| `change_event_candidates` | change_management | live | 7 | 6 | Candidate change-event records staged from AI/intelligence signals before promotion into formal change management. |  |
| `bot_debug_log` | communications | live | 725 | 1 | Observability log for Teams bot. 336 rows. Written by teams-chat.ts. Not read in app. |  |
| `bot_user_mappings` | communications | live | 5 | 16 | Maps (platform, platform_user_id) to supabase_user_id. Drives Teams and Telegram bot identity. 1 active row. |  |
| `email_attachments` | communications | live | 528 | 11 | In-app attachment store. 419 rows, 391 MB. Covers manual uploads and change-event/contract/commitment/prime-CO/submittal attachments. NOT the same as outlook_e… | Do not confuse with outlook_email_intake_attachments. This stores in-app uploads. |
| `email_events` | communications | dormant | 140 | 29 | Dormant email event log. |  |
| `email_filter_rules` | communications | live | 0 | 6 | User-trained junk-mail rules. Applied by the Outlook sync as Gate 1.5 between the hand-coded noise filter (_is_noise_email) and the heuristic classifier. Each… | Reads in backend/src/services/integrations/microsoft_graph/user_filter_rules.py. Writes from frontend/src/app/api/email-filter-rules/ (admin-only POST/PATCH/DE… |
| `email_messages` | communications | dead | 0 | 0 | Dead schema. No code references. Drop candidate. |  |
| `fireflies_ingestion_jobs` | communications | live | 36.3k | 17 | Pipeline ingest-job stage queue (MAIN side). ~27k rows. As of 2026-06-17 the pipeline DUAL-WRITES stage rows here AND into RAG.fireflies_ingestion_jobs via sup… | Both copies are now kept in sync. Key is COALESCE(document_metadata.fireflies_id, id) (on_conflict=fireflies_id), so generic uploads are keyed by metadata id a… |
| `meeting_preps` | communications | dormant | 0 | 11 | Dormant meeting preparation records. |  |
| `meeting_segments` | communications | live | 31.3k | 15 | Meeting transcript chunks and summary embeddings. 19,527 rows. Written by parser.py, embedder.py. Read by meeting pages and project intelligence. | RLS enabled 2026-07-23 (migration 20260723230000): a segment is readable iff its parent document_metadata row is readable (parent RLS — including the leadershi… |
| `outlook_email_assistant_reviews` | communications | live-empty | 17 | 11 | Human review ledger for Brandon Outlook assistant decisions, draft outcomes, and feedback signals. | Admin/service-role table. It records review outcomes only; raw email source remains outlook_email_intake and project-matched email remains project_emails. |
| `outlook_email_intake` | communications | live | 1.5k | 29 | Raw Outlook email sync. Every email from the Graph sync lands here first. Source for document_metadata (AI-relevant) and project_emails (project-matched). tria… |  |
| `outlook_email_intake_attachments` | communications | live | 1.2k | 11 | Attachments from synced Outlook emails. 627 rows, 355 MB. Written by outlook.py and attachment_promotion.py. |  |
| `outlook_email_skip_audit` | communications | dormant | 126 | 1 | Dormant audit log for skipped Outlook emails. |  |
| `outlook_inbox_rules` | communications | live | 0 | 5 | Gmail/Outlook-style inbox rules for the Outlook Draft Feedback surface. Each rule matches a sender / sender_domain / subject / body / any pattern (contains, eq… | Applied at READ time in frontend/src/app/api/emails/route.ts (the pure matcher is frontend/src/lib/email-assistant/inbox-rules.ts) — NOT in the backend sync. H… |
| `team_chat_channels` | communications | live | 5 | 5 | Channels for Team Chat — the app's OWN internal chat feature at /team-chat (Slack-style channels + DMs). 2 rows. Nothing to do with Microsoft Teams. |  |
| `team_chat_messages` | communications | live-empty | 11 | 12 | Messages for Team Chat — the app's OWN internal chat feature at /team-chat: channels, DMs, and a comments-inbox DM that surfaces app comments. UI is built (fro… | Nothing to do with Microsoft Teams — do not confuse the two. The company's Microsoft Teams history lives in document_metadata with category='teams_message' (~2… |
| `teams_conversation_refs` | communications | live | 2 | 5 | Per-user proactive Teams thread cache. Upserted on every inbound Teams message so the bot can reply in the same thread. |  |
| `teams_link_codes` | communications | live-empty | 7 | 4 | Short-lived link codes for Teams bot↔account linking. Empty = no in-progress flows. |  |
| `telegram_link_codes` | communications | live-empty | 1 | 4 | Short-lived link codes for Telegram bot↔account linking. Empty = no in-progress flows. |  |
| `company_qualification` | crm | live | 0 | 4 | Vetting evidence per company (W-9, insurance, license; one row max per company). Completing qualification flips companies.lifecycle_stage to active — the compa… | Qualification documents attach via the existing company_documents Pattern C junction, not columns here. |
| `crm_activities` | crm | live | 0 | 3 | Manually logged CRM touchpoints (calls, follow-ups, notes) per company/deal/person. | Automated communication history (emails/meetings/Teams) is NOT copied here — it already resolves to companies/people via document_metadata. Do not duplicate it. |
| `crm_deals` | crm | live | 0 | 6 | CRM opportunities. FK to shared identity tables (companies/people) — the CRM deliberately has NO parallel identity tables (decision 2026-07-23: conversion is a… | company_id is ON DELETE RESTRICT — resolve deals before purging a company. owner_id/primary_contact_id point at people, not app_users. |
| `crm_pipeline_stages` | crm | live | 7 | 1 | Ordered CRM deal pipeline stages (Lead → Won/Lost). Admin-managed lookup; terminal stages carry a won/lost outcome. Seeded 7 defaults 2026-07-23. |  |
| `design_violations` | design-system | live | 3 | 3 | Design-system violation tracker for this app's own UI -- route, element selector, violation type, fix status. NOT an FM Global/ASRS table despite the adjacent… |  |
| `companies` | directory | live | 593 | 102 | Master company directory — vendors, clients, subs, AND CRM prospects (2026-07-23). is_vendor flag drives Acumatica sync. FK target for vendor-related forms. li… | FK-validation gate: vendor dropdown sources from vendors view but FK targets companies table. ~50 read sites. CRM prospects share this table — filter lifecycle… |
| `company_context` | directory | live-empty | 0 | 5 | Admin singleton doc for company-level AI context. Not yet populated. |  |
| `people` | directory | live | 950 | 163 | Master person directory. UUID id. Bridged to auth via users_auth.auth_user_id. |  |
| `vendor_contacts` | directory | live-empty | 2 | 3 | UI tries to read vendor contacts. No writer found in codebase. |  |
| `change_order_documents` | documents | live | 0 | 0 | Pattern C junction: change orders ↔ document_metadata. TODO: expand metadata, identify writers/readers. |  |
| `commitment_change_order_documents` | documents | live | 0 | 1 | Pattern C junction: commitment change orders ↔ document_metadata. Replaces cco_attachments writers. |  |
| `company_documents` | documents | live | 0 | 3 | Pattern C junction: companies ↔ document_metadata. TODO: expand metadata, identify writers/readers. |  |
| `daily_log_photos` | documents | live | 0 | 2 | Photo metadata written by the Site Scribe daily-log flow. Stores uploaded image records plus pairing back to the generated daily log and note context. | This is not the old project photos feature. The active writer is /api/projects/[projectId]/daily-log/site-scribe, which replaces rows for a daily log on regene… |
| `daily_logs_project_photos_links` | documents | live-empty | 0 | 0 | Link table between daily logs and project photos. Feature shipped, never adopted. |  |
| `document_attribution_candidates` | documents | live | 11.6k | 13 | Low-confidence project attribution review queue. 13,233 rows. Written by compiler when project confidence < 0.70. No review UI yet. | Known gap: no review UI exists. Items accumulate without resolution. |
| `document_group_access` | documents | dormant | 0 | 0 | Dormant per-group document access control. |  |
| `document_insights` | documents | blocked | 0 | 0 | Dormant document insights table, but retained because the actionable_insights view depends on it. Do not drop until the view is retired or migrated. |  |
| `document_metadata` | documents | live | 42.3k | 200 | Primary document catalog. 36,511 rows. Dual-written with RAG.rag_document_metadata on every ingestion. Full business metadata including project_id, source_type… | Always written alongside rag_document_metadata via upsert_document_metadata() — never write to one without the other. document_type for onedrive/sharepoint/mic… |
| `document_page_intelligence` | documents | live | 1.2k | 10 | Per-page AI vision extraction for drawings and PDFs. Written by backend OCR/vision processing and read by drawing intelligence, submittal required-package dete… | Keyed by document_metadata_id + page_number. Stores AI summaries plus raw extraction; service role writes, authenticated users can read. Do not replace with do… |
| `document_rows` | documents | live | 13.1k | 5 | Structured document rows loaded by ETL outside the repo. 12,354 rows. Read by AI tools/structured-queries.ts. |  |
| `document_type_taxonomy` | documents | live | 42 | 4 | Lookup table for document_metadata.document_type values (Pattern C). TODO: expand metadata, identify writers/readers. |  |
| `document_user_access` | documents | dormant | 0 | 0 | Dormant per-user document access control. |  |
| `drawing_annotations` | documents | live | 20 | 6 | Per-drawing markup annotations for the drawings viewer. Supports both the retired image-overlay viewer (image-space geometry in `data`) and the canonical PDF.j… | Two geometry formats coexist — never interpret legacy image-coordinate `data` rows as PDF-page markup. See migration header comments. |
| `drawing_areas` | documents | live | 1 | 5 | Drawing area definitions. 1 row. Admin-only. |  |
| `drawing_change_history` | documents | live | 11 | 6 | Change history for drawing publish/obsolete actions. 11 rows. |  |
| `drawing_downloads` | documents | live | 1.0k | 4 | Download audit log for drawings. 1,400 rows. |  |
| `drawing_markup_pins` | documents | live | 17 | 4 | Markup pins on drawings. 11 rows. |  |
| `drawing_related_items` | documents | dormant | 0 | 9 | Dormant drawing related items. |  |
| `drawing_revisions` | documents | live | 246 | 16 | Drawing revision history. 44 rows. |  |
| `drawing_sets` | documents | live | 17 | 4 | Drawing set groupings. 14 rows. |  |
| `drawing_sketches` | documents | dormant | 1 | 10 | Dormant drawing sketches. |  |
| `drawings` | documents | live | 195 | 43 | Drawing records. 44 rows. Managed by DrawingService.ts and drawing API routes. Storage bucket: drawings. |  |
| `drawings_rfis_links` | documents | dormant | 0 | 0 | Dormant drawing to RFI links. |  |
| `files` | documents | live | 6 | 5 | Project-setup wizard file index. 2 rows. Parallel to legacy documents table. Storage buckets: drawings, specifications, schedules. |  |
| `owner_invoice_documents` | documents | live | 0 | 0 | Pattern C junction: owner invoices ↔ document_metadata. TODO: expand metadata, identify writers/readers. |  |
| `photo_albums` | documents | live-empty | 1 | 4 | Photo albums. Feature shipped, never adopted. |  |
| `photo_links` | documents | live-empty | 0 | 0 | Photo links. Feature shipped, never adopted. |  |
| `photos` | documents | live-empty | 0 | 0 | Photo feature. Routes wired, zero data. Feature shipped but never adopted. |  |
| `prime_contract_change_order_documents` | documents | live | 0 | 0 | Pattern C junction: prime contract change orders ↔ document_metadata. Replaces pcco_attachments writers. |  |
| `prime_contract_documents` | documents | live | 3 | 1 | Pattern C junction: prime contracts ↔ document_metadata. TODO: expand metadata, identify writers/readers. |  |
| `prime_contract_pco_documents` | documents | live | 0 | 0 | Pattern C junction: prime contract PCOs ↔ document_metadata. Replaces prime_contract_pco_attachments readers. |  |
| `project_documents_v2` | documents | live | 14 | 0 | Successor to project_documents (Pattern C migration). Project ↔ document_metadata. TODO: expand metadata, identify writers/readers. |  |
| `purchase_order_documents` | documents | live | 1 | 0 | Pattern C junction: purchase orders ↔ document_metadata. TODO: expand metadata, identify writers/readers. |  |
| `rfi_documents` | documents | live | 0 | 0 | Pattern C junction: RFIs ↔ document_metadata. TODO: expand metadata, identify writers/readers. |  |
| `sop_backlog` | documents | live | 1 | 3 | SAIS structured backlog for missing or lifecycle-managed accounting/finance SOP requirements. Placeholder records exist before a real SOP file is uploaded, the… | Do not create fake document_metadata rows for missing SOPs. Placeholder backlog rows are requirements, not uploaded files; AI retrieval must distinguish them f… |
| `spec_drawing_links` | documents | live-empty | 0 | 3 | Junction between specification sections and drawings. Used by document-intelligence tooling to answer which drawings cover a spec section and which submittal p… | Links specification_sections.id to drawings.id with link_method and confidence. Even when empty, the table is part of the finalized spec/drawing/submittal cove… |
| `specification_area_sections` | documents | dormant | 0 | 5 | Dormant specification area sections. |  |
| `specification_areas` | documents | dormant | 0 | 10 | Dormant specification areas. |  |
| `specification_divisions` | documents | dormant | 0 | 3 | Dormant specification divisions. |  |
| `specification_section_revisions` | documents | live | 0 | 9 | Specification section revisions. 1 row. |  |
| `specification_sections` | documents | dormant | 1 | 27 | Dormant specification sections. |  |
| `specification_subscribers` | documents | dormant | 0 | 5 | Dormant specification subscribers. |  |
| `subcontract_documents` | documents | live | 11 | 0 | Pattern C junction: subcontracts ↔ document_metadata. TODO: expand metadata, identify writers/readers. |  |
| `subcontractor_invoice_documents` | documents | live | 0 | 0 | Pattern C junction: subcontractor invoices ↔ document_metadata. Replaces subcontractor side of invoice_attachments. |  |
| `submittal_doc_links` | documents | live | 238 | 2 | Pattern C junction: submittals ↔ document_metadata. TODO: expand metadata, identify writers/readers. |  |
| `estimate_gc_templates` | estimating | live | 1 | 2 | GC template definitions for the estimating workflow. TODO: expand metadata, identify writers/readers. |  |
| `estimate_sublist_bid_items` | estimating | live | 1 | 7 | Line items in subcontractor bid lists during estimating. TODO: expand metadata, identify writers/readers. |  |
| `estimate_sublist_call_logs` | estimating | live | 3 | 2 | Call logs against estimate sublists. TODO: expand metadata, identify writers/readers. |  |
| `estimate_sublist_scope_items` | estimating | live | 34 | 7 | Scope items attached to estimate sublists. TODO: expand metadata, identify writers/readers. |  |
| `executive_artifact_versions` | executive | live | 34 | 3 | Immutable versioned executive artifacts generated from intelligence packets. | Append-only; only the service role may write artifact versions. |
| `executive_attention_evidence` | executive | live | 3 | 0 | Evidence records supporting an executive attention item. |  |
| `executive_attention_history` | executive | live | 7 | 0 | Append-only transition and resolution history for executive attention items. | Updates and deletes are blocked by a database trigger. |
| `executive_attention_items` | executive | live | 3 | 0 | Governed executive attention items that require ownership, transition, or resolution. |  |
| `executive_claim_conflicts` | executive | live | 1 | 0 | Governed conflicts detected between executive claims. |  |
| `executive_conflict_claims` | executive | live | 2 | 0 | Claims participating in a governed executive conflict. |  |
| `executive_conflict_resolution_history` | executive | live | 2 | 0 | Append-only governance history for executive claim-conflict resolution. |  |
| `executive_monthly_review_events` | executive | live | 10 | 1 | Append-only governance events for a monthly executive review. |  |
| `executive_monthly_reviews` | executive | live | 3 | 2 | Immutable monthly executive review records tied to an executive artifact version. | Only service-role issuance is allowed; records are immutable after creation. |
| `acumatica_accounts` | financial | live | 155 | 1 | Chart of accounts mirror from Acumatica. 154 rows. Frontend-only sync (mirror-sync.ts). No app reads. |  |
| `acumatica_ap_bill_lines` | financial | live | 4.5k | 2 | Line items for acumatica_ap_bills. 4,016 rows. Delete+reinsert per sync cycle. | Delete+reinsert on every sync. Do not reference rows by id across sync cycles. |
| `acumatica_ap_bills` | financial | live | 3.5k | 13 | Acumatica AP bills mirror. 6,399 rows. Source for direct_costs projection. Updated 2×/day by Render cron. |  |
| `acumatica_ar_invoice_lines` | financial | live | 2.7k | 3 | Line items for acumatica_ar_invoices. 1,922 rows. |  |
| `acumatica_ar_invoices` | financial | live | 491 | 15 | Acumatica AR invoices mirror. 464 rows. Read by accounting invoices, dashboard, WIP, global invoices API. |  |
| `acumatica_change_orders` | financial | live | 2.3k | 4 | Acumatica change orders mirror. 4,069 rows. Projects into both prime_contract_change_orders and contract_change_orders via status mapping. |  |
| `acumatica_checks` | financial | live | 2.9k | 8 | Acumatica checks mirror. 2,775 rows. Projects into commitment_payments. Also flips paid flag on subcontractor_invoices when matching check found. |  |
| `acumatica_customers` | financial | live | 62 | 1 | Acumatica customers mirror. 58 rows. Frontend-only sync. Used to backfill customer_name on acumatica_ar_invoices. |  |
| `acumatica_outbound_audit_logs` | financial | live-empty | 0 | 2 | Audit log for outbound Acumatica exports. Writer exists but never triggered in production. |  |
| `acumatica_payment_applications` | financial | live | 1.7k | 8 | Join table for payment applications. 183 rows. | CRITICAL: No writer found in current code. Schema defined in migration 20260413000001. Rows from historical/manual load. If invoice-paid logic depends on this… |
| `acumatica_payments` | financial | live | 415 | 9 | Acumatica payments mirror. 368 rows. Read by accounting/payments and accounting/invoices paid logic. |  |
| `acumatica_project_budgets` | financial | live | 6.3k | 3 | Acumatica project budgets mirror. 6,172 rows. Read by accounting/wip route only. |  |
| `acumatica_project_tasks` | financial | live | 108 | 1 | Acumatica project tasks mirror. 99 rows. Frontend-only sync. Used for accounting cross-references. |  |
| `acumatica_projects` | financial | live | 87 | 6 | Acumatica projects mirror. 87 rows. Also upserts matching rows in the projects table on sync. |  |
| `acumatica_purchase_orders` | financial | live | 110 | 2 | Acumatica purchase orders mirror. 204 rows. Projects into purchase_orders. |  |
| `acumatica_subcontracts` | financial | live | 394 | 3 | Acumatica subcontracts mirror. 718 rows. Projects into subcontracts and subcontract_sov_items. |  |
| `acumatica_sync_runs` | financial | live-empty | 1.8k | 2 | Audit log of Acumatica sync runs. Writer exists at acumatica_sync.py:408 but no rows recorded. | CRITICAL: Empty despite writer. Likely exception path or ACUMATICA_FINANCIAL_SYNC_ENABLED env flag is off. Investigate _record_sync_run. |
| `acumatica_sync_state` | financial | live | 32 | 2 | Cursor state for Acumatica sync. 25 rows. Read before each sync to determine where to resume. |  |
| `billing_periods` | financial | dormant | 14 | 6 | Dormant billing periods. |  |
| `budget_changes` | financial | dead | 1 | 3 | Older budget change mechanism predating budget_modifications. 1 row. Effectively dead. |  |
| `budget_forecast_line_items` | financial | dormant | 0 | 4 | Dormant budget forecasting. No active writers. |  |
| `budget_line_forecasts` | financial | dormant | 0 | 2 | Dormant budget line forecasts. |  |
| `budget_line_history` | financial | live | 2.0k | 2 | Immutable audit history for budget_lines. 1,696 rows. Written by Postgres trigger only — never by app code. |  |
| `budget_line_item_history` | financial | dormant | 0 | 0 | Dormant. Likely superseded by budget_line_history (trigger-driven). |  |
| `budget_lines` | financial | live | 724 | 53 | Per-project budget line items. Core operational budget table. 564 rows. Every budget change is mirrored to budget_line_history via Postgres trigger. | budget_code_id FK→budget_lines but dropdown sources from project_cost_codes (FORM-FK-VALIDATION-GATE). All history via trigger not app code. |
| `budget_mod_lines` | financial | live | 119 | 6 | Line-level deltas for budget modifications. 32 rows. The live table (not budget_modification_lines which is empty). | Name collision: budget_modification_lines (with full 'ation') is the empty dead twin. budget_mod_lines is live. |
| `budget_modification_lines` | financial | dead | 0 | 2 | Dead twin of budget_mod_lines. Empty. Drop candidate. |  |
| `budget_modifications` | financial | live | 41 | 10 | Budget revision documents. 22 rows. Formal modification records with associated line deltas in budget_mod_lines. |  |
| `budget_snapshots` | financial | dormant | 3 | 3 | Dormant budget snapshot mechanism. |  |
| `budget_view_columns` | financial | live | 240 | 3 | Column definitions for budget view layouts. 312 rows. |  |
| `budget_views` | financial | live | 20 | 11 | UI column-layout state for budget views. 63 rows. |  |
| `change_event_approvals` | financial | dormant | 0 | 4 | Dormant change event approval workflow. |  |
| `change_event_documents` | financial | live | 6 | 0 | Pattern C junction between change events and document_metadata. Created during attachment backfill; 2 rows. |  |
| `change_event_history` | financial | live | 84 | 8 | Hand-rolled audit log for change events. 43 rows. Written at multiple change-event API call sites. |  |
| `change_event_line_items` | financial | live | 131 | 18 | Line-item detail per change event. 54 rows. |  |
| `change_event_pco_links` | financial | dormant | 42 | 19 | Dormant change event to PCO links. |  |
| `change_event_project_settings` | financial | live | 0 | 2 | Per-project change-event configuration flags (budget-code sync, ROM columns, line-item autopopulation, attachment copy, PCO/CO behavior). |  |
| `change_event_related_items` | financial | dormant | 4 | 4 | Dormant change event related items. |  |
| `change_event_rfq_responses` | financial | live | 1 | 8 | Vendor responses to change event RFQs. 1 row. |  |
| `change_event_rfqs` | financial | live | 3 | 16 | RFQs sent from a change event to vendors. 6 rows. |  |
| `change_events` | financial | live | 70 | 71 | Project-level change events. 77 rows. Neutral upstream object that can generate RFQs and link to PCOs/CCOs. |  |
| `change_events_documents_links` | financial | dormant | 0 | 0 | Dormant change event to document links. |  |
| `change_orders` | financial | dead | 5 | 3 | Generic change order table. Dead — all CO data lives in contract_change_orders and prime_contract_change_orders. |  |
| `change_workflow_comments` | financial | dormant | 0 | 0 | Dormant change workflow comments. |  |
| `change_workflow_notifications` | financial | dormant | 0 | 0 | Dormant change workflow notifications. |  |
| `commitment_audit_log` | financial | live | 2.0k | 1 | Postgres trigger-driven audit covering subcontracts and purchase_orders mutations. 852 rows. |  |
| `commitment_change_order_lines` | financial | dormant | 8 | 15 | Commitment change order line items. Not clearly mapped in inventory. |  |
| `commitment_payments` | financial | live | 4.1k | 7 | Mirror of relevant acumatica_checks. 2,775 rows. Only backend Python sync writes. |  |
| `commitment_pcos` | financial | dormant | 28 | 25 | Dormant commitment PCO tracking. |  |
| `commitment_related_items` | financial | dormant | 0 | 6 | Dormant commitment related items. |  |
| `contract_billing_periods` | financial | dormant | 0 | 0 | Dormant contract billing period definitions. |  |
| `contract_change_orders` | financial | live | 171 | 66 | Commitment-side change orders (subcontracts/POs). 140 rows. Despite the name, these are NOT prime CCOs. | Misleading name: stores commitment-side CCOs (subcontracts/POs), NOT prime contract change orders. Routes at api/commitments/[commitmentId]/change-orders/*. |
| `contract_documents` | financial | live | 0 | 0 | Contract-level documents. 1 row. Effectively unused. |  |
| `contract_line_items` | financial | live | 326 | 23 | Line items for contract_change_orders. 140 rows. |  |
| `contract_payments` | financial | dormant | 0 | 0 | Dormant contract payments. Not the same as prime_contract_payments. |  |
| `contract_snapshots` | financial | dormant | 0 | 0 | Dormant contract snapshots. |  |
| `contract_views` | financial | dormant | 0 | 0 | Dormant contract view state. |  |
| `cost_code_division_updates_audit` | financial | dormant | 11 | 0 | Dormant audit table for cost code division changes. |  |
| `cost_code_divisions` | financial | live | 40 | 3 | Cost code division groupings. 40 rows. |  |
| `cost_code_types` | financial | live | 9 | 20 | Cost code type classifications. 6 rows. |  |
| `cost_codes` | financial | live | 354 | 38 | Global master cost code table. 310 rows. Referenced by budget lines and project budget codes. |  |
| `cost_factors` | financial | dormant | 8 | 0 | Dormant cost factor table. |  |
| `cost_forecasts` | financial | dormant | 4 | 4 | Dormant cost forecast table. |  |
| `direct_cost_line_items` | financial | live | 9.6k | 11 | Line items for direct_costs. 8,436 rows. Delete+reinsert per sync cycle. | Delete+reinsert on every sync. Do not reference rows by id across sync cycles. |
| `direct_costs` | financial | live | 6.9k | 21 | Domain projection of acumatica_ap_bills. 6,555 rows. Project-attributed AP charges. acumatica_document_key is the upsert key — do not edit manually. |  |
| `erp_sync_log` | financial | live | 66 | 0 | Frontend-initiated Acumatica sync audit log. 51 rows. Written by the frontend cron route, not the backend Python sync. |  |
| `estimate_allowances` | financial | dormant | 0 | 3 | Dormant estimate allowances. |  |
| `estimate_alternates` | financial | dormant | 0 | 3 | Dormant estimate alternates. |  |
| `estimate_detail_items` | financial | live | 4.8k | 18 | Sub-line drill-downs for estimate line items. 615 rows. |  |
| `estimate_gc_items` | financial | live | 1.9k | 15 | General conditions items for estimates. 281 rows. |  |
| `estimate_line_items` | financial | live | 594 | 6 | Main cost-of-work breakdown for estimates. 495 rows. |  |
| `estimate_sublist_subs` | financial | dormant | 10 | 24 | Dormant estimate sublist substitutions. |  |
| `estimates` | financial | live | 32 | 17 | Estimate header records. 5 rows. Bridge from estimates to budget and contract line items via estimate-import. |  |
| `finance_spend_classification_rules` | financial | live | 11 | 3 | SAIS classification layer for accounting/finance overhead spend. Read with acumatica_ap_bills to produce trailing monthly spend by category/vendor while exclud… | Raw Acumatica AP bills remain sync-owned. Broad keyword rules such as PAYROLL, TAX, CPA, LEGAL, and COMPLIANCE are disabled by default until reviewed so spend… |
| `financial_contracts` | financial | dormant | 2 | 2 | Dormant financial contracts. |  |
| `forecasting` | financial | dormant | 0 | 0 | Dormant forecasting header table. |  |
| `forecasting_curves` | financial | dormant | 2 | 0 | Dormant forecasting curves. |  |
| `invoice_payments` | financial | dormant | 1 | 4 | Dormant invoice payments. |  |
| `invoicing_settings` | financial | dormant | 2 | 3 | Dormant invoicing settings. |  |
| `owner_invoice_line_items` | financial | live | 1.7k | 7 | Line items for owner_invoices. 604 rows. Average ~20 lines per invoice. |  |
| `owner_invoices` | financial | live | 103 | 39 | Invoices sent to the owner (pay applications outbound). 29 rows. Full state machine UI. Line-item granularity is in active use. |  |
| `payment_application_line_items` | financial | dormant | 5 | 10 | Dormant payment application line items. |  |
| `payment_transactions` | financial | dormant | 0 | 0 | Dormant payment transactions. |  |
| `pcco_line_items` | financial | dormant | 1 | 14 | Dormant PCCO line items. |  |
| `pco_change_events` | financial | dormant | 0 | 8 | Dormant PCO to change event links. |  |
| `pco_line_items` | financial | dormant | 51 | 11 | Dormant PCO line items. |  |
| `pco_versions` | financial | dormant | 0 | 3 | Dormant PCO version history. |  |
| `potential_change_order_line_items` | financial | active | 0 | 9 | Line items for numeric potential_change_orders (pco_id bigint). line_amount is generated (quantity * unit_cost). Written atomically via create_pco_with_lines /… |  |
| `potential_change_orders` | financial | dormant | 1 | 12 | Numeric (bigint) potential change orders that group change events (via pco_change_events) and convert to COs. Header written atomically by create_pco_with_line… |  |
| `prime_contract_change_order_related_items` | financial | live | 1 | 3 | Related item links for prime contract change orders. 1 row. |  |
| `prime_contract_change_orders` | financial | live | 158 | 78 | Owner-side change orders. 142 rows. Projected from acumatica_change_orders via status mapping. |  |
| `prime_contract_payment_applications` | financial | dormant | 3 | 19 | Dormant prime contract pay applications. |  |
| `prime_contract_payments` | financial | live | 52 | 10 | Owner payment records. 26 rows. Most owner payments tracked via acumatica_payments + invoice join instead. |  |
| `prime_contract_pcos` | financial | dormant | 8 | 18 | Dormant prime contract PCO table. |  |
| `prime_contract_project_settings` | financial | live | 2 | 6 | Per-project prime contract settings. 1 row. |  |
| `prime_contract_sovs` | financial | dormant | 5 | 1 | Dormant prime contract schedule of values. |  |
| `prime_contracts` | financial | live | 22 | 85 | Owner contracts. 21 rows. Routes live under /api/projects/[projectId]/contracts (NOT /prime-contracts). | API routes are at /contracts not /prime-contracts. Bootstrap creates one only when project has owner info. |
| `project_budget_codes` | financial | live | 6.1k | 51 | Per-project budget codes linking cost codes to budget lines. The dropdown source for budget code selection in forms. | FK-validation gate: budget_code_id FK→budget_lines but dropdown sources from project_cost_codes. Always resolve the ID mismatch in both read and write paths. |
| `project_budget_settings` | financial | live-empty | 1 | 3 | Per-project budget UI configuration. Schema exists, API routes exist, but no projects have settings saved yet. |  |
| `purchase_order_sov_items` | financial | live | 406 | 31 | SOV items for purchase orders. 198 rows. |  |
| `purchase_orders` | financial | live | 202 | 29 | Purchase order records. 129 rows. Domain projection from acumatica_purchase_orders. Audited via Postgres trigger to commitment_audit_log. |  |
| `qto_items` | financial | dormant | 0 | 0 | Dormant quantity takeoff items. |  |
| `qtos` | financial | dormant | 0 | 0 | Dormant quantity takeoff headers. |  |
| `reconciliation_findings` | financial | live-empty | 3.4k | 5 | Current and historical reconciliation findings between Job Planner project records and Acumatica mirrors. | fingerprint is the primary key. review_status tracks triage; is_active distinguishes current findings from resolved/stale findings. |
| `reconciliation_runs` | financial | live-empty | 11 | 5 | Job Planner to Acumatica reconciliation run ledger. Tracks scan status, finding counts, and dollars at risk. | RLS is enabled with service-role access only. Treat as operational triage state, not user-authored financial source data. |
| `schedule_of_values` | financial | dead | 0 | 3 | SOV table. Referenced as a reader in AI financial tools but NEVER written. Dead reads. |  |
| `sov_line_items` | financial | dead | 0 | 1 | SOV line items. Same as schedule_of_values — never written. |  |
| `sub_jobs` | financial | dormant | 0 | 0 | Dormant sub-job tracking. |  |
| `subcontract_sov_items` | financial | live | 1.7k | 31 | Schedule of Values line items for subcontracts. 964 rows. Source for subcontractor invoicing. | Name collision: subcontractor_sov_items (2 rows) is the near-dead sibling. This is the live table. |
| `subcontractor_invoice_audit_log` | financial | live | 2.5k | 9 | App-level audit log for subcontractor invoice state changes. 2,444 rows. Hand-rolled inserts scattered across invoice routes — no DB trigger backstop. | No DB trigger. Missing inserts in some code paths mean silent audit gaps. |
| `subcontractor_invoice_emails` | financial | dormant | 1 | 4 | Dormant subcontractor invoice email log. |  |
| `subcontractor_invoice_line_items` | financial | live | 3.3k | 7 | Line items for subcontractor_invoices. Only 12 rows — legacy invoices are header-only. |  |
| `subcontractor_invoice_related_items` | financial | dormant | 0 | 4 | Dormant subcontractor invoice related items. |  |
| `subcontractor_invoices` | financial | live | 2.6k | 44 | Subcontractor pay applications. 2,433 rows. Full state machine UI. Acumatica sync flips paid flag when matching check found. | Only 12 line items for 2,433 invoices — legacy invoices imported header-only. Line-item granularity not guaranteed for historical data. |
| `subcontractor_sov_items` | financial | dead | 4 | 9 | Near-dead sibling of subcontract_sov_items. 2 rows. Used for subcontractor-portal submissions. Verify usage before dropping. |  |
| `subcontractor_sov_submissions` | financial | dormant | 52 | 10 | Subcontractor SOV submission tracking. Dormant. |  |
| `subcontracts` | financial | live | 591 | 37 | Subcontract records. 398 rows. Written by Acumatica sync and UI routes. Audited via Postgres trigger to commitment_audit_log. |  |
| `vertical_markup` | financial | dormant | 22 | 12 | Dormant vertical markup table. |  |
| `asrs_blocks` | fm-asrs | live | 476 | 0 | ASRS blocks. Lightly referenced. |  |
| `asrs_configurations` | fm-asrs | dormant | 4 | 0 | Dormant ASRS configurations. No code references. |  |
| `asrs_decision_matrix` | fm-asrs | dormant | 0 | 0 | Dormant ASRS decision matrix. No code references. |  |
| `asrs_logic_cards` | fm-asrs | dormant | 0 | 0 | Dormant ASRS logic cards. No code references. |  |
| `asrs_protection_rules` | fm-asrs | dormant | 0 | 0 | Dormant ASRS protection rules. No code references. |  |
| `asrs_sections` | fm-asrs | live | 70 | 0 | ASRS section definitions. Lightly referenced. |  |
| `block_embeddings` | fm-asrs | dormant | 0 | 0 | Dormant block embeddings. No code references. |  |
| `design_recommendations` | fm-asrs | live | 0 | 0 | Persistence for FM Global sprinkler optimization recommendations. Columns mirror the RETURNS TABLE of generate_optimization_recommendations (recommendation_typ… |  |
| `fm_blocks` | fm-asrs | dormant | 629 | 0 | Dormant FM blocks. No code references. |  |
| `fm_cost_factors` | fm-asrs | dormant | 7 | 0 | Dormant FM cost factors. No code references. |  |
| `fm_documents` | fm-asrs | dormant | 1 | 0 | Dormant FM documents. No code references. |  |
| `fm_form_submissions` | fm-asrs | live | 19 | 5 | FM Global form submissions. Lightly referenced. |  |
| `fm_global_figures` | fm-asrs | live | 31 | 0 | FM Global figures/charts. Lightly referenced. |  |
| `fm_global_tables` | fm-asrs | live | 46 | 0 | FM Global lookup tables for sprinkler design. Lightly referenced. |  |
| `fm_optimization_rules` | fm-asrs | dormant | 3 | 0 | Dormant FM optimization rules. |  |
| `fm_optimization_suggestions` | fm-asrs | dormant | 0 | 0 | Dormant FM optimization suggestions. |  |
| `fm_sections` | fm-asrs | live | 66 | 0 | FM Global section definitions. Lightly referenced. |  |
| `fm_sprinkler_configs` | fm-asrs | live | 0 | 0 | FM Global sprinkler configurations. Lightly referenced. |  |
| `fm_table_vectors` | fm-asrs | dormant | 45 | 0 | Dormant FM table vectors. No code references. |  |
| `fm_text_chunks` | fm-asrs | dormant | 43 | 0 | Dormant FM text chunks. No code references. |  |
| `optimization_rules` | fm-asrs | dormant | 0 | 0 | Dormant generic optimization rules. |  |
| `__drizzle_migrations` | infrastructure | live | 1 | 0 | Drizzle ORM migration ledger. Tracks applied migrations. |  |
| `_prisma_migrations` | infrastructure | legacy | 1 | 0 | Prisma migration ledger from prior ORM. Kept for historical record; Supabase migrations are authoritative. |  |
| `db_audit_log` | infrastructure | live | 127.3k | 1 | Central audit log for all key business entity tables. Populated by fn_audit_log_generic trigger (trg_audit_log) on 37 tables covering projects, financial, cont… | Query this table to answer 'who changed X and when' questions. Filter by table_name + record_id for per-record history. changed_by is null for service-role/cro… |
| `briefing_runs` | intelligence | dormant | 0 | 0 | Dormant briefing run tracker. |  |
| `daily_corpus_syntheses` | intelligence | live | 2 | 0 | Canonical previous-day full-corpus synthesis artifact for executive briefing and downstream intelligence consumers. |  |
| `daily_recaps` | intelligence | live | 104 | 6 | Executive briefing packet store. Executive Daily Brief generation now writes canonical AI Ops run linkage through ai_work_run_id. | Legacy mechanism, but still actively generated for Executive Daily Brief. ai_work_run_id is the canonical generation run pointer; ai_work_runs.daily_recap_id r… |
| `executive_briefing_follow_ups` | intelligence | live | 1.0k | 8 | Follow-up actions from executive briefings. 108 rows. |  |
| `initiative_cards` | intelligence | live | 10 | 14 | Strategic initiative cards. 8 rows. Separate from insight_cards. |  |
| `insight_card_evidence` | intelligence | live | 21.4k | 18 | Links insight cards to their source documents. 6,185 rows. FK to document_metadata/source_documents. |  |
| `insight_card_targets` | intelligence | live | 12.9k | 3 | Links insight cards to intelligence targets with is_primary flag. 5,990 rows. |  |
| `insight_cards` | intelligence | live | 14.3k | 37 | Durable extracted signals from the intelligence pipeline. 5,991 rows. Created by promote_signal_candidate. Can be acknowledged, snoozed, or manually created. |  |
| `intelligence_packet_cards` | intelligence | live | 2.9k | 4 | Packet to insight_card join table with section and rank. 2,230 rows. Wiped and re-inserted on every packet refresh. | Wiped and re-inserted on every refresh. Do not reference rows by id across refresh cycles. |
| `intelligence_packets` | intelligence | live | 133 | 22 | Rendered briefing per intelligence target — latest snapshot. 83 rows. Upserted by compile_current_packet on every refresh. |  |
| `intelligence_reviews` | intelligence | live | 3 | 3 | Human review queue for packet/card feedback. Low row count today, but active insert/read paths make it the durable app-side review ledger. | Do not let this become a silent junk drawer for AI corrections. Keep ownership tight around packet/card feedback until a broader review workflow exists. |
| `intelligence_targets` | intelligence | live | 94 | 31 | Registry of compile-able intelligence targets (client_project, etc). 77 rows. status='active' gates packet refresh. Source for periodic refresh cron. |  |
| `project_attribution_rules` | intelligence | live | 484 | 8 | Heuristic rules for matching emails/documents to projects. 514 rows. Auto-learned from confirmed attributions. |  |
| `project_briefings` | intelligence | dormant | 0 | 0 | Dormant. NOT the same as intelligence_packets. No writer found. | Do not confuse with intelligence_packets, which is the live briefing store. |
| `initiatives` | marketing | dormant | 3 | 0 | Dormant marketing initiatives table. Not the same as initiative_cards. |  |
| `marketing_content_assets` | marketing | dormant | 6 | 3 | Dormant marketing content assets. |  |
| `marketing_content_calendar_items` | marketing | dormant | 6 | 3 | Dormant marketing content calendar. |  |
| `marketing_intelligence_items` | marketing | dormant | 13 | 2 | Dormant marketing intelligence items. CMO tool path wired but no production traffic. |  |
| `marketing_performance_snapshots` | marketing | dormant | 0 | 0 | Dormant marketing performance snapshots. |  |
| `workspace_artifacts` | marketing | dormant | 11 | 10 | Dormant workspace artifacts. Referenced in CMO path but no production traffic. |  |
| `company_meeting_types` | meetings | live | 0 | 4 | Company-managed catalog of normalized meeting types, ordering, and active state. |  |
| `meeting_attendees` | meetings | live | 4 | 11 | Per-meeting attendee roster (person_id -> people.id). attended is null until the meeting is in minutes mode and attendance is marked. |  |
| `meeting_categories` | meetings | live | 20 | 22 | Agenda section headers within a single meeting (ordered by position). Parent of meeting_items. |  |
| `meeting_documents` | meetings | live | 0 | 1 | Pattern C attachment junction: links document_metadata records (generic uploads, not the transcript) to a meeting. |  |
| `meeting_item_documents` | meetings | live | 0 | 1 | Pattern C attachment junction: links document_metadata records to an individual meeting_item. |  |
| `meeting_items` | meetings | live | 78 | 25 | Individual agenda/minutes line items within a meeting_category: title, assignee, due date, status. Can carry forward to a later meeting (carried_from_item_id)… | origin_meeting_id and carried_from_item_id both self/cross-reference meetings and meeting_items to support 'carry open item to next meeting' workflows — do not… |
| `meeting_series` | meetings | live | 557 | 7 | Groups recurring meetings under one project-scoped name (e.g. weekly OAC). unique(project_id, name). Backfilled from distinct document_metadata.title per proje… |  |
| `meeting_template_categories` | meetings | live | 0 | 5 | Agenda section headers within a meeting_template, mirrors meeting_categories. |  |
| `meeting_template_items` | meetings | live | 0 | 4 | Pre-defined agenda line items within a meeting_template_category, mirrors meeting_items minus assignment/status fields. |  |
| `meeting_templates` | meetings | live | 0 | 9 | Company-level (no project_id by design, matching Procore) reusable meeting template. Everyone authenticated can read; only admins write. |  |
| `meetings` | meetings | live | 1.2k | 31 | Procore-style meeting record: agenda/minutes mode, schedule fields, optional link to a Fireflies transcript via transcript_document_id. Backfilled one row per… | transcript_document_id references document_metadata.id (TEXT) — do not confuse with meeting_documents (generic attachment junction). number is scoped per serie… |
| `app_request_log` | ops | live | 97.3k | 1 | Operational API request log (request_id, method, path, status, latency). Written by frontend/src/lib/observability/request-log.ts via service.ts. Created by mi… |  |
| `db_incident_activity_samples` | ops | live | 4 | 0 | Operational diagnostic samples captured during database incident investigations. |  |
| `db_incident_outlook_write_block_log` | ops | live | 4.1k | 0 | Operational audit log for Outlook write blocks during database incident mitigation. |  |
| `db_incident_write_log` | ops | live | 11.2k | 0 | Operational audit log for write attempts captured during database incident mitigation. |  |
| `developer_commit_log` | ops | live | 1.1k | 2 | Commit ledger populated by the GitHub webhook (frontend/src/app/api/webhooks/github/route.ts) — repository, branch, sha per push. Created by migration 20260713… |  |
| `app_page_role_access_policies` | permissions | live | 0 | 3 | Admin-managed project-page role access policy. Presence of a route row makes the route policy explicit; child rows define allowed permission templates. |  |
| `app_page_role_access_policy_templates` | permissions | live | 0 | 4 | Allowed permission templates for an explicit page-role access policy. |  |
| `business_area_memberships` | permissions | live-empty | 0 | 1 | Person membership in a business area (business_area_id, person_id, role). Backs the current_is_business_area_member() RLS helper, mirroring current_is_project_… | Created directly in the DB for the Alleato Brain migration — no migration file in the repo yet. |
| `distribution_group_members` | permissions | live-empty | 0 | 2 | Members of distribution groups. No rows. |  |
| `distribution_groups` | permissions | live-empty | 0 | 0 | Distribution groups for notifications. Full CRUD service exists, no rows. |  |
| `group_members` | permissions | dormant | 0 | 0 | Dormant. No active code references. |  |
| `groups` | permissions | dormant | 0 | 0 | Dormant. No active code references. |  |
| `permission_audit_log` | permissions | live | 0 | 4 | Auto-written by lib/permissions.ts on permission changes. 7 rows. |  |
| `permission_templates` | permissions | live | 15 | 24 | 11 active permission templates. Managed via admin UI at /permissions/templates. |  |
| `person_company_templates` | permissions | live-empty | 47 | 8 | Permission templates per person-company pair. Feature defined, no data. |  |
| `user_directory_permissions` | permissions | live-empty | 0 | 3 | Admin-only per-user directory permission overrides. No rows set. |  |
| `user_granular_permission_overrides` | permissions | live | 2 | 10 | Fine-grained permission overrides. 4 active rows. |  |
| `user_module_permissions` | permissions | live-empty | 0 | 6 | Per-module tool access overrides per user. Same null-fallback bug as user_profiles. |  |
| `graph_subscriptions` | pipeline | live | 1 | 9 | Microsoft Graph webhook subscriptions. RLS-protected row count. Auto-renewed by subscriptions.py and webhooks.py. |  |
| `graph_sync_state` | pipeline | live | 322 | 3 | Per-resource delta sync tokens for Microsoft Graph. Per-user mailbox rows key resource_id by the bare mailbox email, not user:<email>. | Do not prefix mailbox resource_id values when reading graph_sync_state for stale-first sync selection; prefixed lookups match zero rows and collapse the limite… |
| `ingestion_dead_letter` | pipeline | orphan-mirror | 17 | 0 | STALE DLQ for failed ingestions. RAG.ingestion_dead_letter is canonical. |  |
| `ingestion_jobs` | pipeline | orphan-mirror | 449 | 2 | STALE copy of generic ingestion audit. 431 rows. RAG.ingestion_jobs is canonical. |  |
| `pipeline_config` | pipeline | dormant | 2 | 1 | Dormant pipeline configuration table. |  |
| `processing_queue` | pipeline | dormant | 3 | 0 | Dormant processing queue. |  |
| `source_sync_runs` | pipeline | live | 3.8k | 10 | Per-sync-run audit log. 3,478 MAIN rows (3,639 in RAG canonical). Written by graph sync, outlook.py, Acumatica sync. |  |
| `sources` | pipeline | live | 1.2k | 0 | Source registry — canonical list of ingestion sources. 1,218 rows. |  |
| `sync_status` | pipeline | dormant | 0 | 1 | Dormant sync status table. |  |
| `system_alerts` | pipeline | live | 654 | 10 | Health alert sink. 646 rows. Written by source_sync_health.py and source_rag_health.py crons. |  |
| `project_progress_report_versions` | progress_reports | live | 0 | 2 | Version history for project progress reports. |  |
| `daily_deep_read_fanout_runs` | project_intelligence | live | 0 | 0 | Run ledger for daily deep-read fanout processing and its bounded projection work. |  |
| `operational_loss_occurrences` | project_intelligence | live | 0 | 0 | Detected operational-loss occurrences emitted by daily deep-read projections. |  |
| `project_current_state` | project_intelligence | live | 37 | 5 | Current synthesized project state used by intelligence and executive surfaces. |  |
| `project_current_state_projection_envelopes` | project_intelligence | live | 64 | 0 | Idempotency envelopes and provenance for project current-state projections. |  |
| `project_intelligence_packet_items` | project_intelligence | live | 354 | 4 | Project-scoped actionable items materialized from intelligence packets and executive artifacts. |  |
| `project_intelligence_timeline_event_sources` | project_intelligence | live | 191 | 3 | Source/evidence links for project intelligence timeline events. |  |
| `project_intelligence_timeline_events` | project_intelligence | live | 191 | 7 | Project intelligence timeline events used for current-state and executive drilldown views. |  |
| `project_operating_snapshots` | project_intelligence | live | 328 | 3 | Point-in-time project operating snapshots for intelligence and reporting comparisons. |  |
| `project_report_suggestions` | project_intelligence | live | 166 | 5 | Suggested project report content/actions generated from project intelligence workflows. |  |
| `project_synopsis_history` | project_intelligence | live | 68 | 0 | Immutable history of governed project synopsis changes. |  |
| `business_area_migration_items` | projects | live | 0 | 0 | Per-record detail rows for a business-area migration run: the individual legacy project/record each run touched, its target business area, result, and rollback… | Created directly in the DB for the Alleato Brain migration — no migration file in the repo yet. Keep permanently. Child of business_area_migration_runs (run id… |
| `business_area_migration_runs` | projects | live | 0 | 0 | Run-level ledger for the Alleato Brain business-area migration: one row per migration execution (run id, timestamps, mode, summary counts, overall result). | Created directly in the DB for the Alleato Brain migration — no migration file in the repo yet. Keep permanently as the audit trail for each cutover run. Paren… |
| `business_area_project_map` | projects | live | 5 | 1 | Permanent migration ledger mapping legacy fake projects to business areas: old project, new branch, record type/ID, run ID, result, and rollback state per migr… | Created directly in the DB for the Alleato Brain migration — no migration file in the repo yet. Keep permanently: it is the audit trail and rollback map for th… |
| `business_areas` | projects | live | 5 | 1 | Business-area scopes (seeded: leads, ai, finance, internal-operations, marketing) that non-construction content migrates onto instead of fake projects. Columns… | Created directly in the DB for the 2026-07-23 Alleato Brain migration — no migration file in the repo yet. During the parallel run, migrated rows may carry bot… |
| `project_companies` | projects | live | 107 | 26 | Many-to-many join between projects and companies. company_type and status columns describe the relationship. |  |
| `project_contact_references` | projects | live | 5.1k | 1 | Pipeline-internal contact references built during Graph email sync for project assignment. No UI. Rows accumulate uncontrolled. | Written by project_assignment.py every 30-min Graph sync. No cleanup/expiry mechanism. Row count grows unbounded. |
| `project_directory_memberships` | projects | live | 306 | 63 | Core M2M join between projects and directory members. Race-protected via onConflict upserts. |  |
| `project_documents` | projects | live | 2.9k | 17 | Project-scoped uploaded + OneDrive/SharePoint-synced documents (full file inventory). Parallel to document_metadata (the AI-ready catalog). document_type is au… | document_type is set by trigger trg_project_documents_classify via classify_document_type(source_web_url) — folder-name based, number-agnostic. Do not set it m… |
| `project_emails` | projects | live | 562 | 32 | Project-matched inbound emails plus outbound emails sent via the app. Distinct from outlook_email_intake (raw sync) and document_metadata (AI relevance). |  |
| `project_notification_groups` | projects | dormant | 0 | 0 | Dormant. No writer or reader found in codebase. |  |
| `project_photos` | projects | live-empty | 907 | 14 | Photo feature — routes wired, never used in production. |  |
| `project_photos_punch_items_links` | projects | live-empty | 0 | 0 | Link table joining project photos to punch items. Feature not yet adopted. |  |
| `project_progress_report_photos` | projects | live | 11 | 7 | Photos attached to progress reports. |  |
| `project_progress_reports` | projects | live | 52 | 16 | Weekly progress reports. Triggered by api/cron/progress-reports and user-triggered PDF email flow. |  |
| `project_resources` | projects | dormant | 0 | 0 | Dormant. No writer or reader found in codebase. |  |
| `project_role_members` | projects | live-empty | 62 | 10 | Intended for role-member assignments. Assignment goes through project_directory_memberships instead. |  |
| `project_roles` | projects | live | 365 | 7 | Project-specific role definitions managed via CRUD routes. |  |
| `project_transmittals` | projects | live-empty | 0 | 6 | Transmittals feature — routes wired, no data yet. |  |
| `project_vendors` | projects | live | 4 | 4 | User-managed vendor associations per project. |  |
| `projects` | projects | live | 114 | 181 | Master project record. Integer id is the FK target for nearly every project-scoped table. Acumatica sync AND manual API can both write — race conditions possib… | id is INTEGER (not UUID). Several columns are mostly null: address, city, state, client, current_phase. project_manager FK→people.id (uuid). team_members is uu… |
| `projects_audit` | projects | live | 26.4k | 0 | Append-only audit trail of changes to the projects table. Written by a Postgres trigger only — no app code touches it directly. | Only useful via direct SQL. No UI. Cannot be queried via normal app routes. |
| `projects_sync` | projects | dormant | 1 | 0 | Leftover staging table from early project sync work. No code references found. |  |
| `user_project_preferences` | projects | live-empty | 0 | 3 | Per-user per-project UI preferences. Service exists, no rows saved. |  |
| `user_project_roles` | projects | dormant | 0 | 0 | Dormant. No writer or reader found in codebase. |  |
| `user_projects` | projects | dormant | 0 | 0 | Dormant. No writer or reader found in codebase. |  |
| `project_schedule_calendar_exceptions` | schedule | live | 0 | 3 | Project schedule non-working or exceptional working-day entries. |  |
| `project_schedule_calendars` | schedule | live | 1 | 4 | Canonical working-week calendar for a project schedule. |  |
| `schedule_alert_deliveries` | schedule | live | 0 | 0 | Idempotent delivery ledger for schedule-revision alerts and notification links. |  |
| `schedule_baseline_events` | schedule | live | 0 | 0 | Append-only lifecycle events for a named schedule baseline. |  |
| `schedule_baselines` | schedule | live | 0 | 2 | Named project schedule baselines that point to an immutable revision. |  |
| `schedule_leveling_events` | schedule | live-empty | 0 | 0 | Apply/undo audit ledger for leveling runs, linking source and target schedule revisions with before/after state hashes. Partial unique indexes enforce one appl… |  |
| `schedule_leveling_run_changes` | schedule | live-empty | 0 | 0 | Per-task proposed changes of a leveling run: before/after task states as JSONB with hashes, reasons array, and expected_task_version so apply can detect concur… |  |
| `schedule_leveling_runs` | schedule | live-empty | 0 | 0 | Resource-leveling preview runs: algorithm_version, configuration, diagnostics, the person_revision_vector the run was computed against, and an expiring source_… | Rows expire (expires_at) — a preview must be applied before its token lapses or the run is recomputed. |
| `schedule_person_allocation_revisions` | schedule | live-empty | 0 | 0 | Per-person monotonically increasing version counter used as an optimistic-concurrency fence for allocation/calendar data; leveling runs record the person_revis… |  |
| `schedule_person_work_calendars` | schedule | live-empty | 0 | 0 | Per-person (cross-project) work calendar: timezone plus a fixed 15-minute slot grid, versioned for optimistic concurrency. One calendar per person. | slot_minutes is CHECK-constrained to exactly 15 — the whole Phase 4C stack assumes a 15-minute grid. |
| `schedule_person_work_date_intervals` | schedule | live-empty | 0 | 0 | Date-specific working-interval overrides on a person's work calendar (local_date + 15-min-grid interval + capacity_percent + optional reason). Overlaps forbidd… |  |
| `schedule_person_work_weekly_intervals` | schedule | live-empty | 0 | 0 | Recurring weekly working intervals on a person's work calendar (weekday, start/end minute on the 15-min grid, capacity_percent). GiST exclusion constraint forb… |  |
| `schedule_resource_capacity_exceptions` | schedule | live-empty | 0 | 0 | Date-specific capacity exceptions (PTO, half-days) on a capacity profile: capacity_percent 0–100 per (resource, date) with an optional trimmed reason (≤240 cha… |  |
| `schedule_resource_capacity_profiles` | schedule | live-empty | 0 | 0 | Versioned per-resource capacity profile (one per project+resource). Parent of the weekday-override and dated-exception tables; version bumps drive optimistic c… |  |
| `schedule_resource_weekday_capacity_overrides` | schedule | live-empty | 0 | 0 | Recurring per-weekday capacity_percent (0–100) overrides on a capacity profile. PK (profile_id, weekday); triple composite FK keeps profile/project/resource co… |  |
| `schedule_resources` | schedule | live-empty | 0 | 2 | Project-scoped roster of schedulable people. One row per (project, person); composite FK to project_directory_memberships so only active directory members can… | Migration file lives on the schedule feature branches (feat/assistant-implementation-dispatch lineage), applied to prod DB 2026-07-22 but not yet in main's sup… |
| `schedule_revision_assignment_snapshots` | schedule | live-empty | 0 | 0 | Immutable per-revision snapshot of task↔resource assignments with allocation_percent, FK-pinned to the same revision's task and resource snapshots. |  |
| `schedule_revision_calendar_snapshots` | schedule | live | 2 | 1 | Working-calendar snapshot captured for an immutable schedule revision. |  |
| `schedule_revision_dependency_snapshots` | schedule | live | 0 | 2 | Dependency snapshots captured for an immutable schedule revision. |  |
| `schedule_revision_events` | schedule | live | 6 | 0 | Append-only lifecycle events for a schedule revision. |  |
| `schedule_revision_resource_capacity_snapshots` | schedule | live-empty | 0 | 0 | Per-revision snapshot of each resource's capacity configuration: profile_configured flag plus weekday_overrides and dated_exceptions captured as JSONB arrays. |  |
| `schedule_revision_resource_snapshots` | schedule | live-empty | 0 | 0 | Immutable per-revision snapshot of the project's resources at publish time (display name, email, job title, person/membership status). Append-only; app roles h… |  |
| `schedule_revision_segment_snapshots` | schedule | live-empty | 0 | 0 | Immutable per-revision snapshot of task segments (index, start/end, planned_minutes, lock_reason), FK-pinned to the same revision's task snapshots. |  |
| `schedule_revision_submittal_snapshots` | schedule | live | 0 | 2 | Submittal-to-task snapshots captured for an immutable schedule revision. |  |
| `schedule_revision_task_snapshots` | schedule | live | 244 | 5 | Task snapshots captured for an immutable schedule revision. |  |
| `schedule_revisions` | schedule | live | 2 | 7 | Immutable schedule revision snapshots for a project. |  |
| `schedule_task_assignments` | schedule | live-empty | 0 | 2 | Assigns a schedule_resource to a schedule_task with allocation_percent (1–100). Unique per (task, resource); tenant-safe composite FKs pin task and resource to… |  |
| `schedule_task_field_updates` | schedule | live | 2 | 0 | Auditable field-level changes to canonical schedule tasks. |  |
| `schedule_task_segments` | schedule | live-empty | 0 | 2 | Hourly task splits: ordered 15-min-grid time segments per schedule task with planned_minutes and optional lock_reason ('fixed' or 'progressed'). GiST exclusion… |  |
| `schedule_task_submittal_links` | schedule | live | 0 | 1 | Canonical links between schedule tasks and submittals. |  |
| `nods_page` | support | live-empty | 6 | 0 | Page registry for knowledge base navigation. Empty but code references exist. |  |
| `nods_page_section` | support | dormant | 0 | 0 | Dormant knowledge base page sections. No code references. |  |
| `support_article_chunks` | support | live | 5.2k | 3 | Knowledge base embeddings for semantic search. 5,219 rows. |  |
| `support_articles` | support | live | 2.3k | 8 | In-app knowledge base articles. 2,205 rows. |  |
| `training_doc_assets` | support | live | 124 | 10 | Screenshots/images/video attached to a training_doc (asset_type: screenshot\|image\|video), stored in the documents bucket. Rendered into published MDX. |  |
| `training_doc_relations` | support | live | 18 | 0 | Links between training_docs for the training map: relation_type related\|prerequisite\|next, source_doc_id→target_doc_id. Added 2026-06-30 to let docs link relat… |  |
| `training_doc_steps` | support | live | 118 | 4 | Ordered steps for a training_doc (instruction_markdown, expected_result, action_metadata, source_url). QA-ready; produced by the AI step generator and the Play… |  |
| `training_docs` | support | live | 91 | 8 | User-facing training/help articles (one row per task). Powers /training-docs admin UI, /knowledge/app/* viewer, and the publish pipeline to alleato-os-docs. to… |  |
| `admin_feedback_comments` | workflow | dormant | 29 | 6 | Dormant admin feedback comments. |  |
| `admin_feedback_items` | workflow | live | 323 | 43 | In-app user feedback inbox. 291 rows. Managed at /api/admin/feedback/*. |  |
| `collaboration_comments` | workflow | dormant | 16 | 3 | Dormant collaboration comments. |  |
| `collaboration_notifications` | workflow | dormant | 203 | 18 | Dormant collaboration notifications. |  |
| `daily_log_equipment` | workflow | dormant | 0 | 5 | Dormant daily log equipment entries. |  |
| `daily_log_manpower` | workflow | dormant | 1 | 7 | Dormant daily log manpower entries. |  |
| `daily_log_notes` | workflow | dormant | 0 | 7 | Dormant daily log notes. |  |
| `daily_log_weather` | workflow | live-empty | 2 | 4 | Per-observation weather entries (sky, temperature, precipitation, wind) attached to a daily_log. Added by the daily-log expansion migration (20260521020000). |  |
| `daily_logs` | workflow | live-empty | 1.1k | 16 | Daily log records for project field reporting. Feature shipped, no data. |  |
| `discrepancies` | workflow | dormant | 0 | 0 | Dormant discrepancy tracking. |  |
| `execution_handoffs` | workflow | dormant | 2 | 2 | Dormant execution handoff records. |  |
| `feature_request_events` | workflow | dormant | 17 | 2 | Dormant feature request events. |  |
| `feature_request_linear_events` | workflow | dormant | 4 | 2 | Dormant Linear integration events for feature requests. |  |
| `feature_request_linear_sub_issues` | workflow | dormant | 3 | 4 | Dormant Linear sub-issue tracking for feature requests. |  |
| `feature_requests` | workflow | live | 9 | 12 | Product feature requests from users. 1 row. |  |
| `idea_items` | workflow | live | 1 | 3 | Lightweight editable idea inbox for quick capture, AI routing review, and later promotion to Linear, Codex, sub-agent, project, or manual workflows. | Ideas are not automatically executed. Status and route_type preserve inspectable routing before automation acts. |
| `implementation_plans` | workflow | dormant | 4 | 3 | Dormant implementation plans. |  |
| `inspections` | workflow | dormant | 0 | 0 | Dormant inspections feature. |  |
| `issues` | workflow | dormant | 7 | 3 | Dormant issues tracking. |  |
| `manpower_assignments` | workflow | live-empty | 126 | 3 | Role/person assignment rows within an imported manpower plan project. | assignee_person_id is nullable; assignee_name preserves imported names before directory matching. |
| `manpower_plans` | workflow | live-empty | 1 | 5 | Imported manpower planning snapshot header. Marks the active manpower plan and tracks import metadata/warnings. | Only one active plan is allowed by partial unique index. Plan rows own manpower_projects and manpower_assignments via cascade delete. |
| `manpower_projects` | workflow | live-empty | 39 | 2 | Project rows within an imported manpower plan, optionally linked to the canonical projects table. | project_id is nullable; external_code/project_name may be the only source when the imported plan cannot be matched to a project. |
| `observation_comments` | workflow | dormant | 0 | 0 | Dormant observation comments. |  |
| `observation_history` | workflow | dormant | 0 | 0 | Dormant observation change history. |  |
| `observation_photos` | workflow | live-empty | 0 | 0 | Photos for observations. Feature shipped, never adopted. |  |
| `observation_types` | workflow | dormant | 12 | 0 | Dormant observation type definitions. |  |
| `observations` | workflow | dormant | 0 | 0 | Dormant observations (site conditions, safety, quality). Feature wired but no production traffic. |  |
| `observations_project_photos_links` | workflow | dormant | 0 | 0 | Dormant link table between observations and project photos. |  |
| `punch_item_comments` | workflow | dormant | 0 | 0 | Dormant punch item comments. |  |
| `punch_item_template_categories` | workflow | dormant | 0 | 0 | Dormant punch item template categories. |  |
| `punch_item_templates` | workflow | dormant | 0 | 0 | Dormant punch item templates. |  |
| `punch_items` | workflow | live | 255 | 9 | Punch list items. 6 rows. |  |
| `recurring_issue_evidence` | workflow | live | 9 | 0 | Evidence supporting recurring issues. 9 rows. |  |
| `recurring_issue_projects` | workflow | dormant | 0 | 0 | Dormant recurring issue to project links. |  |
| `recurring_issues` | workflow | live | 5 | 0 | Pattern-detection recurring issues. 5 rows. |  |
| `requests` | workflow | dormant | 50 | 0 | Dormant generic requests table. |  |
| `review_comments` | workflow | dormant | 0 | 0 | Dormant review comments. |  |
| `reviews` | workflow | dormant | 0 | 0 | Dormant review records. |  |
| `rfi_assignees` | workflow | dormant | 0 | 0 | Dormant RFI assignee table. |  |
| `rfi_response_tokens` | workflow | live | 0 | 2 | Opaque no-login authorization tokens for one recipient to respond to one RFI through web or email reply channels. | Token rows have no authenticated/anon policy. Access must stay service-role only after API-side validation. |
| `rfi_responses` | workflow | live | 0 | 7 | Structured RFI responses from app, public magic-link web replies, and email reply ingestion. | Public response routes and RFI reply cron use service-role access after token validation; authenticated users may read responses. Do not expose rfi_response_to… |
| `rfis` | workflow | live | 145 | 61 | Request for Information records. 11 rows. |  |
| `rfis_submittals_links` | workflow | dormant | 0 | 1 | Dormant RFI to submittal cross-links. |  |
| `roadmap_items` | workflow | live | 10 | 0 | Product roadmap items. 10 rows. Admin-managed at /api/admin/roadmap/*. |  |
| `schedule_deadlines` | workflow | dormant | 0 | 3 | Dormant schedule deadline tracking. |  |
| `schedule_dependencies` | workflow | dormant | 2 | 6 | Dormant schedule task dependencies. |  |
| `schedule_tasks` | workflow | live | 444 | 36 | Project schedule tasks. 241 rows. |  |
| `submittal_ai_review_checks` | workflow | live | 24 | 0 | Per-check AI submittal review findings with severity, confidence, source references, missing data, and human reviewer disposition. | Rows belong to submittal_ai_review_runs. Reviewer disposition controls are part of the active submittal AI review workflow. |
| `submittal_ai_review_runs` | workflow | live | 7 | 0 | AI submittal review run headers, including readiness, source coverage, model output, recommendation, status, and error details. | Runs are not the source documents; they are review artifacts tied to submittals and projects. Keep check rows in submittal_ai_review_checks. |
| `submittal_analytics_events` | workflow | live-empty | 0 | 0 | Analytics events for submittal workflows. Wired but no data. |  |
| `submittal_distribution_recipients` | workflow | dormant | 2 | 0 | Dormant submittal distribution recipient records. |  |
| `submittal_distributions` | workflow | dormant | 2 | 0 | Dormant submittal distribution records. |  |
| `submittal_history` | workflow | dormant | 12 | 3 | Dormant submittal change history. |  |
| `submittal_linked_drawings` | workflow | dormant | 3 | 7 | Dormant submittal to drawing links. |  |
| `submittal_notifications` | workflow | dormant | 0 | 0 | Dormant submittal notifications. |  |
| `submittal_packages` | workflow | dormant | 1 | 6 | Dormant submittal packages for grouped submissions. |  |
| `submittal_performance_metrics` | workflow | dormant | 0 | 0 | Dormant submittal performance metrics. |  |
| `submittal_project_settings` | workflow | live | 0 | 3 | Per-project Submittals tool configuration for default managers, distribution behavior, response days, workflow toggles, and email notification defaults. | One row per project. The settings API deliberately handles missing-table errors loudly with an actionable migration message. |
| `submittal_responses` | workflow | dormant | 8 | 7 | Dormant submittal response records. |  |
| `submittal_types` | workflow | dormant | 19 | 2 | Dormant submittal type definitions. |  |
| `submittal_workflow_steps` | workflow | dormant | 8 | 14 | Dormant submittal workflow step definitions. |  |
| `submittal_workflow_templates` | workflow | live | 1 | 4 | Submittal workflow templates. 1 row. |  |
| `submittals` | workflow | live | 531 | 61 | Submittal records. 1 row. |  |
| `task_comments` | workflow | live-empty | 0 | 4 | Comments on tasks. Routes exist, no data. |  |
| `tasks` | workflow | live | 1.0k | 86 | Project action items. 845 rows. Written by task_extraction.py (daily cron) and teams_compiler.py. |  |
| `timeline_events` | workflow | dormant | 1 | 11 | Dormant timeline events. |  |
| `timesheets` | workflow | dormant | 0 | 0 | Dormant timesheet records. |  |
| `todos` | workflow | live-empty | 1 | 2 | SOV-related todos. Referenced in subcontractor-sov-service.ts but empty. |  |
| `transmittal_items` | workflow | dormant | 0 | 0 | Dormant transmittal items. |  |


---

## RAG — AI Database (`fqcvmfqldlewvbsuxdvz`)

24 tables · 19 live · 4 live-empty · 1 dormant

| Table | Domain | Status | Rows | Code refs | Purpose | Notes |
|---|---|---|---:|---:|---|---|
| `fireflies_ingestion_jobs` | communications | live | 29.0k | 17 | Pipeline ingest-job stage queue (RAG side). ~27k rows. As of 2026-06-17 written in lockstep with MAIN.fireflies_ingestion_jobs via supabase_helpers.update_inge… | Both copies are now kept in sync — MAIN is no longer stale. Always update both DBs through update_ingestion_job_state(), never one side directly. |
| `outlook_email_intake` | communications | live | 5.2k | 29 | RAG database Outlook email intake rows for Microsoft Graph ingestion and vectorization workflows. |  |
| `outlook_email_intake_attachments` | communications | live | 2.5k | 11 | RAG database attachment metadata for Outlook email intake rows. |  |
| `outlook_email_skip_audit` | communications | live | 209 | 1 | Audit rows for Outlook email messages skipped by ingestion or filtering rules. |  |
| `document_attribution_candidates` | documents | live | 16.4k | 13 | Low-confidence project attribution review queue. 13,193 rows. Canonical copy. Written when project confidence < 0.70. |  |
| `document_chunk_retrieval_telemetry` | documents | live | 16 | 0 | Daily bucket recall telemetry for document_chunks retrieval. Stores recall_count and last_recalled_at by chunk/date/retrieval mode so hybrid RAG ranking can us… | RAG-owned only. Do not mirror to PM APP. Writes are only enabled when RAG_RETRIEVAL_TELEMETRY_ENABLED=true and should fail loudly if unavailable. |
| `document_chunks` | documents | live | 163.8k | 47 | THE unified vector store. 109,171 rows. halfvec 3072 embeddings. Written by pipeline/embedder.py. Read by rpc('search_document_chunks'). Canonical source for a… | MAIN.document_chunks (103K rows) is a stale orphan. Always use the RAG copy for reads and writes. |
| `rag_document_metadata` | documents | live | 62.1k | 34 | Embedding-side document catalog. 36,657 rows. app_document_id FK back to MAIN.document_metadata. Only backend pipeline reads this directly. |  |
| `packet_refresh_jobs` | intelligence | live | 1.7k | 0 | Packet refresh job queue and PM packet projection staging handoff. Canonical copy. MAIN copy is stale orphan. Projection payload/status columns were added 2026… |  |
| `source_intelligence_jobs` | intelligence | live | 18.6k | 0 | Compiler job queue. 11,071 rows. Canonical copy. Drained every 10 min by APScheduler in FastAPI. |  |
| `source_signal_candidates` | intelligence | live | 9.7k | 20 | Pre-promotion signal candidates from compiler. 7,527 rows. Canonical copy. |  |
| `graph_subscriptions` | pipeline | live | 11 | 9 | RAG database copy of Microsoft Graph webhook subscriptions used by Graph ingestion workers. |  |
| `graph_sync_state` | pipeline | live | 327 | 3 | RAG database Graph delta-token state for mailbox, Teams, and OneDrive sync workers. |  |
| `ingestion_dead_letter` | pipeline | live-empty | 17 | 0 | Dead letter queue for failed ingestion jobs. Wired but empty. |  |
| `ingestion_jobs` | pipeline | live | 821 | 2 | Generic ingestion audit log. 436 rows. Canonical copy. |  |
| `pipeline_model_usage` | pipeline | live-empty | 45.0k | 2 | Durable model usage and estimated-cost ledger for source processing, embeddings, daily briefs, Brandon email review, and project intelligence. Used by the dail… | High-volume telemetry belongs in RAG, not PM APP. Cost is an estimate based on configured pricing; provider billing remains authoritative. |
| `rag_pipeline_state` | pipeline | live-empty | 1 | 0 | RAG pipeline state metadata. Wired but empty. |  |
| `source_processing_jobs` | pipeline | live-empty | 8.8k | 8 | Durable per-source lifecycle ledger tracking source item hashes through assignment, RAG indexing, signal extraction, project intelligence, routing, and termina… | This is the cross-source status contract for Fireflies, Outlook, Teams, OneDrive, SharePoint, and future Acumatica-derived intelligence. Keep high-churn lifecy… |
| `source_sync_health_snapshots` | pipeline | live | 340 | 2 | Source sync health rollup snapshots. 330 rows. Canonical copy. |  |
| `source_sync_runs` | pipeline | live | 33.1k | 10 | Per-sync-run audit log. 3,639 rows. Canonical copy. |  |
| `system_alerts` | pipeline | live | 167 | 10 | RAG database pipeline health and system alert sink. |  |
| `project_daily_deltas` | project_intelligence | live | 195 | 0 | Daily project delta summaries produced by RAG/intelligence processing. |  |
| `source_syntheses` | project_intelligence | live | 3.3k | 1 | Synthesized source-level intelligence outputs generated from RAG-ingested communications and documents. |  |
| `user_phone_links` | unknown | dormant | 0 | 0 | TODO: Document this table. Discovered as pre-existing schema drift while regenerating TABLE-LIST.md; not created or touched by the meetings tool migration. |  |

