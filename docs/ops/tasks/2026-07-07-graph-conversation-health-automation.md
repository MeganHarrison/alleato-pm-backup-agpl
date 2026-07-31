# Graph Conversation Health Automation

Status: Complete
Owner: Codex
Linear: AAI-992
Linear URL: https://linear.app/megankharrison/issue/AAI-992/wire-graph-conversation-chunk-ownership-into-scheduled-rag-health
Started: 2026-07-07

## Objective

Wire Graph-owned Outlook and Teams conversation chunk ownership into scheduled backend RAG/source health so production drift fails loudly without a manual verifier run.

## Scope

- Inspect existing scheduled source/RAG health implementation.
- Add backend health logic for Graph conversation chunk source-type drift.
- Surface any drift as source/RAG health alerts.
- Add targeted unit coverage.
- Verify live scheduled health logic remains clean after the production repair.
- Push task-owned work to `origin/main`.

## Out Of Scope

- Editing `package.json`, which currently has unrelated dirty work.
- New migrations or schema changes.
- Replacing Graph webhook/delta sync architecture.
- Broad eval suites.

## Checklist

- [x] Existing source/RAG health wiring inspected.
- [x] Graph conversation ownership check added to scheduled health path.
- [x] Targeted unit coverage added or updated.
- [x] Targeted tests pass.
- [x] Live health/check output verified after repair.
- [x] Evidence section filled with command summaries.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Existing scheduled path:
  - `render.yaml` runs `alleato-source-rag-health` with `python3 -m src.services.health.source_rag_health`.
  - `source_rag_health.py` already computes alerts and persists source sync health snapshots/alerts.
- Package script constraint:
  - `package.json` has unrelated dirty work, so this slice will not add an npm script alias.
- Implemented:
  - `backend/src/services/health/source_rag_health.py` now computes `graphConversationChunks` health from live RAG metadata/chunks.
  - It emits critical alerts for `graph_conversation_chunk_source_type_drift`.
  - It emits critical alerts for `graph_conversation_embedded_without_chunks`.
  - Skipped low-content Graph conversation docs without chunks are allowed and do not alert.
  - The health query does not select vector embeddings.
- Unit tests:
  - `PYTHONPATH=backend python3 -m pytest backend/tests/test_source_rag_health.py -q`
  - Result: `3 passed, 6 warnings`.
- Manual verifier:
  - `node scripts/verify/verify_graph_conversation_chunk_ownership.mjs --strict-missing-chunks`
  - Result: PASS.
- Live scheduled health function check:
  - `run_source_rag_health_check(trigger_remediation=False)` returned existing overall `status=degraded` because of unrelated lifecycle/backlog alerts.
  - New `graphConversationChunks.status=healthy`.
  - New `graphConversationChunks.alerts=[]`.
  - New section summary: Outlook `10` docs / `89` chunks / source types `email`; Teams DM recent sample `79` docs / `46` chunks / source types `teams_dm`; embedded docs without chunks `0`.
- Detection gap:
  - A manual verifier could pass once and still not protect the recurring cron path.
- Prevention:
  - Scheduled `alleato-source-rag-health` now computes the same ownership class and persists critical alerts if drift returns.

## Notes

- The manual verifier from AAI-991 remains useful for operator/local proof: `node scripts/verify/verify_graph_conversation_chunk_ownership.mjs --strict-missing-chunks`.
- Existing unrelated source/RAG lifecycle degradation remains outside this slice and should be handled separately.
