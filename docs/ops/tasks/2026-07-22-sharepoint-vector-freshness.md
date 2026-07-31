# Task: Fail Closed on SharePoint Vectorization Gaps

Status: Complete
Owner: Codex SROOT-SP-VECTOR
Created: 2026-07-22
Task ID: LOCAL-2026-07-22-SHAREPOINT-VECTOR-FRESHNESS
Linear Issue: Not required; single-session High-risk incident repair
Related Handoff: N/A; single-session isolated workspace

## Objective

Make SharePoint vectorization current, observable, and fail-closed so a Microsoft Graph sync cannot report success while eligible SharePoint files have no embedded chunks.

## Scope

- Microsoft Graph downstream embedding result propagation and cron exit behavior.
- Live Render provider configuration, vector replay, and RAG health monitoring.
- Explicit exclusion: document parsing, SharePoint project attribution, and Daily Brief presentation.

## Source of Truth

- Canonical runtime/data owner: `backend/src/services/integrations/microsoft_graph/sync.py`, PM APP `document_metadata`, and AI Database `rag_document_metadata` plus `document_chunks`.
- Existing shared primitives/services: `embed_pending_graph_documents`, `source_rag_health`, and `backend/scripts/run_graph_sync.py`.
- Deprecated or parallel paths: legacy suspended Render jobs from `MeganHarrison/alleato-pm` are not modified.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Every eligible SharePoint proposal/estimate row has at least one non-null 3,072-dimensional embedding in `document_chunks`.
- [x] A nonzero Graph embedding error count makes downstream sync status fail and causes the cron process to exit nonzero.
- [x] Production uses the verified AI Gateway credential and the canonical RAG health monitor is active.
- [x] Live database reconciliation proves zero eligible SharePoint proposal/estimate vector gaps.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: provider error count and provider response persisted on the affected RAG metadata row.
- Detection path: nonzero `alleato-graph-sync` exit, failed `source_sync_runs` vectorization receipt, and active `alleato-source-rag-health` monitoring.
- Recovery path: restore a healthy provider route, replay pending Graph embeddings, and reconcile PM APP document IDs against AI Database chunks.

## Incident Learning

- Failure fingerprint: `intelligence.daily-brief-premature-success`
- Root cause: SharePoint ingestion persisted source text, but both production embedding providers were unavailable; the Graph orchestrator ignored a returned nonzero embedding error count.
- Detection gap: the cron returned zero when source sync wrote any rows, even if every vectorization attempt failed, and the dedicated RAG health cron was suspended.
- Prevention: propagate returned embedding failures into the orchestration error ledger, exit nonzero on any orchestration error, keep RAG health active, and reconcile source IDs to embedded chunks.
- Guardrail evidence: focused unit tests plus production provider, scheduler, and database readbacks.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Initial database reconciliation | PM APP `document_metadata` vs AI Database `document_chunks` | Failed as expected | 18 proposal/estimate files had text but no vectors. |
| Provider receipt | AI Database `source_sync_runs` and `rag_document_metadata.embedding_error` | Failed as expected | 25/25 attempted Graph documents failed at 2026-07-22 18:22 UTC. |
| Provider configuration | Render individual env-var readback | Repaired | Canonical services now use the verified AI Gateway key and gateway-first routing. |
| SharePoint folder configuration | Connector validation plus Render env-var readback | Repaired | Replaced two invalid paths with three verified Port/Union proposal and estimate folders; configured max is 3. |
| Health monitor | Render service and deployment readback | Repaired | `alleato-source-rag-health` resumed, repointed from the retired repository to `The-Alleato-Group/project-management`, restored to every five minutes, and deployed live as `dep-d9ghesrbc2fs7386u3ig`. |
| Production vector replay | `docs/ops/evidence/2026-07-22-sharepoint-vector-freshness/verification.md` | Pass | 18 documents, 32 chunks, zero errors. |
| Database reconciliation | `docs/ops/evidence/2026-07-22-sharepoint-vector-freshness/database-readback.json` | Pass | Timestamped SQL and matching sorted ID-set hashes prove 423/423 eligible SharePoint documents and 18/18 proposal/estimate documents vectorized. |
| Focused regression | `pytest ... -k 'graph_embedding_error_count or unfetchable_embedding_candidates or cron_exits'` | Pass | 4 passed. |
| Broader focused file | `pytest -q tests/test_graph_sync_options.py tests/test_run_graph_sync_script.py` | Pass | 19 passed, including primary and post-OCR unfetchable reconciliation. |
| Main publication | Remote-main publication receipt | Pass | Exact task files published at `c8a8a805bf62fa12826a717257ec0ba3119ceb72`. |
| Runtime deployment | Render deploy readback | Pass | `alleato-graph-sync` and `alleato-source-rag-health` reached `live` on `c8a8a805`; later live commit `6ce38e7b` contains it. |
| Corrected scheduled source run | Render run `crn-d827dut7vvec73b33fa0-1784749184` plus AI Database `source_sync_runs` | Pass for SharePoint | All three configured Port/Union proposal and estimate resources succeeded at 19:40:58-19:41:01 UTC with zero source errors and no new deltas. |

## Remaining Risk / Deferred Unrelated Work

- The same full Graph run failed loudly on an unrelated legacy Outlook cursor for `awehner@alleatogroup.com`. The Graph orchestrator reset only that scoped cursor to the empty recovery state. Owner: Outlook ingestion. Detection: nonzero `alleato-graph-sync` exit and persisted `graph_sync_state.error_message`. Prevention/next action: verify the next Outlook pass creates the canonical inbox/sent cursor pair; this does not invalidate the successful SharePoint resource receipts or 423/423 vector reconciliation.
- The source RAG health run currently surfaces existing Teams-staleness and retired-path alerts. Those alerts are now visible because the monitor is active; they are not SharePoint vector gaps.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
