# Teams Conversation RAG Sync

Status: Complete
Owner: Codex
Linear: AAI-990
Linear URL: https://linear.app/megankharrison/issue/AAI-990/make-teams-conversation-sync-rag-safe-by-conversationday
Started: 2026-07-07

## Objective

Make Teams ingestion reliable for RAG by preserving raw Graph sync semantics while compiling searchable conversation-level documents for Teams DMs and channel threads.

## Scope

- Verify the existing Teams channel and DM ingestion contracts before changing code.
- Keep DMs grouped by `chat_id + day`.
- Keep channel conversations grouped by root message/thread.
- Ensure generated RAG documents are idempotent and safe for embedding/replay.
- Add fail-loud guardrails where generic downstream processing could corrupt Teams chunks.
- Prove the path with targeted tests and bounded live readback, or record the exact external blocker.

## Out Of Scope

- Replacing Microsoft Graph subscriptions or delta architecture.
- Broad UI work.
- Unrelated dirty checkout files.

## Checklist

- [x] Existing Teams source sync behavior inspected and summarized.
- [x] Teams DM daily conversation document behavior verified or repaired.
- [x] Teams channel thread document behavior verified or repaired.
- [x] Embedding ownership guardrail verified for Teams conversation documents.
- [x] Targeted unit tests added or updated.
- [x] Targeted tests pass.
- [x] Bounded live Teams sync/readback attempted against production RAG DB.
- [x] Evidence section filled with command output summaries and DB proof.
- [x] Blockers, if any, include cause, detection gap, prevention step, owner, and next action.

## Evidence

- Existing behavior:
  - Teams DMs already group into daily docs using `teamsdm_<chat_hash>_<YYYY-MM-DD>`.
  - Teams channel messages already group by root message/thread using `teams_<root_message_id>`.
  - Teams-only cron entrypoints currently run source sync with `run_embedding=False`; embedding is owned by the Graph embedder path.
- Live RAG DB readback before fix:
  - Latest Teams DM cron row: `teams_chat_export`, `user:acannon@alleatogroup.com`, `2026-07-07T05:40:25Z`, status `succeeded`, `items_synced=0`.
  - Latest channel rows: `teams_message`, hourly rows at `2026-07-07T05:10Z`, status `succeeded`, `items_synced=0`.
  - Recent Teams docs summary: 40 docs checked, 29 embedded, 11 skipped, 29 with chunks.
  - Several `teams_dm_conversation` rows had corrupted chunk ownership: chunk `source_type` values were `document`, `meeting_summary`, and `meeting_segment_summary` instead of `teams_dm`; some rows also had missing RAG content.
- Root cause:
  - The generic document embedder only skipped Outlook conversation docs. It could reprocess Microsoft Graph Teams conversation docs and overwrite Graph-owned Teams chunks with generic Fireflies/document chunk types.
- Fix:
  - `backend/src/services/pipeline/embedder.py` now skips Microsoft Graph conversation docs owned by the Graph embedder across Outlook, Teams DM conversations, Teams messages, and Teams DM types.
  - `backend/src/services/integrations/microsoft_graph/teams.py` now writes replay metadata for Teams docs: `source_system`, `storage_bucket`, `storage_path`, and `source_metadata.document_kind`.
  - Teams conversation upserts now explicitly reset `rag_document_metadata.embedding_status` to `NULL` after content changes so the Graph embedder repairs/re-embeds them instead of leaving stale chunks.
- Targeted tests:
  - `PYTHONPATH=backend python3 -m pytest backend/tests/test_document_low_content_pipeline.py backend/tests/test_microsoft_graph_teams_dm_export.py backend/tests/test_graph_sync_options.py -q`
  - Result: `17 passed, 10 warnings`.
- Bounded production verification:
  - Render Teams DM job `job-d9697apo3t8c73b064hg`: succeeded, `2026-07-07T05:50:35Z` to `2026-07-07T05:51:05Z`.
  - Render Teams channel job `job-d9697b28qa3s738jdurg`: succeeded, `2026-07-07T05:50:36Z` to `2026-07-07T05:51:20Z`.
  - Bounded local production backfill for `acannon@alleatogroup.com` since `2026-07-06T00:00:00Z`: `teams_dm_synced=15`, `embed.embedded=6`, `embed.total_chunks=6`, `embed.errors=0`, `by_category.teams_message=6`.
  - Scoped repair for known stale bad Teams docs: reset 3 doc IDs, Graph embedder returned `skipped=3`, `total_chunks=0`, `errors=0`.
  - Final RAG DB readback for repaired docs: all 3 have `type=teams_dm_conversation`, `documentKind=teams_dm_conversation`, `embedding_status=skipped`, `storage_path` populated, content present, and `document_chunks` count `0`.
- Detection gap:
  - Source sync rows were green while RAG chunks were corrupted downstream. The sync health surface did not distinguish Graph-owned Teams chunks from generic document chunks.
- Prevention:
  - Generic embedder ownership guard now fails safe by skipping Graph-owned conversation docs before hydration, chunk deletion, or embedding.
  - Tests assert Teams DM and channel docs persist replay metadata and Teams DM docs cannot be handled by the generic embedder.
  - Teams changed-document upserts reset RAG embedding status so Graph embedding is forced to repair stale chunks.

## Notes

- Outlook RAG path was proven first: Render job `job-d968v2mq1p3s73bn4dk0` succeeded on deployed commit `9f55c464`, source reconciliation and downstream enrichment succeeded, and RAG readback found embedded Outlook conversation documents.
- Teams production cron services are separate from the main Graph cron in `render.yaml`, so Teams verification must inspect those services directly.
- Known corrupted Teams docs found in this slice were repaired or converted to low-content skipped state. New Teams docs preserve storage paths so future repair/replay has a source pointer.
