# Task: Governed SharePoint Project Discovery And Vector Reconciliation

Status: In Progress
Owner: SROOT-SP-DISCOVERY-0724
Created: 2026-07-24
Task ID: LOCAL-20260724-SHAREPOINT-DISCOVERY-RECONCILIATION
Linear Issue: Not required for this single-session High-risk repair; the repository task and handoff are the controlling records.
Related Handoff: `docs/ops/handoffs/2026-07-24-SROOT-sharepoint-project-discovery-reconciliation.md`

## Objective

Replace the three-folder SharePoint allowlist with automatic governed discovery of project folders, re-ingest changed source files, and fail the scheduled health gate whenever the discovered-source, app-catalog, and RAG-vector chain is incomplete.

## Scope

- Discover year/job folders under the canonical Alleato SharePoint project root.
- Keep explicit folders as optional additive overrides, not the primary inventory.
- Bootstrap new project folders without starving already-incremental folders.
- Refresh existing documents when their SharePoint eTag changes.
- Assign project documents by the authoritative job number embedded in the SharePoint folder path.
- Report discovered, initialized, pending-bootstrap, failed, cataloged, vectorized, and excluded counts.
- Treat known non-text binary formats as governed exclusions and unknown/text-bearing unsupported formats as loud failures.
- Wire the production Graph cron and health cron to the governed policy.
- Excludes image understanding, CAD model understanding, and Microsoft Project parsing; these remain explicit non-vectorizable source classes until dedicated extractors exist.

## Source of Truth

- Canonical runtime/data owner: `backend/src/services/integrations/microsoft_graph/`
- Existing shared primitives/services: `GraphClient`, `SupabaseRagStore`, `graph_sync_state`, `source_sync_runs`, `document_metadata`, `rag_document_metadata`, `document_chunks`
- Deprecated or parallel paths: static `SHAREPOINT_SYNC_FOLDERS` as sole scope owner

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [ ] The production sync discovers project folders without one env entry per project.
- [ ] A newly added project folder becomes a pending/bootstrap scope on the next run.
- [ ] Established delta scopes continue syncing while a bounded number of new scopes bootstrap.
- [ ] A changed eTag re-materializes complete text and resets vectorization to pending.
- [ ] A same-eTag item is idempotently skipped.
- [ ] Project attribution prefers exact `YY-NNN` job-number matching.
- [ ] Known non-text formats are counted with explicit reasons; unknown or text-bearing unsupported formats preserve the prior cursor and fail loudly.
- [ ] Health reports discovery failure, pending bootstrap, failed scopes, catalog/RAG ID drift, and cataloged documents without chunks.
- [ ] Production is triggered immediately and current run evidence is captured.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [ ] Shared abstraction owns cross-cutting behavior.
- [ ] Errors are specific and actionable.
- [ ] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned files:

- `backend/src/services/integrations/microsoft_graph/sharepoint_scopes.py`
- `backend/src/services/integrations/microsoft_graph/sync.py`
- `backend/src/services/integrations/microsoft_graph/onedrive.py`
- `backend/src/services/integrations/microsoft_graph/project_documents.py`
- `backend/src/services/health/source_sync_health.py`
- `backend/src/services/health/source_rag_health.py`
- focused tests under `backend/tests/`
- `backend/scripts/verify_sharepoint_project_vector_contract.py`
- `render.yaml`
- this task, handoff, learning entry, and evidence directory

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual live SharePoint discovery proves the requested scope.
- [ ] A production Graph run proves discovery receipts and source processing.
- [ ] Database readback proves the source/catalog/vector contract.
- [ ] Independent review is recorded.
- [ ] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a named discovery, bootstrap, extraction, catalog, or vector coverage error with the affected resource IDs and counts.
- Detection path: `alleato-graph-sync` nonzero/failed phase receipt, `alleato-source-rag-health` alert, and the standalone verifier.
- Recovery path: fix the named connector/extractor/vector owner, rerun the exact failed scope, then rerun reconciliation until all required counts and ID sets match.

## Incident Learning

- Failure fingerprint: `sharepoint-static-scope-and-stale-content`
- Root cause: production scope was three hand-entered folders; existing source IDs were skipped even when their eTag changed; health compared only already-cataloged rows.
- Detection gap: no source-authoritative folder inventory, no changed-source regression test, and no discovered-scope/bootstrap coverage assertion.
- Prevention: governed discovery, eTag-aware re-ingestion, exact ID-set reconciliation, and production receipts.
- Guardrail evidence: `docs/ops/evidence/2026-07-24-sharepoint-project-discovery-reconciliation/`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live configuration | Render readback | Failed contract | Only three folders configured in production. |
| Live SharePoint tree | Microsoft Graph/SharePoint readback | Failed contract | 54 project folders exist under 2025-2026 alone. |
| Live corpus sample | uncursored Graph delta inventory | Failed contract | Both year roots exceed 10,000 items; first 20,000 contain 7,646 eligible text files. |

## Remaining Risk

- Historical bootstrap volume is large. Completion requires production backfill receipts; a deployed discovery feature alone is not corpus-complete.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
