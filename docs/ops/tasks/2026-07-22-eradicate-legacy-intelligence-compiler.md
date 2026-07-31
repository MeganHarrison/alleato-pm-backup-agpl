# Task: Eradicate the legacy intelligence compiler

Status: Complete
Owner: Codex
Created: 2026-07-22
Task ID: LOCAL-20260722-legacy-compiler-eradication
Linear Issue: Not created; this is the final slice of the existing local retirement work.
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-legacy-intelligence-compiler-eradication.md`

## Objective

Remove `ai_intelligence_compiler_v0_1` from every production ingress and runtime module, delete its implementation, and cancel only its still-active queue rows after the replacement-free ingestion boundary is live.

## Scope

- Remove Graph embedding's compiler callback without changing document ingestion, chunking, or embedding.
- Move the small validation/target/signal helpers still used by canonical backend projections into the canonical `project_intelligence` package.
- Delete the compiler module, its package exports, and compiler-only backfill/repair entrypoints.
- Remove retired queue data from current source-health calculations while preserving historical rows.
- After deployment, cancel only `queued`/`running` rows for `ai_intelligence_compiler_v0_1`; do not delete or rewrite completed history.
- Excludes schema changes and deletion of historical queue tables or completed rows.

## Source of Truth

- Canonical synthesis owner: `project-intelligence/runner/run-scheduled-daily-executive-brief.mjs` and its packet/projection adapters.
- Canonical ingestion owners: `backend/src/services/integrations/microsoft_graph/**` and `backend/src/services/pipeline/**`; their responsibility ends after durable source storage and embedding.
- Deprecated path: `backend/src/services/intelligence/compiler.py` and `ai_intelligence_compiler_v0_1` queue ingress.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Graph, Teams, and generic ingestion contain no import, enqueue, inline call, or callback to the retired compiler.
- [x] `backend/src/services/intelligence/compiler.py` and compiler-only maintenance/backfill entrypoints are absent.
- [x] Orphaned compiler prompt builders are deleted; Git history is the archive.
- [x] Canonical backend projection modules import only canonical `project_intelligence` owners.
- [x] Source health no longer treats the retired queue as a required ingestion stage.
- [x] Focused ingestion, projection, and ownership tests pass.
- [x] Production Render health is green on the published commit.
- [x] No new retired compiler row is created after the deployment boundary.
- [x] Only active retired rows are changed to `cancelled`; completed and failed history is preserved.
- [x] Admin source-sync lifecycle routes no longer read the retired queue.
- [x] Assistant source-health context no longer treats `uncompiled_count` as packet truth.
- [x] Operations readiness and RAG snapshots read canonical artifacts only.
- [x] Repository-wide runtime ownership guard rejects reintroduced retired queue reads.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting target and signal validation behavior.
- [x] Errors are specific and actionable.
- [x] Live AI Database identity and exact queue state are verified before mutation.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Live ingestion/embedding boundary and canonical synthesis imports are proved.
- [x] Independent review passes.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published with exact blob parity to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: ownership verification fails on any production import/call/version marker for the retired compiler, or live SQL finds a post-deploy retired queue row.
- Detection path: recursive source scan, focused import/test gate, Render deployment readback, and AI Database queue readback.
- Recovery path: remove the newly introduced caller before release; never reactivate or drain the retired queue.

## Incident Learning

- Failure fingerprint: `architecture.project-intelligence-runtime-ownership-drift`
- Root cause: earlier consolidation moved final writers and removed selected callers but left the compiler importable, with Graph embedding still invoking it after successful embedding.
- Detection gap: ownership checks scanned named ingestion files and allowed one known Graph exception instead of asserting repository-wide runtime absence.
- Prevention: delete the module and enforce recursive production-source absence; deployment readback must prove no post-deploy queue creation.
- Guardrail evidence: the recursive ownership test rejects the retired import/call/version markers across all backend service paths; the release tree contains the version string only in that negative guard.

### Reopened detection gap

- Failure fingerprint: `architecture.project-intelligence-runtime-ownership-drift`
- Root cause: the first eradication pass removed writers and implementation code, but several read-only admin and assistant consumers still treated historical queue/snapshot fields as current system truth.
- Detection gap: the ownership guard scanned backend service imports and invocation markers, not frontend runtime reads of retired queue tables.
- Prevention: scan backend and frontend runtime source for retired ingress markers and direct retired queue reads; keep focused consumer tests at each former read surface.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live AI Database identity | Supabase project `fqcvmfqldlewvbsuxdvz` (`AI Database`) | Pass | Project is `ACTIVE_HEALTHY`; queue tables exist there. |
| Pre-change active rows | Grouped SQL on `source_intelligence_jobs` | 1,888 active | 1,880 queued and 8 running; completed/failed/skipped history is separate. |
| Active writer proof | Recent queue rows by source ID prefix | Failing before change | Teams DM sources were still producing `signal_extract` rows through Graph embedding. |
| Focused backend tests | `PYTHONPATH=backend backend/.venv/bin/python -m pytest -q --noconftest backend/tests/test_graph_embed.py backend/tests/test_source_sync_health.py backend/tests/test_source_rag_health.py backend/tests/test_project_intelligence_validation.py backend/tests/test_project_intelligence_targets.py backend/tests/test_project_intelligence_signal_candidates.py backend/tests/test_project_synthesizer_budget.py -k 'not health_check_staleness_alerts'` | Pass | 60 passed, 1 deselected. The excluded staleness assertion is unrelated drift around a removed `_post_teams` test helper. |
| Recursive ownership guard | `node --test project-intelligence/runner/__tests__/ownership-contract.test.mjs` | Pass | 4 of 4 tests pass; production scanning has no Graph exception. |
| Fresh backend import probe | Import Graph embed, canonical projections, and source health in a fresh interpreter | Pass | No legacy module loaded; Graph exposes no compiler callback. |
| Independent review | `legacy_ingress_review` | Pass | Confirmed the origin-based release preserves packet repository, operating record, report suggestion, and source timeline modules and that canonical imports load. |
| Publication | `origin/main` commit `6ce38e7bb5fdedaab66ac065266af308317b606b` | Pass | Exact 29-file origin-based publication; 5,798 lines removed. |
| Render release | Deploy `dep-d9ghmuegvqtc73f5cmog` | Pass | Exact commit became live at `2026-07-22T19:41:15.303638Z`; health was green and app DB reachable. |
| Post-deploy ingestion boundary | AI Database readback after Render live timestamp | Pass | 21 source-processing jobs advanced through `2026-07-22T19:42:01.905025Z`, while zero retired compiler jobs were created. |
| Scoped queue terminalization | Locked update of old-version `queued`/`running` rows | Pass | 1,880 queued and 8 running rows changed to `cancelled`; no deletes. |
| Final queue readback | Grouped source and packet-refresh SQL | Pass | Active source rows 0; active packet-refresh rows 0; history preserved at 17,207 succeeded, 1,959 failed, and 6 skipped; cancelled 1,888. |
| Surviving consumer guard | Four focused Node ownership suites | Pass | 7/7 assertions pass across operations readiness, source-sync lifecycle, assistant health, and RAG snapshots. |
| Backend source-health regression | Direct isolated module harness | Pass | 23 zero-argument source-health tests pass; historical snapshot backlog cannot restore retired compiler health state. |
| Frontend summary regression | Focused Jest suite | Pass | 7/7 source-sync summary tests pass; no retired compiler wording enters AI summary context. |
| Final independent review | `legacy_compiler_review` | Pass | No active backend/frontend runtime reads either retired queue as current truth. |
| Publication hygiene | Remote tree readback | Pass after correction | A temporary local `frontend/node_modules` dependency symlink was included by the first exact-file publish and removed in the immediate follow-up publication; no application code depended on it. |
| Archived implementation scan | Repository import/symbol search | Pass | `backend/src/services/intelligence/prompts.py` had no consumers and was deleted; the ownership guard now forbids restoring it. |
| Aggregate live-path verifier | `node scripts/verify/verify_project_intelligence_live_paths.mjs` | Unrelated failure | Existing repository debt: missing `frontend/src/components/ai-intelligence/source-sync-health-panel.tsx` and four `docs/alleato-os-docs/project-intelligence/*.mdx` files. The task-owned recursive ownership assertion passed before the aggregate stopped. |
| Outlook test collection | Normal pytest collection for `backend/tests/test_outlook_intake.py` | Unrelated failure | Existing `backend/tests/conftest.py` imports missing `list_llm_wiki_history`; `--noconftest` then lacks seven shared fixtures. The changed Graph boundary tests pass in the focused suite. |

## Remaining Risk

- No legacy compiler runtime work remains. The next scheduled Daily Executive Brief is normal operational observation, not replacement coverage required to retire the invalid compiler outputs.
- The unrelated aggregate-verifier and broad pytest-bootstrap debt remain assigned to their existing owner surfaces listed in the evidence table.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
