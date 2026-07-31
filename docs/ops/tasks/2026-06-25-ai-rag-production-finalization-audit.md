# AI/RAG Production Finalization Audit

Date: 2026-06-25
Session: S91
Linear: AAI-637
Parent: AAI-636
Status: In Progress

## Objective

Prove the current production architecture for the AI data pipeline and RAG system before implementation, deletion, or migration work proceeds.

The final program objective is a single production implementation for ingestion, OCR/vision, embedding, project assignment, task generation, vector retrieval, Acumatica sync, and assistant retrieval. This slice does not ship partial implementations. It establishes the source-of-truth map, current operational proof, blockers, and deletion/migration queue.

## Scope

- Fireflies meeting transcripts
- Outlook email
- Microsoft Teams messages
- SharePoint documents
- Uploaded PDFs and construction documents
- OCR and AI vision/page intelligence
- Embedding generation
- Vector search and RAG retrieval
- Project assignment
- Task generation
- Acumatica sync
- AI assistant retrieval/tool/prompt architecture
- Legacy, duplicate, archived, deprecated, or dead implementation candidates

## Done Checklist

- [x] Create Linear parent and active sub-issue.
- [x] Create task markdown before implementation.
- [x] Create session handoff path.
- [x] Claim S91 in `docs/ops/orchestration/session-board.md`.
- [x] Post Linear kickoff comment.
- [x] Create authoritative final production architecture document.
- [x] Run compact current-state verification for source lifecycle health.
- [x] Run compact current-state verification for meeting/vector health.
- [x] Run compact current-state verification for Graph embedding contract.
- [x] Run compact current-state verification for assistant RAG architecture/source-specific retrieval.
- [x] Record blockers with cause, detection gap, prevention step, owner files, and whether related to this finalization work.
- [x] Create follow-on Linear sub-issues for independently verifiable implementation/deletion slices.
- [x] Inventory active source-sync, OCR/vision, embedding, project-assignment, task-generation, RAG, assistant, and Acumatica code paths.
- [x] Identify currently scheduled automatic jobs from repo/provider manifests.
- [x] List deletion candidates only with proof required before removal.
- [x] Fill evidence section.

## Verification Plan

Short checks in the main thread:

- `git status --short`
- targeted source/path inventory using `rg`
- existing compact verifiers where they finish quickly

Longer checks to delegate when available:

- full eval suite
- full provider/tool matrix
- full source lifecycle crawl/backfill verification
- browser proof of `/rag` dashboard if it requires a running app session

## Evidence

- `/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/chat-architecture.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/graph-embedding.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/meetings.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/render-services.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-specific.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/current-path-inventory.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-specific-after-observability-fix.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-specific-rag-unit-after-observability-fix.txt`

## Blockers

### AAI-638: Source-Specific RAG Observability Contract Failure

- Command: `npm run rag:verify:source-specific`
- Status: Recovered for the verifier gate.
- Current evidence: after the AAI-638 fix, `npm run rag:verify:source-specific` passes and focused Jest coverage for `source-specific-rag.test.ts` passes.
- Cause: source-specific Teams retrieval already checked live Microsoft Graph and the indexed Supabase fallback, but the Teams synthesis evidence block did not include the explicit `Retrieved ${rows.length} Teams row(s)` coverage line required by the production observability contract.
- Detection gap: this was only caught by the contract verifier, not by the target architecture document itself.
- Prevention step: the canonical Teams source-specific evidence block now emits the Teams row count and indexed fallback source path, and Jest asserts both.
- Likely owner files: `frontend/src/lib/ai/retrieval/source-specific-rag.ts`, `frontend/src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts`, `scripts/verify/verify_ai_source_specific_rag_contract.mjs`.
- Related to current task: yes.

### AAI-639: Source Lifecycle Coverage Failure

- Command: `npm run rag:verify:source-lifecycle`
- Status: Recovered for the verifier gate.
- Current evidence: after AAI-640 and AAI-639 fixes, `npm run rag:verify:source-lifecycle` passes with no failures. Generated task project-assignment ratio is now `0.9167`, above the `0.9` threshold.
- Cause: the verifier treated auditable `project_assignment_review` lifecycle states as failed project assignment even though the final architecture allows ambiguous items to route to manual review. Generated task failures also included deterministic stale rows where the linked source document already had `document_metadata.project_id` but `tasks.project_id/project_ids` were missing.
- Detection gap: source-family assignment/review status can drift while sync and embedding appear healthy; task project linkage can lag source document project linkage.
- Prevention step: source lifecycle verifier now checks project disposition, not only direct assignment; existing project-assignment backfill now repairs deterministic task/source-document links.
- Likely owner files: `scripts/verify/verify_source_lifecycle_health.mjs`, `scripts/verify/source_lifecycle_project_applicability.mjs`, `scripts/verify/backfill_project_assignments_from_compiler_jobs.mjs`, `scripts/verify/verify_fireflies_task_integrity.py`.
- Related to current task: yes.

### AAI-640: Fireflies Error Backlog And Meeting Vectorization Gap

- Command: `npm run rag:verify:meetings`
- Status: Recent meeting vectorization recovered; historical backlog remains.
- Current evidence: initial verifier failed with `13227` Fireflies ingestion jobs in `error` and only `70/75` recent meetings with embedded chunks. After the canonical pipeline fix and bounded reprocessing, `npm run rag:verify:meetings` passes with `75/75` recent eligible meetings embedded.
- Cause: recent records were retryable `[Errno 35] Resource temporarily unavailable` rows, but canonical ingestion then failed after embeddings because optional PM app final projection guards raised `AppDbProjectionError` inside extractor/intelligence compiler. Historical backlog is dominated by `12211` manually paused rows from the 2026-05-13 DB overload incident.
- Detection gap: meeting chunks can be mostly healthy while recent meetings still miss semantic coverage and historical Fireflies job errors continue accumulating.
- Prevention step: keep final PM projection as a loud non-blocking projection status for ingestion/vectorization, group historical errors by cause, drain or classify recoverable jobs, and make recent meeting vectorization a required health gate.
- Likely owner files/tables: `backend/src/services/pipeline/extractor.py`, `backend/src/services/pipeline/orchestrator.py`, `backend/src/services/ingestion/fireflies_pipeline.py`, `scripts/verify/verify_meeting_vectorization_health.mjs`, `fireflies_ingestion_jobs`, `document_metadata`, `rag_document_metadata`, `document_chunks`.
- Related to current task: yes.

### AAI-641: AI SDK MCP Architecture Gap

- Command: `npm run rag:verify:chat-architecture`
- Status: Passed with warnings.
- Warning: live `/ai-assistant` has `@ai-sdk/mcp` installed but does not discover, merge, trace, and close AI SDK MCP tools.
- Cause: MCP dependency surface exists without a proven production implementation.
- Detection gap: chat architecture can pass while a package-installed-but-unused capability remains as a phantom architecture path.
- Prevention step: either implement MCP fully with AI SDK discovery/merge/trace/close or remove the unused dependency/config/docs surface.
- Likely owner files: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`, `frontend/src/lib/ai/tool-registry.ts`, package manifests, `scripts/verify/verify_ai_chat_architecture.mjs`.
- Related to current task: yes.

The checkout is dirty with many unrelated active edits, so this slice must isolate new documentation/evidence files and avoid touching implementation files until ownership is clear.

## Failure-Loud Guardrail

This task fails loudly if any source is reported as production-ready without current verification evidence, if any deletion candidate lacks proof that it is not active production code, or if any pipeline failure is summarized without cause, detection gap, and prevention step.
