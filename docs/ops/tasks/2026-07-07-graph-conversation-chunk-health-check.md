# Graph Conversation Chunk Health Check

Status: Complete
Owner: Codex
Linear: AAI-991
Linear URL: https://linear.app/megankharrison/issue/AAI-991/add-health-check-for-graph-owned-conversation-chunk-source-types
Started: 2026-07-07

## Objective

Add a fail-loud production verifier for Microsoft Graph-owned Outlook and Teams conversation documents so source sync cannot look healthy while downstream RAG chunks are silently overwritten by generic chunk source types.

## Scope

- Inspect existing Graph/RAG verifier patterns before adding a new check.
- Add a targeted live RAG DB verifier for Graph-owned conversation chunk ownership.
- Fail when Outlook conversation docs have non-email chunks.
- Fail when Teams DM/channel conversation docs have non-Teams chunks.
- Warn, but do not block, on missing chunks unless strict mode is requested.
- Run the verifier against the live RAG database.
- Push the task-owned work to `main` without staging unrelated dirty files.

## Out Of Scope

- Replacing Graph webhook/delta sync architecture.
- New migrations or schema changes.
- Broad eval suite runs.
- Unrelated dirty checkout files.

## Checklist

- [x] Existing Graph/RAG verification scripts inspected.
- [x] Live Graph conversation chunk verifier implemented.
- [x] Architecture docs updated with the new guardrail.
- [x] Targeted verifier passes against live RAG DB.
- [x] Evidence section filled with command output summaries.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Existing verifier gap:
  - `scripts/verify/verify_graph_embedding_contract.mjs` validates Graph embedding source code and SQL repair contracts.
  - `scripts/verify/verify_teams_conversation_ingestion_contract.mjs` validates Teams ingestion source code.
  - Neither script reads live `rag_document_metadata` + `document_chunks` rows to detect production source-type drift after deployment.
- Implemented:
  - `scripts/verify/verify_graph_conversation_chunk_ownership.mjs` reads the live RAG DB via `RAG_DATABASE_URL`.
  - It fails when Graph-owned Outlook conversation docs have chunks other than `email`.
  - It fails when Graph-owned Teams DM docs have chunks other than `teams_dm`.
  - It fails when Graph-owned Teams channel docs have chunks outside `teams_channel` / legacy-compatible `teams_message`.
  - It supports `--strict-missing-chunks` for failing falsely embedded docs that have no chunks.
- Initial live verifier result:
  - Failed on 7 old Teams DM conversation docs with generic `document`, `meeting_summary`, and `meeting_segment_summary` chunks.
  - Also warned on 7 old Teams DM conversation docs marked `embedded` with no chunks.
- Scoped production repair:
  - Deleted 29 corrupted generic chunks across the 7 failed Teams DM conversation docs.
  - Reset those 7 docs to `rag_document_metadata.embedding_status=NULL`.
  - Ran `embed_pending_graph_documents(get_supabase_client(), limit=25)`: `embedded=2`, `skipped=5`, `total_chunks=2`, `errors=0`.
  - Reset the 7 falsely embedded no-chunk Teams DM docs.
  - Ran `embed_pending_graph_documents(get_supabase_client(), limit=25)`: `embedded=0`, `skipped=7`, `total_chunks=0`, `errors=0`.
- Final live verifier result:
  - `node scripts/verify/verify_graph_conversation_chunk_ownership.mjs`: PASS.
  - `node scripts/verify/verify_graph_conversation_chunk_ownership.mjs --strict-missing-chunks`: PASS.
  - Final summary: Outlook `10` docs / `89` chunks / source types `email`; Teams channel `13` docs / `34` chunks / source types `teams_channel`; Teams DM `28,390` docs / `35,877` chunks / source types `teams_dm`; embedded docs without chunks `0`.
- Static contract checks:
  - `node scripts/verify/verify_graph_embedding_contract.mjs`: PASS.
  - `node scripts/verify/verify_teams_conversation_ingestion_contract.mjs`: PASS.

## Notes

- `package.json` has unrelated dirty changes in this checkout, so this slice did not edit npm scripts. Run the verifier directly with `node scripts/verify/verify_graph_conversation_chunk_ownership.mjs`.
