# AI Data Pipeline and RAG Production Architecture

Status: Authoritative target architecture
Owner: Alleato AI
Created: 2026-06-25
Last reviewed: 2026-06-26
Applies to: Fireflies, Microsoft Graph, SharePoint, uploaded documents, Acumatica, embeddings, RAG retrieval, Project Intelligence, and AI assistants

This document defines the final production setup for Alleato's AI data pipeline and RAG system. It is the source of truth for implementation, cleanup, verification, and future changes.

The system has one production architecture:

1. Source systems deliver raw records through webhooks, scheduled reconciliation, or upload events.
2. Raw records are normalized into the source ledger and document catalog.
3. Eligible records are OCRed, image-analyzed, chunked, embedded, and stored in the AI database.
4. Records are project-assigned deterministically where possible, otherwise routed to a confidence-scored review inbox.
5. Tasks and Project Intelligence are generated from source-backed operating records.
6. Every assistant reads through the finalized retrieval/tool architecture, not parallel source-specific shortcuts.
7. Failures retry, log, alert, and remain visible until resolved.

## Production Databases

| Database | Supabase ref | Production role |
| --- | --- | --- |
| PM App | `lgveqfnpkxvzbnnwuled` | Product records, projects, tasks, document catalog bridge, Project Intelligence packets/cards/evidence, user-facing operational state |
| AI/RAG | `fqcvmfqldlewvbsuxdvz` | Source ingestion state, raw communication intake, RAG document metadata, vector chunks, embedding state, pipeline/model usage, source health and alert ledgers |

RAG-owned tables live in the AI/RAG database. Product-facing projections live in the PM App database. Cross-database duplication is allowed only as an explicit bridge/projection with a source key and idempotency contract.

## Runtime Configuration Guardrails

Production surfaces that read RAG-owned tables must use explicit AI/RAG database configuration. They must not silently fall back to the PM App database when RAG configuration is missing.

Required production runtime variables:

- `RAG_SUPABASE_URL`
- `RAG_SUPABASE_SERVICE_ROLE_KEY` or an explicitly approved equivalent service key
- `RAG_DATABASE_READS_ENABLED=true` for runtime surfaces that read from the AI/RAG database

Fail-loud requirements:

- Startup/runtime validation must fail when a production RAG reader is missing required RAG database configuration.
- Source-specific clients such as Outlook intake readers must construct clients from `RAG_SUPABASE_URL` and RAG service credentials only.
- A missing or disabled RAG read path must return a degraded or error state, not an empty dataset that looks authoritative.
- Provider env repair must be verified by provider readback, deployment status, and a production API/browser proof against the user-facing surface.

The June 2026 Outlook incident is the canonical failure mode this guardrail prevents: production Vercel env was missing RAG Supabase variables, so Outlook UI reads fell back to the PM App Supabase project and rendered an empty inbox while `outlook_email_intake` rows existed in the AI/RAG database.

## Final Trigger Strategy

| Source | Final trigger type | Notes |
| --- | --- | --- |
| Outlook Email | Microsoft Graph webhook plus scheduled reconciliation cron | Webhook is the near-real-time wakeup. Cron catches missed events, expired subscriptions, and stale delta state. |
| Microsoft Teams Messages | Microsoft Graph webhook where supported plus scheduled reconciliation cron | Use webhooks for supported resources. Use cron for Teams resources where webhook coverage, permissions, or reliability are limited. |
| SharePoint Documents | Microsoft Graph change notification plus scheduled reconciliation cron | Webhook triggers updates. Cron verifies inventory, catches missed changes, and re-drives stale files. |
| Fireflies Transcripts | Fireflies webhook when available plus scheduled polling fallback | Webhook is preferred for new transcript availability. Polling catches missed transcripts and webhook/provider outages. |
| Uploaded PDFs/Documents | Event-based trigger on upload | Processing starts immediately after upload creates the canonical document metadata row. |
| Acumatica | Scheduled cron twice daily | Financial/accounting sync is batch-oriented and does not need real-time webhooks. |

## When Webhooks Are Used

Use webhooks when the source platform can reliably notify Alleato that new or changed data exists and the notification can be acknowledged quickly without doing heavy processing inline.

Webhook handlers must:

- validate provider authenticity or client state
- persist the notification or mark source state as pending
- return quickly
- enqueue or trigger the same durable processing path used by scheduled reconciliation
- never OCR, embed, synthesize, or draft responses inline

Microsoft Graph webhook handlers are wakeups, not the source of truth. Delta sync and reconciliation remain authoritative for what changed.

## When Cron Jobs Are Used

Use cron jobs for:

- scheduled reconciliation after webhook wakeups
- sources without reliable webhook support
- stale delta-token repair
- missed notification recovery
- bounded queue draining
- health checks and alerting
- batch financial/accounting sync

Cron jobs must be idempotent, source-scoped, bounded, logged, and safe to rerun.

## Webhook Failure Fallback

If a webhook fails, expires, or misses events:

1. Subscription reconciliation renews or recreates the subscription.
2. Scheduled sync reads provider delta state or timestamp windows.
3. The source sync ledger records missed, failed, and recovered runs.
4. Stale-source health checks alert when no successful run occurs within the required window.
5. Reconciliation reuses the same dedupe keys and pipeline queues, so replay does not duplicate records.

## Source Pipelines

### Outlook Email

Final entry points:

- Microsoft Graph change notifications for supported mail folders.
- Scheduled Graph delta reconciliation for each configured mailbox.
- Manual admin re-drive only through the same Graph sync service.

Primary processing:

1. Graph notification marks the mailbox/folder pending.
2. Delta sync fetches new or changed messages.
3. Noise and relevance filters run.
4. Raw non-noise messages write to `outlook_email_intake`.
5. Relevant AI-ready messages write to `rag_document_metadata` in the AI/RAG database.
6. Product-visible/project-matched records project to PM App tables where needed.
7. Attachments write to `outlook_email_intake_attachments`, then become document records when eligible.
8. Eligible email bodies and attachment text are chunked and embedded into `document_chunks`.
9. Source operating records feed task extraction and Project Intelligence.

Key tables:

- AI/RAG: `outlook_email_intake`, `outlook_email_intake_attachments`, `rag_document_metadata`, `document_chunks`, `graph_sync_state`, `source_sync_runs`, `source_processing_jobs`, `pipeline_model_usage`
- PM App: `document_metadata` bridge rows where product UI needs them, `project_emails`, `tasks`, `insight_card_evidence`, `intelligence_packets`

Product projection rules:

- `outlook_email_intake` is the production source for synced Outlook messages and current Outlook inbox/project views.
- `project_emails` is allowed only for app-authored/composed email workflow rows, drafts, and explicit product projections with source keys.
- Project email views must read live Outlook rows from `outlook_email_intake` for `source=outlook` and combine app-composed rows with Outlook intake rows for `source=all`.
- Old edit, delete, summarize, and task endpoints scoped to `project_emails` must not mutate live Outlook intake rows.
- Attachment state for Outlook rows must come from `outlook_email_intake_attachments`; PM App attachment joins are valid only for PM App email records.

Embedding eligibility:

- non-noise
- relevant or explicitly retained for source lookup
- has stable `source_item_id` or message id
- has text after body extraction or attachment parsing
- not already embedded with the same content hash
- not parked after max retry attempts

Duplicate prevention:

- Microsoft Graph message id
- mailbox plus message id
- attachment id/content hash
- source-system/source-item id
- document content hash
- idempotent upsert keys

### Microsoft Teams Messages

Final entry points:

- Microsoft Graph webhook/change notification where supported.
- Scheduled Teams channel sync.
- Scheduled Teams direct-message reconciliation where webhook support is limited.

Primary processing:

1. Webhook or cron identifies changed teams/channels/chats.
2. Sync fetches messages and groups direct messages into conversation artifacts.
3. Messages write to `rag_document_metadata` with source type "teams_channel" or "teams_dm".
4. Candidate project assignment runs from channel, participant, project keyword, path, and content signals.
5. Low-confidence matches write to `document_attribution_candidates`.
6. Eligible records embed into `document_chunks`.
7. Teams compiler/source operating record generation extracts tasks, decisions, risks, and Project Intelligence evidence.

Key tables:

- AI/RAG: `rag_document_metadata`, `document_chunks`, `graph_sync_state`, `source_sync_runs`, `document_attribution_candidates`, `source_intelligence_jobs`, `source_processing_jobs`
- PM App: `tasks`, `insight_card_evidence`, `intelligence_packet_cards`, `intelligence_packets`

Embedding eligibility:

- message/conversation has sufficient normalized text
- content is not duplicate/noise
- source type is supported
- source item has a durable Graph id or synthetic conversation id
- embedding attempts remain below the max retry count

### SharePoint Documents

Final entry points:

- Microsoft Graph change notifications for supported drives/sites.
- Scheduled SharePoint/drive reconciliation.
- Manual admin backfill only through the same ingestion service.

Primary processing:

1. Webhook marks a site/drive/folder pending.
2. Reconciliation enumerates changed files.
3. File metadata writes to `rag_document_metadata`.
4. Supported files are downloaded.
5. Text-native files extract text directly.
6. PDFs/images run OCR and image extraction.
7. AI vision runs where visual content contains drawings, tables, diagrams, figures, plans, manuals, invoices, submittals, or other construction-critical visual information.
8. Clean text and image/page intelligence are stored.
9. Eligible content is chunked and embedded into `document_chunks`.
10. Project assignment uses source path, folder/project mapping, file naming, content, Acumatica references, and review inbox fallback.

Key tables:

- AI/RAG: `rag_document_metadata`, `document_chunks`, `graph_sync_state`, `source_sync_runs`, `source_processing_jobs`, `pipeline_model_usage`
- PM App: `document_metadata` bridge rows where product workflows need a document catalog item, `document_page_intelligence`, `document_attribution_candidates`

Duplicate prevention:

- drive item id
- source path
- content hash
- version/eTag where available
- project/source/source-item unique keys

### Fireflies Meeting Transcripts

Final entry points:

- Fireflies webhook when available.
- Scheduled polling fallback.
- Manual re-drive only through the same Fireflies ingestion pipeline.

Primary processing:

1. Webhook or polling discovers new transcript ids.
2. Transcript, notes, participants, timestamps, links, and source metadata are fetched.
3. Canonical transcript artifact is stored.
4. Metadata writes to PM App `document_metadata` and AI/RAG `rag_document_metadata` through the canonical bridge.
5. Project assignment runs from title, participants, linked project terms, transcript content, and known account context.
6. Transcript chunks embed into `document_chunks`.
7. Task extraction creates deduplicated tasks where action language and owner context are present.
8. Project Intelligence evidence is generated with full-source read proof.

Key tables:

- PM App: `document_metadata`, `fireflies_ingestion_jobs`, `tasks`, `insight_card_evidence`, `intelligence_packets`
- AI/RAG: `rag_document_metadata`, `document_chunks`, `fireflies_ingestion_jobs`, `source_intelligence_jobs`

Embedding eligibility:

- transcript exists or meeting is explicitly marked summary-only/intentionally excluded
- not an excluded meeting class, such as interview-title exclusions
- transcript has enough text to chunk
- content hash has changed or no embedded chunks exist
- prior attempts are below retry cap

### Uploaded PDFs and Documents

Final entry points:

- Event-based upload trigger from the application.
- Upload routes must create the canonical document metadata row immediately.

Primary processing:

1. Upload writes file to storage.
2. Upload route creates `document_metadata` with source system, project id where known, storage URL/path, file metadata, and `status='no_text'` or the equivalent processing-ready state.
3. OCR worker picks up eligible files.
4. Text extraction, OCR, image extraction, and page segmentation run.
5. AI vision runs for visual-heavy construction content.
6. Extracted text, page intelligence, visual descriptions, tables/figures/drawing metadata, and extraction confidence are stored.
7. Clean searchable text writes to the AI/RAG document metadata record.
8. Chunks and embeddings write to `document_chunks`.
9. Product workflows such as drawings, specifications, submittals, RFIs, invoices, contracts, and manuals link to the canonical document metadata row.

Key tables:

- PM App: `document_metadata`, `document_page_intelligence`, `drawing_revisions`, `drawings`, `submittal_documents`, `submittal_doc_links`, `specification_sections`
- AI/RAG: `rag_document_metadata`, `document_chunks`, `source_processing_jobs`, `pipeline_model_usage`

OCR eligibility:

- file type is PDF, image, scanned document, drawing, plan, invoice, contract, manual, submittal, RFI attachment, or another supported document class
- text is missing, incomplete, stale, or below confidence threshold
- document status is `no_text`, `raw_ingested`, `ocr_partial`, or explicit reprocess state
- file can be downloaded from storage or provider URL

AI vision eligibility:

- document is a drawing, plan, diagram-heavy PDF, scanned visual, table/figure-heavy document, invoice image, submittal with images, manual/spec with figures, or low-text PDF where visual content carries meaning
- OCR confidence is low or visual page classification indicates construction-relevant layout, marks, schedules, tables, or drawings
- file size/page limits are within configured bounds or a page-capped partial result is acceptable and marked as such

### Acumatica

Final entry points:

- Scheduled cron twice daily.
- Manual admin re-drive only through the same sync service.

Primary processing:

1. Cron logs in to Acumatica.
2. Supported entities sync with per-entity success/failure state.
3. Rows upsert into PM App accounting/financial tables.
4. Sync state writes to `acumatica_sync_state`.
5. Run ledger writes to `acumatica_sync_runs`.
6. Duplicate imports are prevented by source ids, reference numbers, document types, project codes, and entity-specific unique keys.
7. Failures retry on the next scheduled run and surface through sync health verification.

Key tables:

- PM App: `acumatica_sync_state`, `acumatica_sync_runs`, `acumatica_ap_bills`, `acumatica_ar_invoices`, `acumatica_payments`, project/contract/accounting projection tables

## Shared Post-Ingestion Pipeline

Every supported source follows the same production stages after intake:

1. Normalize source metadata.
2. Persist raw/source ledger state.
3. Resolve or create canonical document metadata.
4. Deduplicate by source id and content hash.
5. Extract text.
6. Run OCR when eligible.
7. Extract images/pages/tables/figures when eligible.
8. Run AI vision when eligible.
9. Assign project or create review candidate.
10. Generate clean searchable text.
11. Chunk deterministically.
12. Embed with `text-embedding-3-large` at 3072 dimensions unless a future migration explicitly changes both model and schema.
13. Store chunks in `document_chunks`.
14. Generate source operating records.
15. Generate deduplicated tasks where appropriate.
16. Update Project Intelligence evidence/packets.
17. Validate through source lifecycle health and retrieval checks.

## Vector Storage

Vector records are stored in AI/RAG `document_chunks`.

Required fields:

- `document_id`
- `chunk_id`
- `chunk_index`
- `text`
- `embedding`
- `source_type`
- `metadata`
- `content_hash`

Chunk text must be clean enough for retrieval and citation. Chunk metadata must preserve enough source context to produce citations and links without joining through stale product tables.

RAG document-level state is stored in AI/RAG `rag_document_metadata`.

Required state:

- source system and source type
- source item id
- project id or assignment status
- processing status
- embedding status
- embedding attempts
- embedding error
- last attempt timestamp
- source URL/storage URL when available
- content hash
- timestamps needed for freshness checks

## Project Assignment

Project assignment runs for every source item.

Deterministic signals:

- explicit project id from upload route or product workflow
- source folder/path mapped to a project
- Acumatica project id or job number
- exact project number/name in source metadata
- known email/project workspace relation
- drawing/submittal/spec/RFI/contract parent record

Probabilistic signals:

- title and subject
- participants
- source body
- attachment filename
- Teams channel or chat context
- SharePoint path fragments
- client/vendor/company references

Assignment outcomes:

- assigned: high-confidence project id written
- review required: candidate written to `document_attribution_candidates` with confidence and evidence
- intentionally unassigned: source is company-level or non-project and marked explicitly
- excluded: policy exclusion, such as non-operational noise or configured interview exclusions

Silent null project assignment is not allowed for eligible operational sources.

## Task Creation

Tasks are generated from:

- Fireflies transcripts
- Outlook emails
- Teams conversations
- document analysis
- AI extraction over source operating records

Task creation requirements:

- source-backed title and description
- project id when project-specific
- owner when determinable
- due date when source-backed or inferable under approved rules
- source document id/source item id
- dedupe key derived from source id, normalized task text, project, owner, and due date
- extraction status recorded even when no actionable tasks exist

No-action outcomes must be explicit, not silent.

## AI Assistant Consumption

All assistants must use the finalized retrieval/tool architecture.

Required consumers:

- main AI assistant chat route
- source-specific RAG retrieval
- project briefing/advisor mode
- Microsoft Executive Assistant specialist
- App Expert where product/source docs are needed
- Executive Daily Brief and Project Intelligence synthesis
- domain packet compiler and project synthesis
- document-intelligence/submittal/drawing review tools
- Acumatica/financial tools

Assistant rules:

- project-status and strategic questions use packet-first Project Intelligence, then source lookup when packet coverage is thin, stale, challenged, or exact evidence is requested
- source questions use source-specific retrieval before generic vector search
- financial questions use structured financial tools before vector text
- degraded retrieval must be surfaced as degraded, not as no evidence
- citations/reference links are required where source-backed claims are made

AI SDK MCP tool contract:

- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` is the live AI assistant stream path.
- `frontend/src/lib/ai/tools/mcp-tools.ts` is the only production MCP discovery helper for the assistant.
- `@ai-sdk/mcp` is used through `createMCPClient`; MCP tools are discovered per request, policy-filtered, prefixed by server, and merged into the `streamText` Strategist toolset.
- Discovery success and failure records are appended to `chat_history.metadata.tool_trace` so MCP availability is visible to health, eval, and debugging workflows.
- MCP clients are closed on stream finish and stream error.
- Generic MCP servers default to read-only tool names; explicitly allowlisted servers such as Excalidraw may expose approved write-like diagram checkpoint/export tools.

## Queues and Ledgers

Production queues and ledgers:

- `source_sync_runs`: source run outcomes
- `graph_sync_state`: Microsoft delta/subscription state
- `source_processing_jobs`: document processing and stage work
- `source_intelligence_jobs`: source operating record/intelligence extraction state
- `fireflies_ingestion_jobs`: Fireflies transcript ingestion state
- `document_attribution_candidates`: manual project assignment review inbox
- `pipeline_model_usage`: model call usage and provider path tracking
- `system_alerts` or source health alert tables where configured

Every queue item must have a terminal successful, intentionally skipped, excluded, failed, or review-required state.

## Retries, Logs, and Alerts

Retries:

- provider auth/credit failures fail over between AI Gateway and direct OpenAI where both are configured
- transient database/provider failures retry with bounded attempts
- embedding failures persist `embedding_status='error'`, error text, attempt count, and last attempt timestamp
- poison-pill records park after max attempts and surface as failures
- scheduled reconciliation re-drives missed webhook events

Logs:

- source sync run result
- document processing stage result
- OCR/vision result and confidence
- embedding provider path and failure reason
- task extraction status
- project assignment confidence and evidence
- assistant retrieval path and degraded-search flags

Alerts:

- stale source sync
- burst of embedding errors
- completion lag by source
- provider auth/credit outage
- source promotion freeze
- RAG search backend degradation
- Acumatica stale or failed entities
- webhook/subscription expiry or renewal failure

## Duplicate Prevention

Every source must define a stable dedupe key:

| Source | Dedupe key |
| --- | --- |
| Outlook Email | mailbox plus Graph message id |
| Outlook Attachment | message id plus attachment id plus content hash |
| Teams Channel | team/channel/message id |
| Teams DM | chat id plus message id, grouped into stable conversation id |
| SharePoint | drive item id plus version/eTag plus content hash |
| Fireflies | Fireflies transcript id plus canonical storage path/content hash |
| Uploads | storage path plus content hash plus product parent record |
| Acumatica | entity type plus reference number/document type/project code |

Duplicate prevention must happen before embedding and before task creation.

## Validation

A pipeline is production-ready only when validation proves:

- source sync executed
- source record persisted
- text/OCR/vision ran when eligible
- RAG metadata exists
- chunks exist
- embeddings exist
- project assignment is assigned, review-required, intentionally unassigned, or excluded
- task extraction status exists
- generated tasks are deduplicated
- retrieval returns the expected document through RAG
- assistant response uses the finalized retrieval path
- citations/reference links resolve
- failure and retry paths are exercised or covered by targeted verifier
- alerting detects stale, failed, and lagging conditions

Required verifier families:

- source lifecycle health
- meeting vectorization health
- Graph embedding contract
- source-specific RAG contract
- chat architecture contract
- chunk integrity
- assistant operational readiness
- Acumatica sync health
- browser proof for operator dashboards when UI is part of the workflow

Operational freshness windows:

- Fireflies ingestion/vectorization failures are active production-readiness blockers only when they affect records from the last two months, or when they affect the recent meeting coverage window enforced by `npm run rag:verify:meetings`.
- Outlook email and Microsoft Teams backlog failures are active production-readiness blockers only when they affect records from the last one week. Older Outlook/Teams messages may remain archived for audit/search history, but they are not blockers for current assistant usefulness unless a user asks for historical reconstruction.
- These windows do not weaken automatic sync requirements for new data: current webhook/cron sync, embedding, project assignment, task generation, and RAG retrieval must still fail loudly.

## Legacy Implementations To Remove Or Decommission

These implementation classes do not belong in the final architecture:

- frontend/Vercel source-sync crons that duplicate Render backend ownership for Graph sync, Graph embed, or Acumatica sync
- retired Cloudflare/worker Fireflies ingestion paths
- APScheduler background source sync inside the Render web service
- route-local embedding implementations that bypass shared AI transport, retry, and failure recording
- direct assistant Outlook/Teams source readers that bypass the Microsoft Executive Assistant specialist or source-specific RAG contract
- PM App copies of RAG-owned tables used as active retrieval stores
- stale packet refresh queues superseded by current source operating record and Project Intelligence compilers
- archived docs or migrated code paths that are still importable/runnable as production alternatives
- feature flags that hide unfinished or duplicate production paths instead of selecting one complete implementation
- mock, placeholder, demo, or experimental ingestion/retrieval paths inside production source trees

Removal rule: delete only after imports, route references, provider schedules, database writes, and verifier output prove the path is not the production owner. If a path contains useful behavior, migrate it into the canonical service first, prove parity, then delete the old path.

## Production Readiness Contract

No AI data pipeline or assistant workflow is complete until:

- it runs automatically by the trigger strategy above
- it has end-to-end proof from source to retrieval
- failures are visible and retriable
- dependent assistants consume the finalized data path
- duplicate and legacy implementations are removed
- evidence is recorded in the task/handoff ledger

This document is the comparison target for the finalization program. Current code must be audited against it, then migrated or deleted until only this production architecture remains.
