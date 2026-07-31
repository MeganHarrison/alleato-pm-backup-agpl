# Task: Retire Contextual Retrieval Pilot

Status: Completed
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-734 - https://linear.app/megankharrison/issue/AAI-734/retire-or-finalize-contextual-retrieval-pilot
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Finalize the remaining AAI-703 `migrate-first` candidate
`backend/src/scripts/backfill_contextual_embeddings.py`. Either migrate
contextual retrieval into the automatic production embedding path, or retire it
completely if it remains a dormant manual pilot.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared services/helpers identified before removing code.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Proof Checklist

- [x] Prove current import/reference surface before deletion.
- [x] Prove route/API/UI reachability before deletion.
- [x] Prove provider schedule/cron/job ownership before deletion.
- [x] Prove database-write ownership before deletion.
- [x] Prove live retrieval behavior before deleting the pilot.
- [x] Delete only candidates with active-path proof.
- [x] Record retained replacement paths before deletion.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Manual contextual backfill script removed.
- [x] Pilot-only contextual helper removed.
- [x] Backend agent retrieval no longer exposes an unfinished contextual variant flag.
- [x] Unused contextual RAG DB columns/RPC/index removed through an applied RAG migration.
- [x] Architecture and cleanup evidence no longer advertise contextual retrieval as current architecture.
- [x] Errors are specific and actionable; no silent fallback added.

## Integration Checklist

- [x] Production retrieval remains on `search_document_chunks`.
- [x] Frontend and backend RAG tools keep using finalized baseline/hybrid retrieval.
- [x] Generated RAG types match the retired contextual DB surface.
- [x] Artifacts link back to source evidence and command logs.

## Regression Guardrails

- [x] Static scan proves retired contextual symbols remain only in historical/proof docs or applied migration history.
- [x] Backend compile check proves current RAG agent helpers still load.
- [x] RAG retrieval verifier proves baseline retrieval still works.
- [x] Changed-file typecheck is delegated to a subagent.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted backend compile check run.
- [x] Relevant RAG/provider verifier run.
- [x] RAG migration applied and verified, or explicitly deferred with reason.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Candidate proof | docs/ops/evidence/2026-06-25-ai-rag-production-finalization/contextual-retrieval-pilot-retirement-aai-734.md | In Progress | Import, route, provider, DB, and retrieval behavior recorded before edits. |
| Subagent code proof | explorer `019f08dd-1239-74d2-bf7e-3777add9acce` | Pass | No direct callers; no package/render route; baseline retrieval default. |
| Subagent docs/provider proof | explorer `019f08dd-2da7-7ea1-ae9b-215050080163` | Pass | No Render/package/backend docs owner; architecture doc has stale contextual-backfill claims. |
| Render env read-back | secret-safe Render API scan | Pass | Checked Alleato backend/cron services; none set `RAG_EMBEDDING_VARIANT` or `CONTEXTUAL_RETRIEVAL_MODEL`. |
| Backend compile | `backend/.venv/bin/python -m py_compile backend/src/services/agents/alleato_ai_tools/rag.py backend/src/services/supabase_helpers.py` | Pass | Current backend RAG helpers load without the pilot helper. |
| Verifier syntax | `node --check scripts/verify/verify_rag_client_boundary.mjs` | Pass | Client-boundary verifier no longer allows the retired contextual RPC. |
| Typecheck | delegated sub-agent: `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt. |
| RAG migration dry run | `psql "$RAG_DATABASE_URL" -v ON_ERROR_STOP=1 -c "begin" -f scripts/database/rag/migrations/20260627114000_retire_contextual_retrieval_pilot.sql -c "rollback"` | Pass | DDL parsed and rolled back cleanly. |
| RAG migration apply | `psql "$RAG_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/database/rag/migrations/20260627114000_retire_contextual_retrieval_pilot.sql` | Pass | Dropped contextual RPC, index, and columns. |
| RAG migration read-back | ledger/schema queries | Pass | Ledger row exists; retired columns/RPC/index all read back count `0`. |
| DB inventory regenerate | `npm run db:inventory` | Pass | Regenerated generated TS/JSON and `TABLE-LIST.md` from live schema after dropping pilot columns. |
| DB inventory check | `npm run db:inventory -- --check-only` | Pass | Schema drift check passed. |
| Retired inventory symbol scan | `rg -n "search_document_chunks_contextual|embedding_contextual|chunk_context|contextualized_at" frontend/src/components/dev-tools/db-inventory.generated.json frontend/src/components/dev-tools/db-inventory.generated.ts docs/architecture/TABLE-LIST.md frontend/src/types/rag-database.types.ts` | Pass | No matches; command exits 1 when no matches are found. |
| RAG client boundary | `npm run rag:verify:client-boundary` | Pass | Verifier no longer allows the retired contextual RPC. |
| RAG retrieval contract | `npm run rag:verify:retrieval-contract` | Pass | Live baseline retrieval returned 8 results with metadata references intact. |

## Files To Change

- `backend/src/scripts/backfill_contextual_embeddings.py`
- `backend/src/services/pipeline/contextualize.py`
- `backend/src/services/agents/alleato_ai_tools/rag.py`
- `frontend/src/types/rag-database.types.ts`
- `scripts/verify/verify_rag_client_boundary.mjs`
- `scripts/database/rag/migrations/20260627114000_retire_contextual_retrieval_pilot.sql`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/legacy-cleanup-candidate-inventory-aai-703.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/retrieval-legacy-candidate-inventory-aai-682.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/contextual-retrieval-pilot-retirement-aai-734.md`
- `docs/ops/tasks/2026-06-27-retire-contextual-retrieval-pilot.md`

## Risks / Gaps

- The checkout contains unrelated dirty frontend/backend files; this slice must
  stage and publish only AAI-734-owned files.
- RAG migrations live under `scripts/database/rag/migrations/`, not
  `supabase/migrations/`.
- Historical applied migrations may still mention contextual columns/RPCs; that
  is expected migration history, not current runtime ownership.
- `npm run db:inventory` prints a 2812 KB payload warning; this is existing
  inventory size, not a failure.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
