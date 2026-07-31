# Task: Vectorize SharePoint Project Workbooks

Status: Complete
Owner: SROOT-SP-SHEETS
Created: 2026-07-22
Task ID: LOCAL-2026-07-22-SHAREPOINT-SPREADSHEETS
Linear Issue: Required for High-risk work; Linear connector is unavailable in this session, so this repository task is the controlling record.
Related Handoff: N/A — single implementation session with independent review.

## Objective

Every XLSX and XLSM workbook enumerated from the configured SharePoint project estimate and proposal folders is fully text-materialized, cataloged, chunked, and vectorized, with exact source-to-vector reconciliation proving coverage.

## Scope

- Canonical Microsoft Graph OneDrive/SharePoint file extractor and ingestion behavior.
- XLSX/XLSM extraction, full-text persistence, focused regression tests, scoped production backfill, database readback, independent review, and release evidence.
- Explicit exclusion: tenant-wide SharePoint folder discovery; this task repairs the configured project-folder ingestion contract and records any broader discovery gap separately.

## Source of Truth

- Canonical runtime/data owner: Render `alleato-graph-sync` -> Microsoft Graph -> PM App Supabase catalog -> AI/RAG Supabase chunks.
- Existing shared primitives/services: `backend/src/services/integrations/microsoft_graph/onedrive.py`, `SupabaseRagStore`, and Graph embedding workers.
- Deprecated or parallel paths: None authorized for this repair.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] XLSX and XLSM are admitted by the shared Graph document extractor.
- [x] Every non-empty worksheet cell is materialized with sheet and cell provenance, including formulas and available cached values.
- [x] Extracted source text is not silently page- or character-truncated before RAG persistence.
- [x] Previously skipped workbooks are revisited through a scoped SharePoint backfill.
- [x] Exact SharePoint source IDs reconcile to vectorized RAG document IDs with 3072-dimensional embeddings.
- [x] Extraction, capacity, or persistence failures keep the prior SharePoint delta cursor and fail the run loudly.
- [x] Requested behavior is observable end to end.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Provider and delivery contracts are verified by live readback.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Independent review approves the release candidate.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published by exact-file compare-and-swap and match `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: SharePoint sync error naming the source workbook and extraction, capacity, or persistence boundary; the previous delta cursor remains active.
- Detection path: Graph cron nonzero exit, Render log, source-health alert, and exact source-to-vector reconciliation manifest.
- Recovery path: correct the extractor/provider failure and replay the preserved cursor or perform a deliberately scoped cursor reset for newly supported historical formats.

## Incident Learning

- Failure fingerprint: `intelligence.sharepoint-project-attribution-drift` (the existing SharePoint evidence-enumeration integrity family).
- Root cause: The canonical Graph extractor omitted XLSX/XLSM and silently advanced its delta cursor past unsupported files; admitted PDFs and text were also truncated before RAG persistence.
- Detection gap: Coverage counted only already-cataloged eligible rows, so silently excluded SharePoint files were absent from both numerator and denominator.
- Prevention: Reconcile enumerated SharePoint source IDs and extensions against catalog and vector rows; test complete extraction and persistence; fail closed after an admitted file cannot be materialized.
- Guardrail evidence: `docs/ops/evidence/2026-07-22-sharepoint-spreadsheet-vectorization/`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Passed | High-risk scope and acceptance contract captured before implementation. |
| Unit tests | Focused offline pytest command in verification evidence | Passed | 16 passed. |
| Static checks | Ruff, py_compile, git diff check | Passed | No task-owned errors. |
| Independent review | `independent-review.md` | Approved | Live replay retained as release gate. |
| Deployment | Render deployment for `66ff2a8` | Passed | Graph sync and source health live. |
| Historical replay | Render job `job-d9gi70u1a83c73fjk7b0` | Passed | Eight workbooks ingested; cursor restored. |
| Database reconciliation | `source-inventory.json` and `verification-result.json` | Passed | 26/26 cataloged and vectorized; equal ID hashes; 3072 dimensions. |
| Unrelated test blocker | Standard repository pytest conftest | Unrelated | `backend/src/api/main.py` imports missing `list_llm_wiki_history` from concurrently edited `src.services.agents.llm_wiki`; focused tests bypassed the unrelated app fixture. |

## Remaining Risk

- Tenant-wide discovery is outside this bounded repair. Cause: production configuration names three project evidence folders rather than a tenant root. Detection gap: prior reporting called configured-folder coverage “all SharePoint.” Prevention: this task now labels the boundary explicitly and fails closed on any unsupported file inside configured folders. Next owner action: add governed tenant-wide site/library discovery before making tenant-wide completeness claims.

## Final Status

- [x] All required task-scope checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred tenant-wide discovery has cause, detection gap, prevention step, and next owner action.
