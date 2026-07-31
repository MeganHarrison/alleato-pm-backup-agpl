# AI/RAG Production Finalization Tasks

Date created: 2026-06-25
Owner: Alleato AI
Linear parent: AAI-636
Status: In Progress

This is the canonical step-by-step task list and progress ledger for the AI data pipeline and RAG production-finalization program. Update this file whenever a phase, implementation slice, provider change, data repair, deletion, or verification milestone completes.

Target architecture:

- [AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md](../../architecture/AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md)

Active handoff:

- [2026-06-25-S91-ai-rag-production-finalization-audit.md](../handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md)

Active project/task generation slice:

- [2026-06-25-project-assignment-task-generation-e2e.md](../tasks/2026-06-25-project-assignment-task-generation-e2e.md)

Active Acumatica readiness slice:

- [2026-06-26-acumatica-sync-production-readiness.md](../tasks/2026-06-26-acumatica-sync-production-readiness.md)

Completed AI assistant architecture slice:

- [2026-06-26-ai-assistant-final-architecture-verification.md](../tasks/2026-06-26-ai-assistant-final-architecture-verification.md)

Active event-driven intelligence/task write slice:

- [2026-06-26-event-driven-intelligence-task-write-guard.md](../tasks/2026-06-26-event-driven-intelligence-task-write-guard.md)

Completed cleanup/deletion proof slice:

- [2026-06-26-ai-rag-legacy-cleanup-proof.md](../tasks/2026-06-26-ai-rag-legacy-cleanup-proof.md)

Completed Outlook project Emails repair:

- [2026-06-26-outlook-project-emails-intake.md](../tasks/2026-06-26-outlook-project-emails-intake.md)

Completed env/database cleanup proof slice:

- [2026-06-26-ai-rag-env-db-cleanup-proof.md](../tasks/2026-06-26-ai-rag-env-db-cleanup-proof.md)

Completed final env/database cleanup proof slice:

- [2026-06-27-finalize-env-db-cleanup-proof.md](../tasks/2026-06-27-finalize-env-db-cleanup-proof.md)

Completed Outlook legacy mirroring removal slice:

- [2026-06-26-remove-outlook-legacy-mirroring-gates.md](../tasks/2026-06-26-remove-outlook-legacy-mirroring-gates.md)

Completed Outlook RAG-to-app bridge retirement slice:

- [2026-06-27-retire-outlook-rag-app-bridge.md](../tasks/2026-06-27-retire-outlook-rag-app-bridge.md)

Completed legacy Fireflies file-ingest removal slice:

- [2026-06-26-remove-legacy-fireflies-file-ingest.md](../tasks/2026-06-26-remove-legacy-fireflies-file-ingest.md)

Completed legacy daily digest removal slice:

- [2026-06-26-remove-legacy-daily-digest-backend-path.md](../tasks/2026-06-26-remove-legacy-daily-digest-backend-path.md)

Completed backend Pipeline A insight stub retirement slice:

- [2026-06-27-retire-pipeline-a-insight-stubs.md](../tasks/2026-06-27-retire-pipeline-a-insight-stubs.md)

Completed final verifier warning-gap closure slice:

- [2026-06-27-final-verifier-warning-gaps.md](../tasks/2026-06-27-final-verifier-warning-gaps.md)

Completed unreferenced RAG utility script deletion slice:

- [2026-06-27-delete-unreferenced-rag-utility-scripts.md](../tasks/2026-06-27-delete-unreferenced-rag-utility-scripts.md)

Completed SharePoint dry-run entrypoint removal slice:

- [2026-06-27-remove-sharepoint-dry-run-entrypoint.md](../tasks/2026-06-27-remove-sharepoint-dry-run-entrypoint.md)

Evidence directory:

- [2026-06-25-ai-rag-production-finalization](../evidence/2026-06-25-ai-rag-production-finalization)

Active latency hardening slice:

- [2026-06-27-meeting-source-lookup-latency.md](../tasks/2026-06-27-meeting-source-lookup-latency.md)

## Master Checklist

### Phase 1: Architecture And Source Of Truth

- [x] Create authoritative target architecture document before implementation or deletion.
- [x] Record that the architecture document is the target state, not proof of production parity.
- [x] Create parent Linear issue and follow-on sub-issues.
- [x] Create local task and handoff evidence ledgers.
- [x] Inventory active production source paths and provider schedules.
- [x] Keep this `TASKS.md` updated after each phase or major implementation task.

### Phase 2: Current-State Verification

- [x] Run AI chat architecture verifier.
- [x] Run Microsoft Graph embedding contract verifier.
- [x] Run source-specific RAG verifier.
- [x] Run source lifecycle verifier.
- [x] Run meeting vectorization verifier.
- [x] Run Acumatica sync health verifier.
- [x] Run Microsoft assistant health verifier.
- [x] Run Render AI provider health verifier.
- [x] Run final all-pipeline verification bundle after implementation cleanup.

### Phase 3: Fireflies Meeting Transcript Pipeline

- [x] Recover recent eligible meeting vectorization after PM projection guard failure.
- [x] Reprocess known recent missing Fireflies meetings through canonical `run_full_pipeline`.
- [x] Drain or classify Fireflies ingestion errors inside the two-month operational concern window; older errors are historical and not active blockers unless needed for a historical reconstruction request.
- [x] Fix provider JSON-mode/non-JSON extraction noise or classify it with a fail-loud follow-up.
- [x] Verify meeting transcripts sync automatically, save, embed, assign projects, create tasks where appropriate, and retrieve through RAG.

### Phase 4: Outlook Email Pipeline

- [x] Confirm Graph webhook plus scheduled reconciliation is the target trigger model.
- [x] Confirm Graph subscription reconciliation cron exists and is active in Render.
- [x] Repair stale cached Outlook intake for Microsoft Executive Assistant health.
- [x] Verify Outlook messages from the one-week operational concern window sync, embed, project-assign, generate tasks where applicable, and appear in semantic search.
- [x] Verify Outlook data is available to every relevant AI assistant through the finalized RAG/tool path.

### Phase 5: Microsoft Teams Pipeline

- [x] Confirm Teams channel and DM Render cron jobs are active.
- [x] Confirm source-specific Teams RAG checks live Microsoft Graph and indexed Supabase fallback with explicit observability.
- [x] Verify Teams message sync, embedding, project assignment, task generation, and RAG retrieval end to end for the one-week operational concern window.

### Phase 6: SharePoint Pipeline

- [x] Confirm Graph sync target includes SharePoint reconciliation.
- [x] Verify SharePoint documents sync/download/OCR/image extraction/embedding/project assignment end to end.
- [x] Verify SharePoint documents are retrievable through RAG with citations.

### Phase 7: Uploaded PDF And Document Processing

- [x] Verify upload event creates canonical `document_metadata` row.
- [x] Verify OCR runs automatically for eligible uploads.
- [x] Verify image extraction and AI vision/page intelligence for drawings, plans, specs, RFIs, submittals, invoices, contracts, and manuals.
- [x] Verify clean searchable text, extracted metadata, chunks, embeddings, and AI retrieval for tracked eligible uploads after deploy/backfill.

### Phase 8: Embeddings, Vector Search, And RAG

- [x] Recover source lifecycle/project assignment verifier gate.
- [x] Recover source-specific RAG observability verifier gate.
- [x] Validate finalized chunking strategy and duplicate chunk elimination.
- [x] Verify metadata filters, project filters, permissions, citations/reference links, and retrieval quality.
- [x] Remove or migrate legacy retrieval paths after import/route/provider/database-write proof.
- [x] Verify every AI assistant uses the finalized RAG pipeline.

### Phase 9: Project Assignment And Task Generation

- [x] Repair deterministic generated-task project links from linked source documents.
- [x] Preserve manual review routing for ambiguous project assignment.
- [x] Verify project assignment for emails, meetings, Teams, SharePoint, uploads, PDFs, drawings, submittals, RFIs, contracts.
- [x] Verify unmatched items route to manual review with confidence scoring.
- [x] Verify task generation from meetings, emails, Teams, document analysis, and AI extraction.
- [x] Verify duplicate task prevention and accurate owner/project association.

### Phase 10: Acumatica Sync

- [x] Align repo and verifier contract to the final twice-daily Acumatica schedule.
- [x] Update live Render Acumatica cron schedule to twice daily.
- [x] Resume live Render Acumatica cron.
- [x] Trigger an immediate Acumatica run.
- [x] Verify Acumatica sync entities are fresh and successful after the triggered or next scheduled run.
- [x] Verify retries, logging, statistics, and duplicate-import prevention.

### Phase 11: AI Assistants And Tool Architecture

- [x] Record AI SDK MCP architecture gap.
- [x] Resolve AAI-641 by fully implementing AI SDK MCP discovery, merge, trace, and close in the live `/api/ai-assistant/chat` stream path.
- [x] Verify every assistant uses finalized prompt, tool calling, and RAG architecture.
- [x] Verify assistants retrieve expected context end to end.

### Phase 12: Cleanup And Deletion

- [x] For each deletion candidate in AAI-703, prove inactive status through imports, route references, provider schedules, database writes, and verifier output.
- [x] Delete obsolete Vercel Graph/Graph-embed/Acumatica cron routes only after replacement ownership is proven.
- [x] Remove AAI-703-proven obsolete manual Graph/email eval implementations.
- [x] Repair AAI-705 database inventory drift so active AI/RAG/workflow tables are documented instead of false orphan candidates.
- [x] Remove Outlook legacy mirroring gates after raw intake and canonical RAG ownership are proven.
- [x] Retire the Outlook RAG-to-app incident bridge after canonical Outlook intake repair ownership is proven.
- [x] Continue removing archived, duplicate, experimental, deprecated, dead, or unused implementations as additional candidates are proven inactive.
- [x] Remove unused environment variables and orphaned database code where safe.
- [x] Confirm the codebase has one production implementation for every major workflow.

### Phase 13: Final Production Readiness

- [x] Every ingestion pipeline executes successfully.
- [x] Every supported document reaches the vector database.
- [x] Every supported document is retrievable through RAG.
- [x] OCR output is validated.
- [x] AI vision processing is validated.
- [x] Project assignment is validated.
- [x] Task generation is validated.
- [x] Error handling and retry logic are exercised.
- [x] Logging and monitoring are operational.
- [x] Final deliverables are produced.

## Progress Notes

### 2026-06-25: Target Architecture Created

- Created the authoritative target architecture document before implementation or deletion.
- Evidence: [AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md](../../architecture/AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md)
- Linear: AAI-637 under AAI-636.

### 2026-06-25: Initial Verifier Results Recorded

- Passed: chat architecture with warning, Graph embedding contract.
- Failed initially: source-specific RAG, source lifecycle, meeting vectorization.
- Evidence:
  - [chat-architecture.txt](../evidence/2026-06-25-ai-rag-production-finalization/chat-architecture.txt)
  - [graph-embedding.txt](../evidence/2026-06-25-ai-rag-production-finalization/graph-embedding.txt)
  - [source-specific.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-specific.txt)
  - [source-lifecycle.json](../evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle.json)
  - [meetings.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings.txt)

### 2026-06-25: AAI-640 Recent Fireflies Meeting Vectorization Recovered

- Fixed canonical pipeline handling so PM final projection guard failures stay loud but do not fail terminal ingestion/vectorization.
- Reprocessed recent eligible missing meetings through the canonical pipeline.
- Verification passed at that point with 75/75 recent eligible meetings embedded.
- Remaining: historical Fireflies error backlog and provider JSON-mode noise.
- Evidence:
  - [meetings-after-fireflies-final-fix.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings-after-fireflies-final-fix.txt)
  - [fireflies-reprocess-final-missing.json](../evidence/2026-06-25-ai-rag-production-finalization/fireflies-reprocess-final-missing.json)

### 2026-06-25: AAI-639 Source Lifecycle And Project Assignment Gate Recovered

- Updated source lifecycle verifier semantics to measure project disposition instead of only direct assignment.
- Repaired 162 deterministic task/source-document project links.
- Verification passed: source lifecycle and Fireflies task integrity.
- Evidence:
  - [source-lifecycle-after-project-assignment-fix.json](../evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-project-assignment-fix.json)
  - [fireflies-task-integrity-after-project-assignment-fix.json](../evidence/2026-06-25-ai-rag-production-finalization/fireflies-task-integrity-after-project-assignment-fix.json)
- Commit: `914b2b56dea0e6a8f07428a968eee5dde5de9207`

### 2026-06-25: AAI-638 Source-Specific RAG Observability Gate Recovered

- Added explicit Teams row-count and indexed fallback observability to the canonical source-specific Teams evidence block.
- Added focused Jest regression assertions.
- Verification passed: focused Jest test and `npm run rag:verify:source-specific`.
- Evidence:
  - [source-specific-rag-unit-after-observability-fix.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-specific-rag-unit-after-observability-fix.txt)
  - [source-specific-after-observability-fix.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-specific-after-observability-fix.txt)
- Commit: `8719f2a0d4ce6f7466c6b9d69c151f6990340e9b`

### 2026-06-25: AAI-653 Provider Schedule Reconciliation Started

- Created provider schedule reconciliation task and Linear issue AAI-653.
- Refreshed Render and Vercel provider state.
- Confirmed Render owns active Graph, Teams, Fireflies, and source health schedules.
- Confirmed disabled Vercel crons still exist for Graph sync, Graph embed, and Acumatica and remain deletion candidates after proof.
- Evidence:
  - [render-services-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/render-services-aai-653.json)
  - [vercel-crons-aai-653.txt](../evidence/2026-06-25-ai-rag-production-finalization/vercel-crons-aai-653.txt)

### 2026-06-25: Acumatica Schedule Restored To Target Cadence

- Updated Acumatica schedule contract to twice daily (`0 0,12 * * *`) in repo config and verifier.
- Patched live Render Acumatica cron schedule through the Render API.
- Resumed live Render Acumatica cron.
- Triggered immediate Acumatica run `crn-d827cfm7r5hc73e7lp20-1782421595`.
- The Render-triggered run did not update health within the short poll window, so the guarded canonical Acumatica entrypoint was run directly and health passed afterward.
- Evidence:
  - [acumatica-render-schedule-patch-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-render-schedule-patch-aai-653.json)
  - [acumatica-render-resume-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-render-resume-aai-653.json)
  - [acumatica-render-trigger-run-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-render-trigger-run-aai-653.json)
  - [acumatica-sync-health-after-trigger-aai-653.txt](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-after-trigger-aai-653.txt)

### 2026-06-26: AAI-697 Acumatica Production Readiness Verified

- Fixed the Acumatica health verifier's stale threshold so it matches the final twice-daily Render cron cadence plus scheduler/provider jitter.
- Verified live Render cron state: `alleato-acumatica-financial-sync` is active on `0 0,12 * * *`.
- Verified required Acumatica entities have current successful sync state and stats.
- Verified warning/fallback behavior is logged instead of silently failing:
  - unsupported customer fields are dropped with persisted warnings;
  - missing historical payment-application endpoint is logged with fallback projection from `acumatica_payments` where customer-to-project mapping is unique.
- Verified duplicate prevention:
  - upsert/conflict-key code guardrails exist;
  - live unique indexes exist for Acumatica raw/projection keys;
  - 18 duplicate probes returned zero duplicate groups.
- Verification passed:
  - `npm run verify:acumatica-sync-health`
  - delegated `TYPECHECK_NO_TIMEOUT=1 npm --prefix frontend run typecheck`
- Evidence:
  - [acumatica-sync-health-baseline-aai-697.txt](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-baseline-aai-697.txt)
  - [acumatica-sync-health-after-stale-threshold-fix-aai-697.txt](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-after-stale-threshold-fix-aai-697.txt)
  - [acumatica-run-state-duplicate-inventory-aai-697.json](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-run-state-duplicate-inventory-aai-697.json)
  - [acumatica-code-guardrail-inventory-aai-697.json](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-code-guardrail-inventory-aai-697.json)
  - [acumatica-logging-stats-duplicate-proof-aai-697.json](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-logging-stats-duplicate-proof-aai-697.json)
  - [frontend-typecheck-after-acumatica-verifier-threshold-aai-697.txt](../evidence/2026-06-25-ai-rag-production-finalization/frontend-typecheck-after-acumatica-verifier-threshold-aai-697.txt)

### 2026-06-26: AAI-699 Event-Driven Outlook/Teams Intelligence Guard Patched

- Replaced the obsolete whole-entrypoint PM high-churn block in the Outlook/Teams project synthesizer with a cumulative bounded PM final-projection budget.
- Event-driven and daily sweep summaries now report `pm_projection_rows` for task/card/packet projection evidence.
- Added missing Graph cron projection env in `render.yaml` so Graph-triggered intelligence can use the bounded projection path.
- Patched live Render `alleato-graph-sync` with the same projection env through the single-key env-var API and verified by read-back.
- Active-window redrives passed:
  - Outlook-only: `total_synced=2`, `embed.embedded=1`, no intelligence extraction errors.
  - Teams-only: `total_synced=1`, `teams_dm=1`, no intelligence extraction errors.
- Verification passed: compileall, `22 passed` across task-writer/DB-pressure/Graph-sync tests, `7 passed` Render blueprint tests, source lifecycle, project attribution, Microsoft assistant health, project-intelligence live paths, source-specific RAG, and chat architecture.
- Evidence:
  - [event-driven-intelligence-write-guard-aai-699.md](../evidence/2026-06-25-ai-rag-production-finalization/event-driven-intelligence-write-guard-aai-699.md)
- Task:
  - [2026-06-26-event-driven-intelligence-task-write-guard.md](../tasks/2026-06-26-event-driven-intelligence-task-write-guard.md)

### 2026-06-26: AAI-703 Legacy Cleanup Proof And First Deletions

- Completed the first deletion/import proof slice for remaining legacy AI/RAG implementations.
- Deleted two proven-inactive manual eval/bootstrap scripts:
  - `backend/src/scripts/eval_graph_sync.py`
  - `backend/src/scripts/eval_mine_emails.py`
- Removed stale README advertising and generated DB-inventory references for those scripts.
- Added a guardrail to `npm run rag:verify:chat-architecture` so those removed paths cannot silently reappear.
- Kept active or not-yet-replaced paths with explicit classification:
  - local admin RAG eval scripts remain `active-keep`;
  - contextual embedding backfill remained `migrate-first` until AAI-734 explicitly retired the pilot;
  - Outlook RAG-to-app metadata bridge remains `manual/dev-only`.
- Evidence:
  - [2026-06-26-ai-rag-legacy-cleanup-proof.md](../tasks/2026-06-26-ai-rag-legacy-cleanup-proof.md)
  - [legacy-cleanup-candidate-inventory-aai-703.md](../evidence/2026-06-25-ai-rag-production-finalization/legacy-cleanup-candidate-inventory-aai-703.md)
- Verification passed:
  - delegated `cd frontend && npm run typecheck:changed`;
  - `backend/.venv/bin/python -m compileall -q backend/src/scripts backend/src/services/pipeline/contextualize.py`;
  - `npm run rag:verify:chat-architecture`;
  - `npm run rag:verify:source-specific`;
  - `npm run rag:verify:retrieval-contract`;
  - `npm run rag:verify:client-boundary`;
  - `npm run rag:verify:backend-client-boundary`;
  - `npm run rag:verify:metadata-boundary`.
- Known unrelated blocker:
  - `npm run db:inventory` could not fully regenerate because `docs/architecture/tables.yaml` is missing live MAIN tables: `document_page_intelligence`, `idea_items`, `rfi_response_tokens`, `rfi_responses`, `spec_drawing_links`, `submittal_ai_review_checks`, `submittal_ai_review_runs`, and `submittal_project_settings`.

### 2026-06-26: AAI-705 Env/Database Cleanup Proof And Inventory Drift Repaired

- Proved the eight DB inventory drift tables from AAI-703 are active, not orphaned:
  - `document_page_intelligence`
  - `spec_drawing_links`
  - `rfi_responses`
  - `rfi_response_tokens`
  - `submittal_project_settings`
  - `submittal_ai_review_runs`
  - `submittal_ai_review_checks`
  - `idea_items`
- Documented those tables in `docs/architecture/tables.yaml` and regenerated:
  - `frontend/src/components/dev-tools/db-inventory.generated.ts`
  - `frontend/src/components/dev-tools/db-inventory.generated.json`
  - `docs/architecture/TABLE-LIST.md`
- `npm run db:inventory` now passes schema drift and generated a 458-table inventory.
- `npm run db:inventory -- --check-only` passes.
- First env cleanup candidates were classified:
  - `LEGACY_DAILY_DIGEST_ENABLED` moved to AAI-708 and is being removed with the legacy backend daily digest route/job path.
  - `ENABLE_LEGACY_FIREFLIES_FILE_INGEST` moved to AAI-706 and is being removed with the legacy file-ingest route.
  - `GRAPH_API_INGESTION_ENABLED` is an active provider/web-service pressure guard.
  - `OUTLOOK_SYNC_LEGACY_ATTACHMENTS`, `OUTLOOK_SYNC_LEGACY_LINKS`, and `OUTLOOK_SYNC_LEGACY_PROJECT_EMAILS` moved to AAI-709 and were removed after Outlook raw intake/RAG ownership proof.
- Evidence:
  - [2026-06-26-ai-rag-env-db-cleanup-proof.md](../tasks/2026-06-26-ai-rag-env-db-cleanup-proof.md)
  - [env-db-cleanup-candidate-inventory-aai-705.md](../evidence/2026-06-25-ai-rag-production-finalization/env-db-cleanup-candidate-inventory-aai-705.md)

### 2026-06-26: AAI-706 Legacy Fireflies File-Ingest Removal Complete

- Removed the disabled legacy `POST /api/ingest/fireflies` route,
  `IngestRequest` model, `ENABLE_LEGACY_FIREFLIES_FILE_INGEST` escape hatch,
  and unused `FirefliesIngestionPipeline.ingest_file(...)` method.
- Updated backend tests to assert the legacy file route is 404 and the canonical
  `/api/ingest/fireflies/recent` route invokes
  `sync_recent_transcripts(...)`.
- Removed stale legacy route/env references from current API docs, migrated API
  route docs, and public OpenAPI JSON/YAML.
- Proof shows the active production Fireflies path is
  `POST /api/ingest/fireflies/recent` plus Render cron
  `alleato-fireflies-sync`, both using
  `FirefliesIngestionPipeline.sync_recent_transcripts(...)`.
- Verification passed:
  - delegated `cd frontend && npm run typecheck:changed`;
  - backend compileall for changed backend files;
  - `backend/.venv/bin/python -m pytest backend/tests/test_api_routes.py backend/tests/test_ingestion.py -q`;
  - OpenAPI JSON parse check;
  - live reference scan excluding task evidence;
  - `npm run rag:verify:meetings`;
  - `npm run rag:verify:chat-architecture`.
- Evidence:
  - [2026-06-26-remove-legacy-fireflies-file-ingest.md](../tasks/2026-06-26-remove-legacy-fireflies-file-ingest.md)
  - [legacy-fireflies-file-ingest-removal-aai-706.md](../evidence/2026-06-25-ai-rag-production-finalization/legacy-fireflies-file-ingest-removal-aai-706.md)

### 2026-06-26: AAI-708 Legacy Daily Digest Backend Removal Complete

- Removed the disabled backend legacy daily digest generation route
  `POST /api/digests/daily/generate`, `LEGACY_DAILY_DIGEST_ENABLED` runtime
  gate, `backend/src/services/daily_digest.py`, disabled standalone
  `backend/scripts/generate_daily_recap.py`, and the APScheduler
  `daily_digest` registration/job/wrapper/email helper.
- Proof shows the canonical executive daily brief owner is the frontend
  AI Ops runner `frontend/scripts/run-executive-daily-brief.ts` plus the
  executive daily brief workflow/ledger, not the backend legacy daily digest.
- Retained `GET /api/digests/daily/{date}` as read-only historical
  `daily_recaps` access.
- Verification passed:
  - delegated `cd frontend && npm run typecheck:changed`;
  - backend compileall for changed backend files;
  - `backend/.venv/bin/python -m pytest backend/tests/test_scheduler_graph_jobs.py backend/tests/test_api_routes.py -q`;
  - live reference scan for deleted env/route/service/script;
  - `npm run rag:verify:metadata-boundary`;
  - `npm run rag:verify:executive-daily-brief-gateway`;
  - `npm run rag:verify:chat-architecture`.
- Evidence:
  - [2026-06-26-remove-legacy-daily-digest-backend-path.md](../tasks/2026-06-26-remove-legacy-daily-digest-backend-path.md)
  - [legacy-daily-digest-removal-aai-708.md](../evidence/2026-06-25-ai-rag-production-finalization/legacy-daily-digest-removal-aai-708.md)

### 2026-06-26: AAI-698 AI Assistant Routing And RAG Architecture Verified

- Repaired live `/api/ai-assistant/chat` deterministic routing gaps that forced source-backed assistant workflows into slow model/tool loops or ambiguous follow-up handling.
- Added preview-only RFI routing for explicit RFI create/draft/log prompts; no RFI row is written until confirmed.
- Added direct semantic source lookup for Teams/source questions with persisted `intentPlanner`, `sourceLookupIntentRouter`, and `semanticSearch` traces.
- Added executive briefing metadata lookup for follow-ups like "When was this regenerated?" against `daily_recaps.recap_kind=executive_briefing`, without asking for a project.
- Added explicit personal-task source markers/citations for task table answers: `tasks.assignee_person_id / tasks.assignee_name / tasks.assignee_email`.
- Added a permission-scoped `projects.name` fallback resolver for packet-first project briefings when intelligence-target resolution misses named projects like Westfield.
- Added direct project briefing synthesis from loaded `getProjectBriefingSnapshot` plus `semanticSearch`, preventing the 120s Westfield model/tool-loop timeout and preserving `serverBusinessContextPreflight`, `getProjectBriefingSnapshot`, and `semanticSearch` traces.
- Verification passed:
  - `npm run rag:verify:assistant-routing` passed 6/6.
  - `npm run rag:verify:chat-architecture` passed.
  - `npm run rag:verify:assistant-operational-readiness` passed.
  - `npm run rag:verify:source-specific` passed.
  - `npm run verify:microsoft-assistant-health -- --json` passed.
  - `npm run rag:verify:source-lifecycle -- --days 7` passed.
  - `PROJECT_ATTRIBUTION_AUDIT_DAYS=7 npm run verify:project-attribution` passed.
  - Delegated `TYPECHECK_NO_TIMEOUT=1 npm --prefix frontend run typecheck` passed.
- Residual risk: the Outlook redrive completed source sync and embedding, but the intelligence extraction phase reported the existing high-churn AI/intelligence write guard for source-signal, insight-card, packet, and task writes. Track that as the next event-driven intelligence/task-write cleanup slice before final platform readiness.
- Evidence:
  - [assistant-routing-after-direct-project-planner-trace-aai-698.txt](../evidence/2026-06-25-ai-rag-production-finalization/assistant-routing-after-direct-project-planner-trace-aai-698.txt)

### 2026-06-27: AAI-749 Meeting Source Lookup Latency Patched

- Investigated the failing production `source-lookup-meetings` eval.
- Root cause: `sourceSpecificRagRetrieval` completed in `1463ms`, but the route
  then fell through into the broad agentic loop, including 30
  `searchMeetingsByTopic` completions over about `128.552s` plus off-path
  MCP/CHRO/memory/document tools.
- Patched the direct source-specific fast path so successful meeting
  source-specific retrieval returns directly for recent meetings and
  meetings-on-date requests, matching the existing direct Teams source-specific path.
- Added a planner regression for the exact failing Brandon/billing/recent
  meetings prompt.
- Tightened an unrelated app-help regex false positive that routed
  `What are Brandon's must-do items today?` to product help.
- Verification passed:
  - `npm run rag:verify:source-specific`
  - `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/retrieval/__tests__/planner.test.ts src/lib/ai/__tests__/intent-router.test.ts --runInBand`
  - delegated `cd frontend && npm run typecheck:changed -- src/app/api/ai-assistant/chat/handler-v2.ts src/lib/ai/retrieval/__tests__/planner.test.ts src/lib/ai/intent-router.ts src/lib/ai/__tests__/intent-router.test.ts ../scripts/verify/verify_ai_source_specific_rag_contract.mjs`
- Follow-up production verification passed after deployment
  `dpl_GeJhJvxRNw9ncjTr1uN8J97bTRNF` reached `Ready` and was aliased to
  `projects.alleatogroup.com`:
  - `AI_EVAL_BASE_URL=https://projects.alleatogroup.com AI_EVAL_CASE_TIMEOUT_MS=180000 AI_EVAL_JUDGE_ENABLED=false npm run rag:verify:eval-suite:case -- source-lookup-meetings`
  - Result: PASS, `5141ms`, 1/1, 0 failures, 0 warnings.
  - Artifact: retired local eval artifact; the result above is preserved as historical evidence.
- Evidence:
  - [meeting-source-lookup-latency-aai-749.md](../evidence/2026-06-25-ai-rag-production-finalization/meeting-source-lookup-latency-aai-749.md)
  - [2026-06-27-meeting-source-lookup-latency.md](../tasks/2026-06-27-meeting-source-lookup-latency.md)
  - [chat-architecture-final-aai-698.txt](../evidence/2026-06-25-ai-rag-production-finalization/chat-architecture-final-aai-698.txt)
  - [assistant-operational-readiness-final-aai-698.txt](../evidence/2026-06-25-ai-rag-production-finalization/assistant-operational-readiness-final-aai-698.txt)
  - [source-specific-final-aai-698.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-specific-final-aai-698.txt)
  - [microsoft-assistant-health-final-aai-698.json](../evidence/2026-06-25-ai-rag-production-finalization/microsoft-assistant-health-final-aai-698.json)
  - [source-lifecycle-final-aai-698.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-final-aai-698.txt)
  - [project-attribution-final-aai-698.txt](../evidence/2026-06-25-ai-rag-production-finalization/project-attribution-final-aai-698.txt)
  - [frontend-typecheck-final-aai-698.txt](../evidence/2026-06-25-ai-rag-production-finalization/frontend-typecheck-final-aai-698.txt)

### 2026-06-25: Health And Assistant Crons Restored

- Resumed live Render crons:
  - `alleato-rag-health`
  - `alleato-ai-provider-health`
  - `alleato-microsoft-executive-assistant-check`
- Triggered immediate runs for all three restored crons.
- Render AI Gateway health passes.
- Resumed checks surfaced stale Outlook cache and two newly missing Fireflies embeddings; both were repaired in the follow-up provider reconciliation steps below.
- Evidence:
  - [render-health-cron-resume-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/render-health-cron-resume-aai-653.json)
  - [render-health-cron-trigger-runs-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/render-health-cron-trigger-runs-aai-653.json)
  - [render-ai-health-after-resume-aai-653.txt](../evidence/2026-06-25-ai-rag-production-finalization/render-ai-health-after-resume-aai-653.txt)
  - [microsoft-assistant-health-after-resume-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/microsoft-assistant-health-after-resume-aai-653.json)
  - [meetings-after-health-cron-resume-aai-653.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings-after-health-cron-resume-aai-653.txt)

### 2026-06-25: AAI-653 Provider Schedule Reconciliation Completed

- Re-drove two newly missing Fireflies meetings through canonical `run_full_pipeline`:
  - `01KVD86PYMPG69CHFZ9CPZRQRC` - Ulta Beauty Fresno Weekly Meeting
  - `01KVV1ZXBWSG077B23VWVA0F7V` - Quarterly Meeting Brainstorm
- Both completed successfully.
- `npm run rag:verify:meetings` passed after re-drive with 75/75 recent meetings covered.
- `npm run rag:verify:source-lifecycle` passed after re-drive.
- Evidence:
  - [fireflies-redrive-missing-after-health-resume-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/fireflies-redrive-missing-after-health-resume-aai-653.json)
  - [meetings-after-redrive-aai-653.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings-after-redrive-aai-653.txt)
  - [source-lifecycle-after-provider-reconcile-aai-653.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-provider-reconcile-aai-653.txt)

### 2026-06-25: AAI-641 AI SDK MCP Tool Architecture Recovered

- Wired the existing `createAiAssistantMcpTools()` helper into the live `/api/ai-assistant/chat` `handler-v2.ts` stream path.
- Discovered safe MCP tools are now merged into the Strategist `streamText` toolset.
- MCP discovery success/failure trace is persisted in chat metadata with the rest of the tool trace.
- MCP clients are closed on stream finish and stream error.
- Verification passed: focused MCP policy unit test and chat architecture verifier.
- Remaining warning: archived audit doc does not identify the current live AI SDK MCP implementation; this is documentation cleanup, not a live route failure.
- Evidence:
  - [chat-architecture-after-mcp-wire-aai-641.txt](../evidence/2026-06-25-ai-rag-production-finalization/chat-architecture-after-mcp-wire-aai-641.txt)
  - [mcp-tools-unit-after-chat-wire-aai-641.txt](../evidence/2026-06-25-ai-rag-production-finalization/mcp-tools-unit-after-chat-wire-aai-641.txt)

### 2026-06-25: AAI-682 Retrieval Boundary Verifiers Recovered

- Cleared the RAG/app database ownership boundary failures for the retrieval finalization slice.
- App metadata reads in parser/embedder and document-intelligence fallbacks no longer pull heavy `document_metadata.content/raw_text` in AI/RAG paths.
- Admin AI work-runs now reads RAG-owned `source_sync_runs` through `createRagServiceClient()`.
- Outlook digest and Microsoft Executive Assistant triage now use Outlook intake AI DB resolver helpers for `outlook_email_intake` tables.
- Verification passed:
  - `npm run rag:verify:metadata-boundary`
  - `npm run rag:verify:client-boundary`
  - `npm run rag:verify:backend-client-boundary`
  - delegated sub-agent typecheck: `npm --prefix frontend run typecheck`
  - focused frontend lint for touched TypeScript files
  - Python compile for touched backend files
- Evidence:
  - [metadata-boundary-after-boundary-fix-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/metadata-boundary-after-boundary-fix-aai-682.txt)
  - [client-boundary-after-boundary-fix-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/client-boundary-after-boundary-fix-aai-682.txt)
  - [backend-client-boundary-after-boundary-fix-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/backend-client-boundary-after-boundary-fix-aai-682.txt)
  - [frontend-typecheck-after-boundary-fix-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/frontend-typecheck-after-boundary-fix-aai-682.txt)
  - [focused-compile-lint-after-boundary-fix-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/focused-compile-lint-after-boundary-fix-aai-682.txt)
- Remaining AAI-682 closure gates: live permission behavior, citation/reference-link proof, and deletion/migration proof for any legacy retrieval candidates.

### 2026-06-26: AAI-690 Document Assignment And Task Evidence Extended

- Verified live assignment/task state for SharePoint, OneDrive, uploaded documents, PDFs, drawings, submittals, contracts, manual-review candidates, and document-derived tasks.
- Applied 7 deterministic OneDrive/SharePoint project assignments from source-path project numbers.
- Left SharePoint AP checks in review instead of forcing assignment: 81 parsed check documents had 0 safe exact accounting/project matches.
- Fixed Fireflies legacy action-item task writes by recording an explicit prompt version required by the task-quality trigger.
- Verified active-window duplicate task prevention: 0 duplicate groups under the user freshness policy.
- Re-ran canonical source lifecycle verification after Fireflies redrive; it passes.
- Repaired stale legacy SharePoint lifecycle rows so unassigned SharePoint records route to project-assignment review instead of terminal complete.
- Repaired generated task scalar/array project mismatches; final active-window task coverage has 0 duplicate groups and 0 scalar/array mismatches.
- Evidence:
  - [document-source-assignment-task-inventory-after-source-path-repair-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/document-source-assignment-task-inventory-after-source-path-repair-aai-690.json)
  - [document-analysis-task-generation-inventory-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/document-analysis-task-generation-inventory-aai-690.json)
  - [task-generation-active-window-duplicates-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/task-generation-active-window-duplicates-aai-690.json)
  - [source-lifecycle-after-aai-690-fireflies-redrive.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-aai-690-fireflies-redrive.txt)
  - [sharepoint-legacy-lifecycle-review-repair-applied-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/sharepoint-legacy-lifecycle-review-repair-applied-aai-690.json)
  - [task-generation-final-coverage-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/task-generation-final-coverage-aai-690.json)

### 2026-06-25: AAI-682 Retrieval Contract Verifier Added

- Added `npm run rag:verify:retrieval-contract`.
- The verifier embeds a live query, runs `search_document_chunks`, and asserts:
  - project filtering holds for returned rows
  - source-type filtering holds
  - duplicate chunk ids are not returned in top results
  - returned documents have citation/reference metadata in `rag_document_metadata`
  - semantic/source-specific retrieval code keeps permission guard hooks for service-role access
- Verification passed against live RAG data for project `24109`, with 8 project-filtered rows, 5 source-filtered rows, and 5 metadata references found.
- Delegated typecheck passed after each tiny verifier edit.
- Evidence:
  - [retrieval-contract-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/retrieval-contract-aai-682.txt)
- Legacy retrieval inventory found no duplicate production implementation safe to delete in this slice. Active paths are recorded separately from manual/dev-only cleanup candidates.

### 2026-06-25: AAI-682 Legacy Retrieval Inventory Completed

- Classified live retrieval paths, active backend agent paths, active admin eval harness paths, and manual/dev-only cleanup candidates.
- No production retrieval code was deleted because import/route proof showed the old-looking paths are still active or locally reachable.
- Evidence:
  - [retrieval-legacy-candidate-inventory-aai-682.md](../evidence/2026-06-25-ai-rag-production-finalization/retrieval-legacy-candidate-inventory-aai-682.md)
- AAI-682 retrieval slice is now ready for final closeout verification/publish status, but broad AI/RAG production readiness still requires the remaining pipeline-finalization phases.

### 2026-06-25: AAI-682 Retrieval Slice Closed

- Final closeout verifier bundle passed:
  - `npm run rag:verify:chunk-integrity -- --days=2`
  - `npm run rag:verify:hybrid-ranking`
  - `npm run rag:verify:source-specific`
  - `npm run rag:verify:retrieval-contract`
  - `npm run rag:verify:response-contract`
  - `npm run rag:verify:assistant-operational-readiness`
  - `npm run rag:verify:metadata-boundary`
  - `npm run rag:verify:client-boundary`
  - `npm run rag:verify:backend-client-boundary`
- Evidence:
  - [chunk-integrity-final-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/chunk-integrity-final-aai-682.txt)
  - [hybrid-ranking-final-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/hybrid-ranking-final-aai-682.txt)
  - [source-specific-final-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-specific-final-aai-682.txt)
  - [retrieval-contract-final-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/retrieval-contract-final-aai-682.txt)
  - [response-contract-final-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/response-contract-final-aai-682.txt)
  - [assistant-operational-readiness-final-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/assistant-operational-readiness-final-aai-682.txt)
  - [metadata-boundary-final-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/metadata-boundary-final-aai-682.txt)
  - [client-boundary-final-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/client-boundary-final-aai-682.txt)
  - [backend-client-boundary-final-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/backend-client-boundary-final-aai-682.txt)
- AAI-682 is closed as a retrieval-slice deliverable. The overall production-finalization program remains open for the other pipeline and final all-system gates.

### 2026-06-25: AAI-690 Project Assignment And Task Generation Slice Started

- Created Linear issue AAI-690 for end-to-end project assignment and automatic task generation verification/repair.
- Created active task ledger before implementation changes.
- Embedded the operational freshness windows:
  - Fireflies backlog errors older than two months are historical unless needed for historical reconstruction.
  - Outlook and Teams backlog errors older than one week are historical unless needed for historical reconstruction.
- Embedded the typecheck delegation rule: every TS/JS implementation change must be followed by delegated sub-agent typecheck.
- Evidence:
  - [2026-06-25-project-assignment-task-generation-e2e.md](../tasks/2026-06-25-project-assignment-task-generation-e2e.md)

### 2026-06-25: AAI-690 Fireflies Task Link Repair Completed

- Inventoried active project-assignment and generated-task code paths.
- Baseline checks:
  - `npm run rag:verify:source-lifecycle -- --days 7` passed.
  - `PROJECT_ATTRIBUTION_AUDIT_DAYS=7 npm run verify:project-attribution` passed.
  - Fireflies task integrity initially failed over the two-month operational concern window because stale tasks had empty/mismatched task project arrays.
- Added scoped repair controls to `backfill_project_assignments_from_compiler_jobs.mjs`:
  - `--source-system fireflies`
  - `--tasks-only`
- Applied Fireflies task-only deterministic repair:
  - 76 Fireflies task links updated.
  - 0 document assignment rows updated.
- Added Python guardrail coverage proving new Fireflies task upserts persist task project arrays.
- Post-repair checks passed:
  - Fireflies task integrity over 60 days.
  - Fireflies task-only backfill postcheck reports 0 eligible stale links.
  - Source lifecycle still passes over the 7-day Outlook/Teams concern window.
- Follow-up duplicate/link check found no duplicate generated-task groups, but found 48 Fireflies task-level attribution rows where the scalar project was set and the project array was empty.
- Repaired task attribution scripts so the project array is updated alongside future scalar project assignment.
- Applied Fireflies-only task-attribution sync:
  - 5 Fireflies tasks assigned from deterministic task text.
  - 48 existing Fireflies task project arrays synced from scalar project values.
- Final Fireflies checks now show:
  - 0 duplicate generated-task groups.
  - 0 Fireflies scalar/array task project mismatches over 60 days.
  - Fireflies task integrity passed.
  - Source lifecycle still passed over 7 days.
- Delegated bounded typecheck was run after each JS edit and timed out or was externally terminated without TypeScript diagnostics; the delegated no-timeout retry passed.
- Evidence:
  - [project-assignment-task-generation-inventory-aai-690.md](../evidence/2026-06-25-ai-rag-production-finalization/project-assignment-task-generation-inventory-aai-690.md)
  - [fireflies-task-integrity-after-link-repair-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/fireflies-task-integrity-after-link-repair-aai-690.json)
  - [project-assignment-backfill-fireflies-tasks-only-applied-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/project-assignment-backfill-fireflies-tasks-only-applied-aai-690.json)
  - [fireflies-task-link-guardrail-tests-aai-690.txt](../evidence/2026-06-25-ai-rag-production-finalization/fireflies-task-link-guardrail-tests-aai-690.txt)
  - [task-project-rules-fireflies-sync-applied-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/task-project-rules-fireflies-sync-applied-aai-690.json)
  - [generated-task-duplicate-after-repair-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/generated-task-duplicate-after-repair-aai-690.json)

### 2026-06-25: AAI-690 Outlook And Teams Communication Task Generation Restored

- Live coverage found recent Outlook/Teams communications were synced but not being synthesized into tasks:
  - 454 Outlook email docs in the 7-day window, 369 project-assigned, 0 task rows before repair.
  - 341 Teams message docs in the 7-day window, 24 project-assigned, 0 task rows before repair.
  - 0 project synthesizer processing markers.
- Root causes:
  - Graph sync only invoked communication intelligence extraction when inline embedding was enabled; Teams-only scheduled phases intentionally run fetch-only.
  - Project synthesizer let signal-promotion failures abort a document before task writes.
  - Shared task writer populated scalar project ID but not the task project array when called with only scalar project ID.
  - A stale unit test referenced deleted email/Teams compiler modules instead of the production `project_synthesizer` path.
- Repairs:
  - Event-driven communication extraction now runs after any Outlook, Teams channel, or Teams DM sync that returns new items, regardless of inline embedding.
  - Signal-promotion failures are logged/recorded but no longer block task writes for the same communication.
  - Shared task writer now mirrors scalar project ID into the task project array.
  - Replaced dead compiler tests with active project synthesizer task-writer coverage.
  - Ran one bounded production Outlook redrive for project 67; it created 1 task with project, project array, owner, and no duplicate group.
  - Ran one bounded production Teams redrive for project 1011; it created 4 tasks with project, project arrays, owners, and no duplicate group.
- Remaining AAI-690 work:
  - Closed in the 2026-06-26 progress note. Continue with the next production-finalization phase.
- Evidence:
  - [project-synthesizer-status-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/project-synthesizer-status-aai-690.json)
  - [project-synthesizer-dry-run-project-67-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/project-synthesizer-dry-run-project-67-aai-690.json)
  - [project-synthesizer-applied-project-67-after-patch-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/project-synthesizer-applied-project-67-after-patch-aai-690.json)
  - [project-synthesizer-created-task-project-array-repair-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/project-synthesizer-created-task-project-array-repair-aai-690.json)
  - [task-generation-live-coverage-after-synthesis-fix-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/task-generation-live-coverage-after-synthesis-fix-aai-690.json)
  - [communications-task-generation-tests-aai-690.txt](../evidence/2026-06-25-ai-rag-production-finalization/communications-task-generation-tests-aai-690.txt)
  - [teams-synthesizer-dry-run-project-1011-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/teams-synthesizer-dry-run-project-1011-aai-690.json)
  - [teams-synthesizer-applied-project-1011-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/teams-synthesizer-applied-project-1011-aai-690.json)
  - [teams-task-generation-live-proof-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/teams-task-generation-live-proof-aai-690.json)
  - [task-generation-live-coverage-after-teams-proof-aai-690.json](../evidence/2026-06-25-ai-rag-production-finalization/task-generation-live-coverage-after-teams-proof-aai-690.json)

### 2026-06-25: Microsoft Executive Assistant Outlook Cache Recovered

- Ran a bounded canonical Outlook delta redrive for `bclymer@alleatogroup.com`.
- Result: 24 messages synced, 24 persisted, delta token saved.
- `npm run verify:microsoft-assistant-health -- --json` passed afterward.
- Evidence:
  - [outlook-bclymer-delta-redrive-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/outlook-bclymer-delta-redrive-aai-653.json)
  - [microsoft-assistant-health-after-outlook-redrive-aai-653.json](../evidence/2026-06-25-ai-rag-production-finalization/microsoft-assistant-health-after-outlook-redrive-aai-653.json)

### 2026-06-25: Acumatica Sync Health Recovered

- Ran the guarded Acumatica financial sync entrypoint directly after the Render-triggered run did not update health within the short poll window.
- Sync completed with no errors and known warnings about Acumatica payment-application endpoint exposure.

- `npm run verify:acumatica-sync-health` passed afterward.
- Evidence:
  - [acumatica-manual-sync-aai-653.txt](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-manual-sync-aai-653.txt)
  - [acumatica-sync-health-after-manual-sync-aai-653.txt](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-after-manual-sync-aai-653.txt)

### 2026-06-25: AAI-660 Disabled Vercel Cron Leftovers Deleted

- Proved `/api/cron/graph-sync`, `/api/cron/graph-embed`, and `/api/cron/acumatica-sync` were disabled Vercel cron leftovers with no source callers outside `frontend/vercel.json` and their own route files.
- Proved replacement ownership:
  - Render `alleato-graph-sync` owns Graph sync and embedding with `run_embedding=True`.
  - Render `alleato-acumatica-financial-sync` owns Acumatica on the twice-daily schedule.
- Deleted:
  - `frontend/src/app/api/cron/graph-sync/route.ts`
  - `frontend/src/app/api/cron/graph-embed/route.ts`
  - `frontend/src/app/api/cron/acumatica-sync/route.ts`
  - the three matching entries in `frontend/vercel.json`
- Kept admin/manual source-sync routes intact.
- Verification passed after deletion: no source references remain, `frontend/vercel.json` parses, `npm run check:routes`, `npm run rag:verify:graph-embedding`, `npm run verify:acumatica-sync-health`, `npm run rag:verify:source-lifecycle`, and `npm run rag:verify:meetings`.
- Evidence:
  - [vercel-crons-aai-660.txt](../evidence/2026-06-25-ai-rag-production-finalization/vercel-crons-aai-660.txt)
  - [vercel-cron-deletion-proof-aai-660.md](../evidence/2026-06-25-ai-rag-production-finalization/vercel-cron-deletion-proof-aai-660.md)
  - [vercel-cron-reference-check-after-delete-aai-660.txt](../evidence/2026-06-25-ai-rag-production-finalization/vercel-cron-reference-check-after-delete-aai-660.txt)
  - [route-check-after-vercel-cron-delete-aai-660.txt](../evidence/2026-06-25-ai-rag-production-finalization/route-check-after-vercel-cron-delete-aai-660.txt)
  - [graph-embedding-after-vercel-cron-delete-aai-660.txt](../evidence/2026-06-25-ai-rag-production-finalization/graph-embedding-after-vercel-cron-delete-aai-660.txt)
  - [acumatica-sync-health-after-vercel-cron-delete-aai-660.txt](../evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-after-vercel-cron-delete-aai-660.txt)
  - [source-lifecycle-after-vercel-cron-delete-aai-660.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-vercel-cron-delete-aai-660.txt)
  - [meetings-after-vercel-cron-delete-aai-660.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings-after-vercel-cron-delete-aai-660.txt)

### 2026-06-25: AAI-662 Chat Architecture Source Of Truth Recovered

- Documented the live AI SDK MCP implementation in the authoritative production architecture document.
- Updated `npm run rag:verify:chat-architecture` to check that architecture document instead of a missing archived audit doc.
- Verification now passes with no failures and no warnings.
- Evidence:
  - [chat-architecture-after-source-of-truth-aai-662.txt](../evidence/2026-06-25-ai-rag-production-finalization/chat-architecture-after-source-of-truth-aai-662.txt)

### 2026-06-25: AAI-663 Source Freshness Windows Applied

- Applied the operational backlog policy:
  - Fireflies backlog errors older than two months are historical, not active production-readiness blockers.
  - Outlook email and Teams message backlog errors older than one week are historical, not active production-readiness blockers unless needed for a historical reconstruction request.
- Updated the meeting vectorization verifier to report Fireflies backlog concern using a 60-day job creation window while preserving the 14-day recent meeting coverage gate.
- `npm run rag:verify:meetings` passed with 75/75 recent meetings embedded after applying the policy window.
- Evidence:
  - [meetings-after-freshness-window-aai-663.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings-after-freshness-window-aai-663.txt)
- Commit: `ffeeede2bf`

### 2026-06-25: AAI-665 Fireflies 60-Day Queue Drain Completed

- Grouped the initial 1,600 active-window shared queue errors and found the count was not Fireflies-specific:
  - Most rows belonged to Teams/email/knowledge rows in the shared `fireflies_ingestion_jobs` queue table.
  - Only 14 active-window rows were actual Fireflies meeting rows in error state.
- Repaired 14 Fireflies meeting error jobs that were already embedded and had searchable chunks by marking the stale queue state `done` in both app and RAG databases.
- Repaired 1 Fireflies meeting `raw_ingested` job that was already embedded with 27 searchable chunks by marking the stale queue state `done` in both app and RAG databases.
- Updated `npm run rag:verify:meetings` so Fireflies backlog warnings join `rag_document_metadata` and only count Fireflies/meeting records.
- Final Fireflies-scoped 60-day state:
  - `done`: 146
  - `embedded`: 3
  - `error`: 0
  - `raw_ingested`: 0
- `npm run rag:verify:meetings` passed with no warnings, 75/75 recent meetings covered, and both AI Gateway and direct OpenAI embedding probes healthy.
- Evidence:
  - [fireflies-60-day-error-groups-aai-665.json](../evidence/2026-06-25-ai-rag-production-finalization/fireflies-60-day-error-groups-aai-665.json)
  - [fireflies-embedded-error-state-repair-aai-665.json](../evidence/2026-06-25-ai-rag-production-finalization/fireflies-embedded-error-state-repair-aai-665.json)
  - [fireflies-raw-ingested-state-repair-aai-665.json](../evidence/2026-06-25-ai-rag-production-finalization/fireflies-raw-ingested-state-repair-aai-665.json)
  - [fireflies-60-day-error-groups-final-aai-665.json](../evidence/2026-06-25-ai-rag-production-finalization/fireflies-60-day-error-groups-final-aai-665.json)
  - [meetings-after-fireflies-60-day-final-drain-aai-665.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings-after-fireflies-60-day-final-drain-aai-665.txt)

### 2026-06-25: AAI-668 Outlook And Teams One-Week Queue Verified

- Grouped the shared queue inside the one-week Outlook/Teams operational concern window.
- Result: no active Outlook/Teams/Graph shared queue rows exist in the one-week window.
- `npm run rag:verify:source-specific` passed.
- `npm run rag:verify:source-lifecycle` passed.
- Lifecycle evidence shows current Outlook and Teams source health:
  - Outlook: 516 recent sources, 448 embedding-required, embedded ratio 1.0, lifecycle ratio 1.0, project disposition ratio 1.0.
  - Teams: 293 recent sources, 187 embedding-required, embedded ratio 1.0, lifecycle ratio 1.0, project disposition ratio 1.0.
- Recent Outlook/Teams lifecycle failures are terminal `skipped_low_content` rows, not retryable backlog.
- Evidence:
  - [graph-teams-outlook-one-week-queue-aai-668.json](../evidence/2026-06-25-ai-rag-production-finalization/graph-teams-outlook-one-week-queue-aai-668.json)
  - [source-specific-one-week-graph-aai-668.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-specific-one-week-graph-aai-668.txt)
  - [source-lifecycle-one-week-graph-aai-668.txt](../evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-one-week-graph-aai-668.txt)

### 2026-06-25: AAI-669 SharePoint/PDF OCR Vision Root Cause Fixed

- Verified recent SharePoint documents:
  - 191 recent SharePoint records.
  - 191 have locators.
  - 190 are embedded and 1 is intentionally excluded.
  - SharePoint source-specific retrieval returned the probe document with similarity 1 and citation metadata.
- Verified uploaded/manual/drawing/OneDrive/outlook-attachment PDF coverage and found active blockers:
  - Drawing uploads: 90 recent records, all with project/locator/OCR text, but 27 were `raw_ingested` and 2 were `ocr_failed` before recovery.
  - Manual uploads: 32 recent records, 22 still `uploaded`.
  - OneDrive: 45 recent records, 7 `ocr_failed`.
  - Outlook attachments: 159 recent records, 54 `metadata_only`.
- Bounded backend requeue accepted 10 drawing uploads and proved parser/vision progressed, but exposed a root-cause bug: app status could advance while RAG metadata was missing.
- Fixed `backend/src/services/pipeline/embedder.py` so document embedding:
  - reads app `content`/`raw_text` when no RAG metadata exists yet.
  - upserts `rag_document_metadata` instead of update-only metadata writes.
  - writes source/project/storage/text/status metadata needed for citations.
- Local patched pipeline proof succeeded for two drawing PDFs:
  - `[012] A410 - INTERIOR ELEVATIONS.pdf`: 38 embedded chunks, 18 document chunks, 1 vision chunk, RAG metadata content length 5173.
  - `[015] PD101 - FIRST FLOOR PLUMBING.pdf`: 12 embedded chunks, 5 document chunks, 1 vision chunk, RAG metadata content length 3498.
- Evidence:
  - [sharepoint-pdf-ocr-vision-inventory-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/sharepoint-pdf-ocr-vision-inventory-aai-669.json)
  - [sharepoint-pdf-family-coverage-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/sharepoint-pdf-family-coverage-aai-669.json)
  - [sharepoint-pdf-requeue-batch-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/sharepoint-pdf-requeue-batch-aai-669.json)
  - [sharepoint-pdf-requeue-poll-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/sharepoint-pdf-requeue-poll-aai-669.json)
  - [sharepoint-pdf-requeue-second-poll-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/sharepoint-pdf-requeue-second-poll-aai-669.json)
  - [sharepoint-pdf-local-pipeline-proof-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/sharepoint-pdf-local-pipeline-proof-aai-669.json)
  - [sharepoint-pdf-local-pipeline-postcheck-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/sharepoint-pdf-local-pipeline-postcheck-aai-669.json)

### 2026-06-25: AAI-669 SharePoint/PDF Backfill And Guardrail Checkpoint

- Deployed the embedder fix to live Render backend:
  - Service: `alleato-backend`
  - Deploy: `dep-d8uqhm3rjlhs73bkjld0`
  - Commit: `df7491e71627416a1d06a24a8a640adf4ede0c9f`
- Live backend batch 1 repaired 10/10 drawing uploads through `/api/pipeline/process`; all reached `complete`, embedded chunks, and vision chunks.
- Live backend batch 2 queued 20 additional rows; the poll showed 11/20 embedded, and pending trace isolated a citation-metadata orphan class.
- Added a shared RAG chunk-integrity guardrail for document-like chunks without `rag_document_metadata`.
- Repaired 34/34 recent orphan metadata rows with the canonical embedder.
- `node scripts/verify/verify_rag_chunk_integrity.mjs --days=2` now passes.
- Direct canonical batch 3 repaired 20/20 additional embedding gaps.
- Manual upload batch 4 processed 19/19 PDF uploads with no row failures.
- Current recent PDF/document inventory after batch 4:
  - 66 active gaps remain, down from 156 after the deploy inventory.
  - 12 embedding gaps remain: 5 `.txt` test uploads and 7 OneDrive `ocr_failed` rows.
  - 54 vision gaps remain: 29 OneDrive embedded drawings, 22 Outlook attachments, and 3 drawing uploads.
- Evidence:
  - [render-backend-deploy-live-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/render-backend-deploy-live-aai-669.json)
  - [pdf-backfill-live-batch-second-poll-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-backfill-live-batch-second-poll-aai-669.json)
  - [pdf-backfill-live-batch-2-second-poll-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-backfill-live-batch-2-second-poll-aai-669.json)
  - [pdf-backfill-live-batch-2-pending-trace-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-backfill-live-batch-2-pending-trace-aai-669.json)
  - [pdf-backfill-direct-canonical-batch-3-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-backfill-direct-canonical-batch-3-aai-669.json)
  - [pdf-backfill-orphan-metadata-repair-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-backfill-orphan-metadata-repair-aai-669.json)
  - [rag-chunk-integrity-after-orphan-repair-aai-669.txt](../evidence/2026-06-25-ai-rag-production-finalization/rag-chunk-integrity-after-orphan-repair-aai-669.txt)
  - [pdf-backfill-manual-upload-batch-4-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-backfill-manual-upload-batch-4-aai-669.json)
  - [pdf-backfill-candidates-after-manual-batch-4-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-backfill-candidates-after-manual-batch-4-aai-669.json)

### 2026-06-25: AAI-669 Graph Vision Path Recovered

- Fixed the production vision analyzer to fall back to Microsoft Graph source downloads for OneDrive/SharePoint rows that have `source_drive_id` and `source_item_id` but only store OCR text locally.
- Fixed Graph document embedding so it runs vision for PDF-like Graph rows when page intelligence is absent, then embeds `document_page_intelligence` summaries as `vision_page_summary` chunks with `metadata.chunk_type='vision_page'`.
- OneDrive proof succeeded for `onedrive_01F674PXSIV6J6OA5TSFBYSDO6AXFJZJOF`:
  - 25 pages analyzed from the Graph-downloaded source PDF.
  - Graph embedder wrote 47 total chunks: 22 OneDrive text chunks and 25 vision page summary chunks.
- Automatic Graph embed proof succeeded for `onedrive_01F674PXTBGWMDGWLXOJBZKUU35DJK3P37`:
  - `embed_graph_document` ran vision internally.
  - Graph embedder wrote 39 total chunks with page intelligence.
- Evidence:
  - [pdf-vision-graph-download-proof-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-graph-download-proof-aai-669.json)
  - [pdf-vision-graph-embed-auto-proof-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-graph-embed-auto-proof-aai-669.json)

### 2026-06-25: AAI-669 PDF/Document Backfill Completed For Tracked Recent Candidates

- Render deployed the automatic Graph vision path for OneDrive/SharePoint PDFs:
  - Deploy: `dep-d8urk2l7vvec73eklqd0`
  - Commit: `238b56c8e0824e5ad5d258d3f8ddce3108fd1d9b`
- Repaired remaining OneDrive vision gaps:
  - Batch 1 corrected postcheck covered 5/5 rows after the two proof rows.
  - Batch 2 covered 10/10 rows.
  - Batch 3 covered 12/12 rows.
- Repaired 3/3 remaining drawing-upload vision gaps through `run_vision_analyzer` plus the canonical embedder.
- Fixed Graph embedding to support vision-only PDF vector records when OCR/text extraction fails.
- Recovered 7/7 OneDrive rows that were previously `ocr_failed` by embedding available OCR text where present and vision-page chunks where text extraction was insufficient.
- Fixed successful Graph embedding to upsert `rag_document_metadata`, preventing vision-only chunks from becoming orphaned from citation/status metadata.
- Fixed Outlook attachment vision for metadata-only promoted PDF attachments:
  - Stored Outlook ids were not valid for direct Graph attachment detail fetch.
  - The production fallback now resolves current messages by intake email `internet_message_id`, matches attachments by filename, and downloads bytes through Microsoft Graph `$value`.
  - Proof batch covered 3/3 attachments.
  - Remaining batch covered 18/18 attachments.
- Confirmed 5/5 small manual `.txt` uploads had real storage content and processed them through the canonical document parser/embedder.
- Final tracked inventory is clean:
  - 66/66 recent PDF/document gaps covered.
  - 0 active missing.
  - Final family coverage: Outlook attachments 22/22, drawing uploads 3/3, manual uploads 5/5, OneDrive 36/36.
- Verification passed:
  - `python3 -m py_compile backend/src/services/integrations/microsoft_graph/embed.py backend/src/services/pipeline/vision_analyzer.py backend/tests/test_graph_embed.py`
  - `PYTHONPATH=backend backend/.venv/bin/python -m pytest backend/tests/test_graph_embed.py -q`
  - `node scripts/verify/verify_rag_chunk_integrity.mjs --days=2`
- Render deployed the final Outlook attachment and vision-only metadata fix live:
  - Deploy: `dep-d8us9surnols73bp5sj0`
  - Commit: `4cc73d447508d9c54bc667444dc9f379ee24d724`
- Evidence:
  - [render-backend-deploy-live-graph-auto-vision-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/render-backend-deploy-live-graph-auto-vision-aai-669.json)
  - [render-backend-deploy-live-outlook-vision-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/render-backend-deploy-live-outlook-vision-aai-669.json)
  - [pdf-vision-onedrive-batch-1-corrected-postcheck-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-onedrive-batch-1-corrected-postcheck-aai-669.json)
  - [pdf-vision-onedrive-batch-2-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-onedrive-batch-2-aai-669.json)
  - [pdf-vision-onedrive-batch-3-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-onedrive-batch-3-aai-669.json)
  - [pdf-vision-drawing-upload-batch-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-drawing-upload-batch-aai-669.json)
  - [pdf-vision-only-onedrive-ocr-failed-batch-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-only-onedrive-ocr-failed-batch-aai-669.json)
  - [pdf-vision-only-onedrive-failed-row-repair-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-only-onedrive-failed-row-repair-aai-669.json)
  - [pdf-vision-outlook-attachment-proof-batch-3-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-outlook-attachment-proof-batch-3-aai-669.json)
  - [pdf-vision-outlook-attachment-remaining-batch-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-vision-outlook-attachment-remaining-batch-aai-669.json)
  - [manual-text-upload-storage-check-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/manual-text-upload-storage-check-aai-669.json)
  - [manual-text-upload-pipeline-batch-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/manual-text-upload-pipeline-batch-aai-669.json)
  - [pdf-backfill-candidates-final-aai-669.json](../evidence/2026-06-25-ai-rag-production-finalization/pdf-backfill-candidates-final-aai-669.json)
  - [rag-chunk-integrity-final-aai-669.txt](../evidence/2026-06-25-ai-rag-production-finalization/rag-chunk-integrity-final-aai-669.txt)
  - [test-graph-embed-after-outlook-vision-fix-aai-669.txt](../evidence/2026-06-25-ai-rag-production-finalization/test-graph-embed-after-outlook-vision-fix-aai-669.txt)

### 2026-06-25: AAI-682 Vector Retrieval Validation Started

- Created the dedicated task ledger for the retrieval filters, citations, duplicate handling, and assistant-usage slice.
- Confirmed `docs/ops/tasks/TASK-TEMPLATE.md` is missing; this task mirrors the established production-finalization task format and records the missing template as a process gap instead of blocking.
- Next action: inventory active retrieval paths and run current retrieval guardrails before implementation or deletion.
- Task: [2026-06-25-vector-retrieval-filters-citations-validation.md](../tasks/2026-06-25-vector-retrieval-filters-citations-validation.md)
- Linear: AAI-682.

### 2026-06-25: AAI-682 Low-Content Placeholder Chunks Removed

- Found and repaired embedded placeholder chunks generated from documents with no extractable text.
- Changed the document parser/embedder so low-content documents no longer create fake searchable summaries; vision-only documents can still embed real page summaries, and true low-content documents become explicit `skipped_low_content` terminal rows.
- Deleted 67 live RAG placeholder chunks, marked 16 placeholder-only RAG metadata rows as `skipped_low_content`, and mirrored that status to 16 app `document_metadata` rows.
- Added a chunk-integrity fatal guardrail for low-content placeholder chunks.
- Hybrid ranking passed after cleanup (`hybridHits=28`, `vectorHits=26`).
- Assistant readiness blocker found: `npm run rag:verify:assistant-operational-readiness` loaded the active eval suite but failed because `backendDeepAgentExecutiveBriefing` was still required by architecture/evals and was not attached by the current handler.
- Boundary verifiers also remain red for RAG/app ownership:
  - Heavy app `document_metadata.content/raw_text` reads still exist in parser/embedder and document-intelligence paths.
  - The admin AI work-runs route still reads RAG-owned `source_sync_runs` without `createRagServiceClient()`.
  - Outlook intake reads in email digest and Microsoft executive assistant paths still need the AI DB resolver.
- Evidence:
  - [vector-retrieval-path-inventory-aai-682.md](../evidence/2026-06-25-ai-rag-production-finalization/vector-retrieval-path-inventory-aai-682.md)
  - [minimal-extract-repair-applied-aai-682.json](../evidence/2026-06-25-ai-rag-production-finalization/minimal-extract-repair-applied-aai-682.json)
  - [chunk-integrity-after-minimal-repair-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/chunk-integrity-after-minimal-repair-aai-682.txt)
  - [hybrid-ranking-after-minimal-repair-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/hybrid-ranking-after-minimal-repair-aai-682.txt)
  - [test-document-low-content-and-graph-embed-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/test-document-low-content-and-graph-embed-aai-682.txt)
  - [assistant-operational-readiness-after-minimal-repair-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/assistant-operational-readiness-after-minimal-repair-aai-682.txt)
  - [metadata-boundary-after-minimal-repair-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/metadata-boundary-after-minimal-repair-aai-682.txt)
  - [client-boundary-after-minimal-repair-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/client-boundary-after-minimal-repair-aai-682.txt)
  - [backend-client-boundary-after-minimal-repair-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/backend-client-boundary-after-minimal-repair-aai-682.txt)

### 2026-06-25: AAI-682 Executive Deep Agents Bridge Restored

- Restored the live assistant handler path that attaches the canonical `backendDeepAgentExecutiveBriefing` trace for broad no-project executive/operator prompts.
- The restored frontend bridge uses the active Render Deep Agents research endpoint with an executive-specific prompt contract instead of resurrecting the removed backend contract-spike service.
- Direct executive backend answers now persist `render-backend-deep-agents-v1` metadata, response quality, source debug, source evidence widgets, and the canonical executive bridge tool trace.
- Fallback synthesis now receives a `Backend Deep Agents Executive Briefing Packet` context block and still records the canonical trace.
- `npm run rag:verify:assistant-operational-readiness` now passes: 80/80 checks.
- `npm run typecheck` still reports unrelated untracked-file type debt in `frontend/src/lib/ai/workflow-registry.ts`; it is not part of this AAI-682 slice.
- Evidence:
  - [assistant-operational-readiness-after-executive-bridge-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/assistant-operational-readiness-after-executive-bridge-aai-682.txt)
  - [frontend-typecheck-after-executive-bridge-aai-682.txt](../evidence/2026-06-25-ai-rag-production-finalization/frontend-typecheck-after-executive-bridge-aai-682.txt)

## Current Remaining Work

- No active Fireflies meeting error backlog remains inside the two-month operational concern window.
- No active Outlook/Teams shared queue backlog remains inside the one-week operational concern window.
- SharePoint source sync/retrieval is healthy.
- PDF/upload/document backfill has no active missing rows in the tracked recent candidate set after AAI-669 final inventory.
- AAI-682 boundary verifiers were repaired in later AAI-705 evidence; keep them in the final all-pipeline verifier bundle instead of treating this as an open blocker.
- A prior unrelated typecheck blocker in untracked `frontend/src/lib/ai/workflow-registry.ts` was outside the AAI-682 slice; later delegated typecheck evidence passed for the AI/RAG finalization-owned files.
- The master checklist is complete. Keep running compact final verifier refreshes before any further production-readiness closeout because these pipelines depend on live external systems.

### 2026-06-26: AAI-715 Outlook Webhook Subscription Blocker Opened

- Production-readiness blocker found before continuing Outlook legacy deletion:
  - scheduled Outlook sync and cached intake can pass while Outlook webhook subscriptions are not active.
- Live evidence at `2026-06-26T12:11Z`:
  - `npm run verify:microsoft-assistant-health -- --json`: pass for `bclymer@alleatogroup.com`;
  - direct RAG DB subscription read: `subscriptionCount=1`, `activeSubscriptionCount=0`, `syncStateCount=12`, `erroredSyncStateCount=0`;
  - only Outlook subscription row was expired/stale: `mharrison@alleatogroup.com`, status `renewal_due`, `reauthorizationRequired`.
- AAI-709 Outlook legacy mirroring deletion is paused until webhook readiness is restored or explicitly blocked.
- Subagents started:
  - backend subscription reconcile investigation/fix;
  - assistant operations status guardrail investigation/fix.
- Links:
  - [Task](../tasks/2026-06-26-outlook-webhook-subscription-readiness.md)
  - [Linear AAI-715](https://linear.app/megankharrison/issue/AAI-715/restore-active-outlook-graph-webhook-subscriptions)

### 2026-06-27: AAI-709 Outlook Legacy Mirroring Removed

- Removed disabled Outlook Graph sync legacy mirroring gates and helpers after webhook readiness and canonical Outlook intake/RAG ownership were restored.
- New Outlook syncs no longer write into legacy `project_emails`, no longer link intake attachments to legacy `email_attachments`, and no longer create separate `outlook_link` document rows from email hyperlinks.
- Kept production paths active: `outlook_email_intake`, `outlook_email_intake_attachments`, `document_metadata`, `rag_document_metadata`, and `document_chunks`.
- Updated the RAG architecture doc and cleanup inventory so the removed gates are no longer described as active compatibility candidates.
- Delegated verification passed:
  - Python compile for Outlook service/tests.
  - `backend/.venv/bin/python -m pytest backend/tests/test_outlook_intake.py -q`: 20 passed.
  - Deleted-symbol scan: zero matches in Outlook service/tests.
- Evidence:
  - [Task](../tasks/2026-06-26-remove-outlook-legacy-mirroring-gates.md)
  - [Proof](../evidence/2026-06-25-ai-rag-production-finalization/outlook-legacy-mirroring-removal-aai-709.md)

### 2026-06-27: AAI-732 Outlook RAG-To-App Incident Bridge Retired

- Deleted the obsolete standalone incident bridge `backend/src/scripts/backfill_outlook_rag_metadata_to_app_documents.py`.
- Replacement owner is now documented as:
  - live Outlook sync plus `SupabaseRagStore.upsert_document_metadata()` for app+RAG document writes;
  - `backfill_outlook_intake_rag_documents()` for bounded Outlook intake repair;
  - `outlook_promotion_freshness.py` for fail-loud intake/document promotion drift monitoring.
- Updated architecture/rebuild docs and AAI-703/AAI-682 cleanup inventories so the old bridge is no longer advertised as an active repair path.
- `npm run db:inventory` initially failed on unrelated schema inventory entries for the training-docs support pair; added dormant stubs to `tables.yaml`, reran inventory successfully, and regenerated the DB inventory artifacts.
- Verification:
  - Python compile passed for Outlook service, shared RAG store, and Outlook promotion health modules.
  - Generated DB inventory has zero references to the deleted bridge.
- Evidence:
  - [Task](../tasks/2026-06-27-retire-outlook-rag-app-bridge.md)
  - [Proof](../evidence/2026-06-25-ai-rag-production-finalization/outlook-rag-app-bridge-retirement-aai-732.md)

### 2026-06-27: AAI-734 Contextual Retrieval Pilot Retired

- Retired the remaining AAI-703 `migrate-first` contextual retrieval pilot after
  proving it had no direct callers, no package script, no Render route/schedule,
  no checked Render env enabling the contextual variant, and no live frontend
  RAG consumer.
- Deleted the manual contextual backfill script and pilot helper:
  - `backend/src/scripts/backfill_contextual_embeddings.py`
  - `backend/src/services/pipeline/contextualize.py`
- Removed the backend agent contextual variant switch so backend retrieval uses
  the finalized `search_document_chunks` RPC only.
- Applied RAG migration
  `scripts/database/rag/migrations/20260627114000_retire_contextual_retrieval_pilot.sql`
  to drop the unused contextual RPC, index, and `document_chunks` pilot columns.
- Regenerated RAG DB inventory/types and updated architecture/current cleanup
  inventories so contextual retrieval is documented as retired, not current or
  `migrate-first`.
- Verification passed:
  - delegated `cd frontend && npm run typecheck:changed`;
  - backend py_compile for RAG helper/store modules;
  - RAG migration dry-run, apply, ledger, and schema read-back;
  - `npm run db:inventory` and `npm run db:inventory -- --check-only`;
  - `npm run rag:verify:client-boundary`;
  - `npm run rag:verify:retrieval-contract`.
- Evidence:
  - [Task](../tasks/2026-06-27-retire-contextual-retrieval-pilot.md)
  - [Proof](../evidence/2026-06-25-ai-rag-production-finalization/contextual-retrieval-pilot-retirement-aai-734.md)

### 2026-06-26: AAI-715 Outlook Webhook Subscription Coverage Restored

- Patched Graph subscription reconciliation so expired, `renewal_due`, failed/removed/missed, or `reauthorizationRequired` rows create a fresh Graph subscription instead of trying to patch stale subscription ids first.
- Stale Graph delete is now best-effort; a missing old subscription no longer blocks fresh subscription creation.
- Manually triggered Render cron `alleato-graph-subscription-reconcile`.
- Live verifier now proves all configured Outlook webhook targets are active:
  - `expectedTargetCount=10`
  - `activeSubscriptionCount=10`
  - `missingActiveTargets=[]`
  - `erroredSyncStateCount=0`
- Added `npm run verify:graph-subscriptions` as a hard guardrail so zero or incomplete Outlook webhook subscription coverage fails loudly.
- Updated the assistant-facing Outlook operations tool so zero active subscriptions or all-zero operational rows return `status: "degraded"` plus explicit warnings.
- Verification passed:
  - delegated changed-file typecheck after verifier/package edits;
  - delegated changed-file typecheck after assistant-status TS edits;
  - backend subscription pytest and py_compile;
  - focused assistant operations Jest and ESLint;
  - live graph subscription verifier.
- Evidence:
  - [outlook-graph-subscriptions-live-aai-715.json](../evidence/2026-06-25-ai-rag-production-finalization/outlook-graph-subscriptions-live-aai-715.json)
- Published:
  - `4ba56cec55cb4017729a3a38e5dd290eb83f9f31`
  - Linear AAI-715 marked Done.

### 2026-06-26: AAI-718 Outlook Stale Subscription Prevention Started

- Opened urgent follow-up because stale Outlook subscription rows should not remain visible indefinitely.
- Clarified that `MICROSOFT_SYNC_USERS` is the configured mailbox set for Graph sync/subscription jobs; if `mharrison@alleatogroup.com` should be monitored, excluding it was a config bug.
- Scope:
  - mark out-of-config Outlook subscription rows removed during reconciliation;
  - add `mharrison@alleatogroup.com` to Graph-related Render `MICROSOFT_SYNC_USERS`;
  - rerun live reconcile/read-back;
  - keep `verify:graph-subscriptions` proving full configured coverage.
- Links:
  - [Task](../tasks/2026-06-26-outlook-stale-subscription-prevention.md)
  - [Linear AAI-718](https://linear.app/megankharrison/issue/AAI-718/prevent-stale-outlook-graph-subscriptions-and-include-megan-mailbox)

### 2026-06-26: AAI-718 Outlook Stale Subscription Prevention Ready For Publish

- Prevented recurrence:
  - Graph subscription reconcile now marks out-of-config subscription rows `removed` so stale lifecycle rows cannot remain active renewal debt.
  - Source health now reports `unconfigured_graph_subscription` separately from generic renewal/expiration warnings.
  - `verify:graph-subscriptions` now fails on stale non-active rows and unconfigured non-removed rows.
- Live config aligned:
  - `alleato-graph-subscription-reconcile`, `alleato-graph-sync`, `alleato-teams-dm-sync`, `alleato-teams-channel-sync`, and `alleato-source-sync-health` all read back with the 11-user Microsoft sync target set including `mharrison@alleatogroup.com`.
- Live proof:
  - Strict subscription verifier passed with `expectedTargetCount=11`, `activeSubscriptionCount=11`, `staleSubscriptionCount=0`, `unconfiguredSubscriptionCount=0`.
  - Megan mailbox scoped sync succeeded and read back as `sync_status=success` with `last_sync_at=2026-06-26T12:57:54.566226+00:00`.
  - Full Graph sync was blocked by the DB pressure guard at `total_connections=42>35`; scoped mailbox delta sync was used instead.
- Verification:
  - Delegated focused tests passed: `29 passed`.
  - Delegated Python compile passed.
  - Delegated `node --check scripts/verify/verify_graph_subscriptions.mjs` passed.
- Evidence:
  - [AAI-718 evidence](../evidence/2026-06-25-ai-rag-production-finalization/outlook-stale-subscription-prevention-aai-718.md)

### 2026-06-26: Outlook Assistant Runtime Gate Found And Render Restart Triggered

- Confirmed Outlook sync/cache health was not the remaining assistant blocker:
  - `npm run verify:microsoft-assistant-health -- --json` passed before the runtime investigation.
  - Production inbox eval still failed 0/5 because the frontend bridge received the fallback answer: "I couldn't reach the Microsoft inbox assistant in time..."
- Root cause proved by direct backend probe:
  - `POST https://alleato-backend-rbnj.onrender.com/api/intelligence/microsoft-executive-assistant`
  - response: `503 Service Unavailable`
  - detail: `Deep Agents Microsoft Executive Assistant is disabled. Set DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_ENABLED=true to run the specialist.`
- Patched live Render service `alleato-backend` through individual env-var updates, not the unsafe full env replacement endpoint:
  - `DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_ENABLED`
  - `DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_MODEL`
  - `MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX`
  - `MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_DRAFT`
  - `MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_TEAMS_ALERT`
- Read-back proved all required env keys are present, but the live instance still returned the disabled-gate 503 until restart.
- Triggered Render deploy/restart for `alleato-backend`:
  - deploy id: `dep-d8vko5ok1i2s73ercb70`
  - commit: `eaa5067bd942a0ba450f80c4ab1b8f0a3c225f56`
- Verification delegated:
  - watch Render deploy to live/failed;
  - rerun direct backend probe;
  - rerun `npm run verify:microsoft-assistant-health -- --json`;
  - rerun `npm run rag:verify:inbox-evals:prod`.
- Runtime recovery:
  - backend probe advanced to 200 after Render deploy `dep-d8vko5ok1i2s73ercb70`;
  - frontend bridge was patched/published in `583c27e46a716beb0f33e872abae3aa467b3786e` so inbox widgets no longer replace the chat answer with a one-line widget summary;
  - production inbox eval improved from 1/5 to 3/5 after Vercel deployment `dpl_FFz1BHCF7peYZsVXpLiM1ejkC9hV`;
  - backend renderer patches were deployed through Render; final live backend deploy for this slice is `dep-d8vli367r5hc73attkjg` (`3d9b133f2`) plus follow-up ownership deploy `dep-d8vlg83bc2fs738vlfkg` (`02fc9b18`) and preview cleanup deploy `dep-d8vlc519rddc739urt10` (`fa24e6ec`).
- Follow-up patches completed:
  - classify temp-power/electrical-risk thread language as `Watch` instead of `Ignore/noise`;
  - keep Watch/Ignore context in reply-triage answers so the assistant does not imply every visible item needs a reply.
  - exclude routine/no-reply noise from `important emails this morning` answers;
  - summarize non-reply Watch/Ignore items in reply triage instead of listing them as equal reply work;
  - add reply draft direction for reply/delegate items without claiming a draft was created.
  - remove Outlook safety-banner text from evidence snippets;
  - make ownership wording explicit that ownership is not confirmed by inbox presence alone;
  - enforce same-day filtering for reply-triage prompts;
  - add an explicit no-critical-email lead for urgent triage when no `Alert now` item exists.
  - classify GitHub app-authorization/account-change notices as `Watch` instead of generic no-reply noise;
  - suppress draft-direction copy in arrived-today summaries unless the user asked for drafting.
  - suppress speculative owner/draft fields in list-style triage answers;
  - exclude routine/no-reply rows from arrived-today output while reporting the excluded count;
  - keep account-security watch rows out of `important this morning` while retaining project-risk watch rows.
  - make `last five emails` a pure source listing with sender, subject, timestamp, and preview only;
  - change arrived-today heading to explicitly include `Outlook emails received today` and `attention`;
  - name watch/no-reply rows in reply triage without classifying them as reply work.
  - add restrained response path/reason to `last five emails` without speculative owner/risk fields;
  - strip invisible Outlook/marketing padding characters from evidence snippets.
  - add restrained response path/reason to `last five emails` without speculative owner/risk fields;
  - strip invisible Outlook/marketing padding characters from evidence snippets;
  - add arrived-today decision summary so reply candidates and watch items are explicit.
- Verification:
  - delegated TypeScript changed-file check and ESLint passed for `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`;
  - backend compile passed for `backend/src/services/agents/microsoft_executive_assistant/agent.py`;
  - local renderer smoke confirms morning and reply-triage output shape;
  - local arrived-today smoke confirms GitHub authorization is `Watch` and no draft direction is shown;
  - local smoke confirms morning, arrived-today, and reply-triage output omit speculative owner/draft lines and exclude routine no-reply rows.
  - local smoke confirms pure last-five listing, arrived-today wording, and named non-reply triage rows.
  - local smoke confirms last-five action labels and cleaned marketing preview text.
  - production eval passed: `npm run rag:verify:inbox-evals:prod` returned `Pass: 5/5` against `https://projects.alleatogroup.com/api/ai-assistant/chat`.
  - Evidence: [inbox-evals-prod-after-arrived-decision-summary.txt](../evidence/2026-06-25-ai-rag-production-finalization/inbox-evals-prod-after-arrived-decision-summary.txt)
  - Eval artifacts:
    - [results.json](../../archive/2026-06-22-docs-migration/ai-plan/evals/runs/2026-06-27T05-02-53-708Z-409e073e/results.json)
    - [summary.md](../../archive/2026-06-22-docs-migration/ai-plan/evals/runs/2026-06-27T05-02-53-708Z-409e073e/summary.md)
  - focused backend pytest is blocked before collection by missing `python-multipart` in the test environment, unrelated to the assistant classifier patch.
- Outlook assistant-consumption proof is complete for the production inbox regression bundle; continue with the next finalization slice.

### 2026-06-26: AAI-718 Outlook Stale Subscription Prevention Published

- Published to `origin/main`:
  - `76c1e1cb684251963fc09083466ffedc4bb67dfe`
- Verified after push:
  - local `HEAD` equals `origin/main`.
  - Linear AAI-718 marked Done.
### 2026-06-26: AAI-720 DB Pressure Guard Buckets Started

- Opened follow-up after Graph sync was blocked by raw `total_connections=42>35`.
- Live inspection showed the current pressure problem is mostly low headroom from Supabase platform/PostgREST idle baseline, not an active app query pileup.
- Scope:
  - classify DB connections by owner bucket;
  - keep fail-closed checks for real app/client pressure;
  - add a bucketed verifier/report;
  - prove with focused tests and live evidence.
- Links:
  - [Task](../tasks/2026-06-26-db-pressure-guard-buckets.md)
  - [Linear AAI-720](https://linear.app/megankharrison/issue/AAI-720/refine-app-db-pressure-guard-with-bucketed-connection-diagnostics)

### 2026-06-26: AAI-720 DB Pressure Guard Buckets Implemented

- Updated the app DB pressure guard to classify `pg_stat_activity` into owner buckets:
  - `app_or_external`
  - `supabase_postgrest_pool`
  - `supabase_realtime`
  - `supabase_storage`
  - `supabase_supavisor`
  - `supabase_platform_other`
  - `postgres_internal`
- Raw `total_connections` remains diagnostic by default; it blocks only when `APP_DB_PRESSURE_BLOCK_ON_RAW_TOTAL=true`.
- Guard still blocks for real app pressure:
  - `app_client_connections`
  - overall active connections
  - app idle-in-transaction connections
  - app long-running active connections
- Added `npm run verify:app-db-pressure` for read-only live diagnostics.
- Live verifier output:
  - `total_connections=35`
  - `platform_connections=32`
  - `app_client_connections=3`
  - `app_active_connections=0`
  - `app_idle_in_transaction_connections=0`
  - `app_long_running_active_connections=0`
- Focused test pass:
  - `14 passed`.
- Evidence:
  - [AAI-720 evidence](../evidence/2026-06-25-ai-rag-production-finalization/db-pressure-guard-buckets-aai-720.md)

### 2026-06-26: AAI-720 DB Pressure Guard Buckets Published

- Published to `origin/main`:
  - `1cfb8ca7a`
  - `3ca917e73`
- Verified after push:
  - local `HEAD` equals `origin/main`.
  - Linear AAI-720 marked Done.

### 2026-06-26: AAI-721 Project Emails Live Outlook Intake Repair Completed

- Opened urgent follow-up after the project Emails page rendered an empty inbox while Outlook sync data existed.
- Confirmed first root cause:
  - `outlook_email_intake` had 545 rows in the last seven days;
  - `project_emails` had 0 rows created in the same window;
  - `/{projectId}/emails` calls `/api/projects/{projectId}/emails`, and that route still read only `project_emails`.
- Patched the project GET route so:
  - default `source=all` returns app-composed rows plus live Outlook intake rows;
  - `source=outlook` bypasses stale `project_emails`;
  - `source=app` preserves the app-authored draft path.
- Guarded mixed-source UI actions:
  - Outlook intake rows are read-only for old `project_emails` edit/delete/summarize/task endpoints;
  - bulk delete excludes Outlook intake rows;
  - old project-email attachment queries are disabled for Outlook intake rows until attachment rendering is migrated to `outlook_email_intake_attachments`.
- Focused guardrails:
  - route unit tests passed for project and global email routes;
  - focused ESLint passed with existing warnings only;
  - delegated changed-file typecheck passed.
- Production browser/API proof then failed before the env repair:
  - authenticated admin session on `https://projects.alleatogroup.com/876/emails` showed the empty inbox;
  - authenticated `/api/projects/876/emails?source=outlook` returned `[]`;
  - RAG DB readback showed project `876` rows existed, including `Re: Exol Morrisville PA`.
- Confirmed second root cause:
  - Vercel production runtime env pull showed no active `RAG_SUPABASE_URL`, no `RAG_SUPABASE_SERVICE_ROLE_KEY`, and no `RAG_DATABASE_READS_ENABLED`;
  - production therefore fell back to the PM App Supabase project, whose `outlook_email_intake` had 0 rows in the one-week operational window.
- Applied provider/config repair:
  - overwrote Vercel production `RAG_SUPABASE_URL`, `RAG_SUPABASE_SERVICE_ROLE_KEY`, and `RAG_DATABASE_READS_ENABLED` from the existing local secure env source without printing secrets;
  - changed `createOutlookIntakeServiceClient()` so Outlook intake can only use the AI/RAG Supabase client and fails loudly if RAG env is missing;
  - added `scripts/validate-runtime-config.mjs` production checks for the same RAG env vars.
- Added fail-loud guardrail test:
  - `src/lib/supabase/__tests__/service.test.ts` proves Outlook intake uses the RAG host and missing RAG env throws instead of falling back to PM App.
- Production proof after env repair:
  - Vercel redeploy `dpl_7f5gZeBdGQDphgiUJyK4myqS7MJJ` reached READY;
  - authenticated `/api/emails` returned 1000 live Outlook rows;
  - authenticated `/api/projects/876/emails?source=outlook` returned 28 rows with `Re: Exol Morrisville PA` first;
  - browser body text for `/876/emails` contains `Steve Fischer` and `Re: Exol Morrisville PA` and no longer contains the empty-state strings.
- Publish scope:
  - this AAI-721 closeout publishes the fail-loud guardrail code so future production deployments cannot silently fall back to the PM App database.
- Links:
  - [Task](../tasks/2026-06-26-outlook-project-emails-intake.md)
  - [Linear AAI-721](https://linear.app/megankharrison/issue/AAI-721/repair-project-emails-route-to-read-live-outlook-intake)

### 2026-06-27: Final Verifier Repair Slice - Source Lifecycle, Graph Subscriptions, Chunk Integrity

- Repaired Fireflies/meeting finalization gates:
  - `backend/src/services/pipeline/llm.py` no longer sends unsupported `response_format` payloads through the AI Gateway provider path.
  - `scripts/verify/verify_meeting_pipeline_contract.mjs` now checks the provider-path contract and the actual `error_message=None` cleanup code.
  - Bounded Fireflies chunk repair inserted missing chunks for recent eligible meetings.
  - `npm run rag:verify:meeting-pipeline` passed.
  - `npm run rag:verify:meetings` passed with `75/75` recent eligible meetings embedded.
- Repaired source lifecycle finalization gate:
  - `scripts/verify/verify_source_lifecycle_health.mjs` now measures task project disposition, not only direct `project_id`, so deterministic project links and explicit manual-review/non-project dispositions both satisfy the target architecture.
  - Refreshed one current Project Intelligence packet for project `1009` after stale packet detection.
  - `npm run rag:verify:source-lifecycle` passed with no failures.
- Repaired local Graph subscription verifier drift:
  - Local `.env` and `frontend/.env.local` now match the already-published/provider-verified 11-user `MICROSOFT_SYNC_USERS` set including `mharrison@alleatogroup.com`.
  - `npm run verify:graph-subscriptions -- --json` passed with `activeSubscriptionCount=11`, `missingActiveTargets=[]`, `staleSubscriptionCount=0`, and `unconfiguredSubscriptionCount=0`.
- Repaired RAG chunk metadata integrity:
  - `scripts/verify/verify_rag_chunk_integrity.mjs` now has an explicit `--repair-orphan-metadata` mode.
  - Ran `npm run rag:verify:chunk-integrity -- --repair-orphan-metadata`; it repaired `34` orphan `rag_document_metadata` rows and then passed.
  - `scripts/backfill-recent-meeting-chunks.mjs` now writes `rag_document_metadata` before inserting meeting chunks so the fresh-orphan recurrence path is closed.
- Delegated verification passed:
  - `node --check` for all touched `.mjs` files.
  - `python3 -m py_compile backend/src/services/pipeline/llm.py`.
  - `frontend: npm run typecheck:changed`.
- Remaining from this slice:
  - The scoped sync still logged PM final-projection guard errors inside nested intelligence extraction. Those are non-fatal to Outlook intake/RAG embedding but must be closed before final platform completion.

### 2026-06-27: Outlook Assistant Cache And Vectorization Status Repaired

- Confirmed the assistant health failure was real and source-specific:
  - Live Graph inbox for `bclymer@alleatogroup.com` saw latest actionable mail at `2026-06-27T02:42:57Z`.
  - `outlook_email_intake` was stale at `2026-06-26T11:20:05Z`.
  - `npm run verify:microsoft-assistant-health -- --json` failed on `cached_intake`.
- Ran a scoped Brandon Outlook sync:
  - `MICROSOFT_SYNC_USERS=bclymer@alleatogroup.com`
  - `OUTLOOK_SYNC_MAX_USERS=1`
  - `OUTLOOK_SYNC_MAX_MESSAGES_PER_MAILBOX=25`
  - `GRAPH_DELTA_MAX_PAGES=3`
  - `GRAPH_DELTA_MAX_ITEMS=250`
  - Result: `19` Outlook items synced and `10` email documents embedded.
- Confirmed cache recovery:
  - `npm run verify:microsoft-assistant-health -- --json` passed.
  - Cache latest now matches Graph latest at `2026-06-27T02:42:57+00:00`.
- Closed the vectorization status mismatch:
  - Root cause: `run_graph_sync()` called `embed_pending_graph_documents()` but did not project actual RAG chunk state back onto `outlook_email_intake.vectorization_status`.
  - Prevention: `backend/src/services/integrations/microsoft_graph/sync.py` now calls `refresh_outlook_intake_vectorization_statuses()` for selected Outlook mailboxes after embedding.
  - Bounded follow-up embedding pass embedded the two latest Brandon emails.
  - Read-back now shows both post-midnight Brandon rows as `vectorization_status='embedded'` with `vectorization_chunk_count=3`.
- Verification:
  - Delegated Python compile passed for `backend/src/services/integrations/microsoft_graph/sync.py` and `backend/src/services/pipeline/llm.py`.
  - Delegated Node syntax checks passed for touched `.mjs` scripts.
  - Delegated `frontend: npm run typecheck:changed` passed.
- Final compact verifier pass:
  - `npm run rag:verify:meeting-pipeline` passed.
  - `npm run rag:verify:meetings` passed with `75/75` recent eligible meetings embedded.
  - `npm run rag:verify:source-lifecycle` passed with no failures.
  - `npm run verify:graph-subscriptions -- --json` passed with `expectedTargetCount=11`, `activeSubscriptionCount=11`, `staleSubscriptionCount=0`, `unconfiguredSubscriptionCount=0`.
  - `npm run verify:microsoft-assistant-health -- --json` passed for `bclymer@alleatogroup.com`.
  - `npm run rag:verify:chunk-integrity` passed with no missing embeddings and no orphan `rag_document_metadata` failures.

### 2026-06-27: Outlook Event-Driven Synthesis Guard Noise Removed

- Closed the remaining non-fatal Outlook sync noise from the previous slice:
  - Root cause: `synthesize_new_comms_since()` attempted optional L2 Project Intelligence packet refreshes during the Outlook sync even when `ALLOW_PM_APP_FINAL_PROJECTIONS` was intentionally disabled.
  - The PM final-projection guard correctly blocked writes, but the event-driven synthesizer reported those expected blocks as `errors`.
  - Prevention: `backend/src/services/intelligence/project_synthesizer.py` now catches `AppDbProjectionError` only around the optional L2 packet refresh and reports `synthesis_packets_skipped` instead. Extraction/card/task errors still remain loud.
- Runtime proof:
  - Ran `synthesize_new_comms_since('2026-06-27T03:02:43.762554+00:00', max_projects=5, max_extractions_per_project=1, refresh_intelligence=True)` with final projections disabled.
  - Result: `synthesis_packets_skipped=5`, `synthesis_packets_written=0`, `errors=[]`.

### 2026-06-27: Final Bundle Red Gates Repaired Again

- Re-ran final compact verification and found current red gates:
  - `npm run rag:verify:meetings` failed because 3 of 75 recent Fireflies meetings had no embedded chunks.
  - `npm run verify:microsoft-assistant-health -- --json` failed because Brandon's cached Outlook intake was behind live Graph.
  - `npm run rag:verify:response-contract` failed because the verifier still expected the old `stepCountIs(10)` contract while the live handler uses `stepCountIs(6)`.
  - `npm run rag:verify:client-boundary` failed because the verifier did not recognize the approved `ToolContext.rag` seam.
- Fireflies repair:
  - Ran `npm run rag:backfill:meeting-chunks -- --days=14 --limit=100`.
  - Inserted missing chunks for 3 recent meetings.
  - `npm run rag:verify:meetings` now passes with `75/75` recent eligible meetings embedded.
  - Read-back shows the three Fireflies job rows are `done` with null errors and embedded chunks exist.
- Outlook repair and prevention:
  - Ran a bounded Brandon Outlook sync with Graph delta limits; it synced 17 Outlook rows, embedded 1 email chunk, and reported no sync/intelligence errors.
  - `npm run verify:microsoft-assistant-health -- --json` now passes; cached intake matches the latest live Graph inbox message at `2026-06-27T06:57:58+00:00`.
  - Root cause for recurrence risk: `alleato-graph-sync` runs every 2 hours with 11 configured mailboxes, so bounded mailbox selection can let the executive assistant mailbox age out even while the cron is healthy.
  - Prevention: `backend/src/services/integrations/microsoft_graph/sync.py` now supports `OUTLOOK_SYNC_ALWAYS_INCLUDE_USERS`, and `render.yaml` configures `bclymer@alleatogroup.com` as always included with `OUTLOOK_SYNC_MAX_USERS=2`.
  - Live Render read-back confirms `OUTLOOK_SYNC_ALWAYS_INCLUDE_USERS=bclymer@alleatogroup.com`, `OUTLOOK_SYNC_MAX_USERS=2`, and `MICROSOFT_SYNC_USERS` still includes 11 users with Brandon first.
- Guardrail alignment:
  - `scripts/verify/verify_rag_client_boundary.mjs` now accepts either direct `createRagServiceClient()` ownership or the production `ToolContext.rag` adapter seam.
  - `scripts/verify/verify_ai_assistant_response_contract.mjs` now checks the current `stepCountIs(6)` strategist loop contract.
- Verification passed:
  - Delegated `node --check` and verifier checks for the two `.mjs` guardrails.
  - Delegated Python compile and focused pytest for Graph sync options: `10 passed`.
- Evidence:
  - [meetings-final-bundle-current-fail-20260627.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings-final-bundle-current-fail-20260627.txt)
  - [meetings-final-bundle-backfill-20260627.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings-final-bundle-backfill-20260627.txt)
  - [meetings-final-bundle-after-backfill-20260627.txt](../evidence/2026-06-25-ai-rag-production-finalization/meetings-final-bundle-after-backfill-20260627.txt)
  - [microsoft-assistant-health-final-bundle-current-fail-20260627.json](../evidence/2026-06-25-ai-rag-production-finalization/microsoft-assistant-health-final-bundle-current-fail-20260627.json)
  - [outlook-final-bundle-scoped-sync-20260627.json](../evidence/2026-06-25-ai-rag-production-finalization/outlook-final-bundle-scoped-sync-20260627.json)
  - [microsoft-assistant-health-final-bundle-after-scoped-sync-20260627.json](../evidence/2026-06-25-ai-rag-production-finalization/microsoft-assistant-health-final-bundle-after-scoped-sync-20260627.json)
  - [final-bundle-readback-outlook-fireflies-20260627.json](../evidence/2026-06-25-ai-rag-production-finalization/final-bundle-readback-outlook-fireflies-20260627.json)
  - [render-graph-sync-outlook-always-include-env-20260627.json](../evidence/2026-06-25-ai-rag-production-finalization/render-graph-sync-outlook-always-include-env-20260627.json)

### 2026-06-27: AAI-737 Final Env And Orphan Database Cleanup Proof Closed

- Removed deprecated provider env keys from Vercel and Render using key-name-only operations:
  - stale embedding/provider flags;
  - stale ChatKit public keys;
  - stale streaming/AI query frontend flags;
  - stale `RAG_PIPELINE_TYPE` and legacy vector-store env keys.
- Added a fail-loud provider guardrail:
  - `scripts/verify/verify_deprecated_provider_env_absent.mjs`
  - `npm run verify:deprecated-provider-env`
  - The guard checks Vercel/Render key names and never prints values.
- Dropped eight proven-dead MAIN database tables:
  - `messages`
  - `chats`
  - `search_documents`
  - `ai_analysis_jobs`
  - `ai_models`
  - `document_executive_summaries`
  - `documents_rfis_links`
  - `documents_submittals_links`
- Retained `document_insights` and marked it `blocked` because the `actionable_insights` view depends on it.
- Regenerated database inventory and Supabase types after the migration.
- Verification passed:
  - `npm run verify:deprecated-provider-env`
  - `npm run db:migrations:verify-applied -- supabase/migrations/20260627120000_drop_dead_ai_document_tables.sql`
  - `npm run db:inventory`
  - `npm run db:inventory -- --check-only`
  - `npm run db:types`
  - delegated `frontend: npm run typecheck:changed` twice after JS/package changes.
- Evidence:
  - [Task](../tasks/2026-06-27-finalize-env-db-cleanup-proof.md)
  - [Final proof](../evidence/2026-06-25-ai-rag-production-finalization/env-db-cleanup-final-aai-737.md)

### 2026-06-27: AAI-738 Final Production Deliverables Produced

- Created the final production-readiness deliverables package:
  - [Task](../tasks/2026-06-27-ai-rag-final-deliverables.md)
  - [Final deliverables](../evidence/2026-06-25-ai-rag-production-finalization/final-production-readiness-deliverables-aai-738.md)
- The deliverables include:
  - checklist of every completed pipeline;
  - remaining blockers/residual risks;
  - deleted legacy code and obsolete implementation list;
  - architectural changes summary;
  - current and historical end-to-end testing evidence;
  - final production implementation confirmation.
- Fresh verifier refresh initially caught a real Fireflies regression:
  - `npm run rag:verify:meetings` failed at 73/75 recent meetings embedded.
  - `npm run rag:verify:source-lifecycle` failed on Fireflies embedded coverage.
- Repair:
  - `npm run rag:backfill:meeting-chunks -- --days=14 --limit=100` inserted 2 missing recent meeting chunks.
- Final verifier state after repair:
  - `npm run rag:verify:meetings` passed with 75/75 recent meetings embedded.
  - `npm run rag:verify:source-lifecycle` passed.
  - `npm run rag:verify:graph-embedding` passed.
  - `npm run verify:graph-subscriptions -- --json` passed with 11 active targets, 0 stale subscriptions, 0 missing targets, and 0 errored sync states.
  - `npm run rag:verify:chat-architecture`, `source-specific`, `retrieval-contract`, `chunk-integrity`, and `response-contract` passed.
  - `npm run verify:microsoft-assistant-health -- --json` passed.
  - `npm run verify:deprecated-provider-env`, `db:inventory -- --check-only`, `db:types:check`, `verify:acumatica-sync-health`, and `rag:verify:render-ai` passed.

### 2026-06-27: AAI-739 Product-Facing Retrieval Smoke Proof Added

- Created product smoke proof:
  - [Task](../tasks/2026-06-27-ai-rag-product-retrieval-smoke.md)
  - [Evidence](../evidence/2026-06-25-ai-rag-production-finalization/product-retrieval-smoke-aai-739.md)
- Primary passing smoke:
  - `AI_EVAL_BASE_URL=https://projects.alleatogroup.com AI_EVAL_CASE_TIMEOUT_MS=180000 AI_EVAL_JUDGE_ENABLED=false npm run rag:verify:eval-suite:case -- realworld-last-five-emails`
  - Result: PASS in 13982ms.
  - Proof: `/api/ai-assistant/chat` returned HTTP 200, assistant message persisted, `consultMicrosoftExecutiveAssistant` fired, nested read_live_outlook_inbox reported `source=microsoft_graph_live`, `count=5`, and mailbox `bclymer@alleatogroup.com`.
- Secondary Teams smoke:
  - `source-lookup-teams` passed route/persistence/tool metadata but was weaker proof because direct Teams-specific Westfield rows were unavailable for the prompt and the answer fell back to packet/context evidence.
- Meeting smoke finding:
  - Baseline `source-lookup-meetings` returned HTTP 200 and persisted retrieval metadata, but failed the eval because it took 153819ms, exceeding the 75000ms max budget.
  - AAI-749 fixed the path and the post-deploy production recheck passed in `5141ms` with 0 failures and 0 warnings.
  - Artifact: retired local eval artifact; the result above is preserved as historical evidence.

### 2026-06-27: AI Memory Citation Metadata Contract Repaired

- Fresh compact verifier refresh found a real retrieval-contract failure:
  - `npm run rag:verify:retrieval-contract` failed because retrievable AI memory chunks were missing citation/reference metadata.
  - Example failing row: `ai_memory_bb4b0ddb-b2be-4bd5-8116-961917615b0d` had `doc_title=null`.
- Root cause:
  - `syncMemoryChunkToAiDb()` wrote AI memory vectors to `document_chunks` but did not upsert the matching `rag_document_metadata` record.
- Durable fix:
  - `frontend/src/lib/ai/services/ai-memory-service.ts` now writes AI memory source metadata before writing the chunk and fails loudly if metadata sync fails.
  - Focused Jest coverage now asserts memory creation writes both `rag_document_metadata` and `document_chunks`.
- Live data repair:
  - Backfilled existing uncitable AI memory chunks in the RAG database.
  - Result: `before=26415`, `repaired=26415`, `after=0`.
- Verification:
  - `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/services/__tests__/ai-memory-service.test.ts --runInBand` passed with `6/6`.
  - Delegated changed-file typecheck passed for `ai-memory-service.ts` and its focused test.
  - `npm run rag:verify:retrieval-contract` passed.
- Evidence:
  - [AI memory citation metadata repair](../evidence/2026-06-25-ai-rag-production-finalization/ai-memory-citation-metadata-repair-20260627.md)

### 2026-06-27: AAI-751 Backend Pipeline A Insight Stubs Retired

- Found an active legacy/no-op compatibility path:
  - `SupabaseRagStore.list_insights()` and `insert_insight()` were deprecated no-ops.
  - Backend `/api/chat`, `/api/projects/{project_id}`, and Fireflies ingestion still called those no-op methods.
- Removed the active dead path:
  - backend chat replies no longer call the legacy insight reader or return an inert `insights` response field;
  - backend project detail no longer calls the legacy insight reader or returns an inert `insights` response field;
  - Fireflies ingestion no longer calls the no-op legacy insight writer;
  - the deprecated helper methods were removed from `SupabaseRagStore`;
  - public OpenAPI JSON/YAML and backend API docs were updated.
- Replacement owner:
  - canonical intelligence remains owned by `insight_cards`, `source_signal_candidates`, intelligence packets, tasks, chunks, and AI memories.
- Verification:
  - static scan found no remaining `list_insights()` / `insert_insight()` active references or orphan OpenAPI `Insight` schema refs;
  - OpenAPI JSON parsed successfully;
  - touched backend modules passed `py_compile`;
  - focused backend tests passed: `59 passed`;
  - delegated compact AI/RAG verifier bundle passed all 7 commands.
- Evidence:
  - [Task](../tasks/2026-06-27-retire-pipeline-a-insight-stubs.md)

### 2026-06-27: AAI-753 Final Verifier Warning Gaps Closed

- Closed the stale AI SDK MCP architecture warning:
  - subagent proof showed live `/api/ai-assistant/chat` already discovers, merges, traces, and closes MCP tools;
  - `scripts/verify/verify_ai_chat_architecture.mjs` now checks the current `assistantMcpToolDescriptor` descriptor policy instead of the removed `isReadOnlyMcpTool` symbol;
  - `npm run rag:verify:chat-architecture` now passes with 0 warnings.
- Closed the Microsoft assistant cron detection gap:
  - live Render read-back showed `alleato-microsoft-executive-assistant-check` was suspended even though the verifier only warned about missing run history;
  - resumed the Render cron via `POST /v1/services/crn-d8orvmmrnols73etajrg/resume`;
  - triggered manual run `crn-d8orvmmrnols73etajrg-1782572727`;
  - `scripts/verify/verify_microsoft_assistant_health.mjs` now fails on suspended cron state and can use Render job history when service-level `lastSuccessfulRunAt` is absent;
  - `npm run verify:microsoft-assistant-health -- --json` passes with 0 warnings and `lastSuccessfulRunAt=2026-06-27T15:07:07Z`.
- Evidence:
  - [Task](../tasks/2026-06-27-final-verifier-warning-gaps.md)

### 2026-06-27: AAI-755 Extractor Pipeline A No-Op Writer Removed

- Found the remaining active-source Pipeline A compatibility stub:
  - `backend/src/services/pipeline/extractor.py` still defined private
    `_upsert_insight()` as a deprecated no-op writer for the retired legacy
    insights-table output.
  - Active meeting extraction had already moved to Pipeline B through
    `_safe_promote_meeting_signals`, `source_signal_candidates`, and promoted
    `insight_cards`.
- Removed the dead path:
  - deleted the unused `_upsert_insight()` no-op;
  - corrected stale extractor and orchestrator descriptions that still named
    the retired legacy insights-table output as Stage 3 output.
- Replacement owner:
  - meeting intelligence writes now remain exclusively owned by `_upsert_task`
    for tasks and `_safe_promote_meeting_signals` for candidate/card promotion.
- Verification:
  - static scan found no deleted `_upsert_insight()` no-op in active backend
    source; remaining hits are proof docs and the active
    `_upsert_insight_card_from_candidate` helper name;
  - delegated backend syntax check passed for the touched extractor and
    orchestrator modules;
  - delegated focused backend tests passed with `14 passed`;
  - recent compact AI/RAG verifier bundle passed all 7 commands after
    `4225e8f18`.
- Evidence:
  - [Task](../tasks/2026-06-27-remove-extractor-pipeline-a-noop.md)

### 2026-06-27: AAI-756 Unreferenced Legacy RAG Utility Scripts Deleted

- Deleted two runtime-safe legacy utilities after import/package/provider proof:
  - `scripts/ingestion/ingest_knowledge_base_folder.py`
  - `scripts/ops/backfill-legacy-drawing-document-metadata.mjs`
- Replacement owners:
  - production SharePoint/Graph ingestion remains owned by backend Microsoft
    Graph sync services and Render jobs;
  - production drawing OCR/metadata remains owned by the upload/OCR pipeline;
  - historical drawing backfill evidence remains in the submittal synthetic
    proof task.
- Follow-up:
  - `scripts/ingestion/sharepoint_project_folder_dry_run.py` was retained in
    AAI-756 because the package script still existed, then removed with the
    package entrypoint in AAI-758.
- Evidence:
  - [Task](../tasks/2026-06-27-delete-unreferenced-rag-utility-scripts.md)

### 2026-06-27: AAI-758 SharePoint Dry-Run Entrypoint Removed

- Removed the last package-exposed legacy SharePoint preview path:
  - deleted root package script `rag:sharepoint:dry-run`;
  - deleted `scripts/ingestion/sharepoint_project_folder_dry_run.py`.
- Replacement owner:
  - production SharePoint/Graph ingestion remains owned by backend Microsoft
    Graph sync services and Render jobs.
- Evidence:
  - [Task](../tasks/2026-06-27-remove-sharepoint-dry-run-entrypoint.md)
