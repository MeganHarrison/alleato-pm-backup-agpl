# Task: Retire Legacy Teams and Generic Intelligence Ingress

Status: Complete
Owner: SROOT-LEGACY-INGRESS
Created: 2026-07-22
Task ID: LOCAL-20260722-retire-legacy-teams-generic-ingress
Linear Issue: N/A — single-session untracked eradication requested directly by the user
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-legacy-teams-generic-intelligence-ingress.md`

## Objective

Teams ingestion and the generic three-stage pipeline complete without importing or invoking `src.services.intelligence.compiler`.

## Scope

- Remove the retired compiler import, helper, and invocations from Teams ingestion.
- Remove the retired compiler stage and transitive extractor projections from the generic pipeline.
- Update focused tests and extend the canonical Project Intelligence ownership contract.
- Explicit exclusion: Graph embedding ingress, compiler deletion, and queue terminalization are separate follow-on cuts.

## Source of Truth

- Canonical runtime/data owner: `project-intelligence/` and raw RAG document ingestion
- Existing shared primitives/services: `project-intelligence/core/ownership-contract.mjs`
- Deprecated or parallel paths: `backend/src/services/intelligence/compiler.py`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Teams ingestion persists raw/RAG document metadata and marks embeddings pending without importing or invoking the retired compiler.
- [x] The generic pipeline stops after parser, embedder, and task extraction and returns `status=done` without compiler-driven signal/card projections.
- [x] The canonical ownership contract recursively scans the Teams integration and entire pipeline tree and fails on retired compiler imports, calls, aliases, or versions.
- [x] Focused tests, independent review, publication, and release readback pass.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] No database, provider, authentication, permission, or schema contract changes are required.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Runtime import readback proves neither module binds the retired compiler.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and exact-file publication evidence proves the remote commit.

## Failure-Loudly Contract

- Cause surfaced as: ownership-contract test failure naming the exact runtime file and forbidden legacy term
- Detection path: `node --test project-intelligence/runner/__tests__/ownership-contract.test.mjs`
- Recovery path: remove the reintroduced import/call and route work through the canonical Project Intelligence owner

## Incident Learning

- Failure fingerprint: `architecture.project-intelligence-runtime-ownership-drift`
- Root cause: ingestion runtimes retained direct legacy compiler hooks after canonical Project Intelligence ownership was established.
- Detection gap: the ownership contract guarded scheduled Daily Brief paths but not backend ingestion imports.
- Prevention: scan the named ingestion runtimes for forbidden compiler imports, calls, and aliases.
- Guardrail evidence: ownership-contract test passes 4/4, including an adversarial reintroduction fixture.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Python import ownership probe | Failed before fix | Teams and pipeline both bound `src.services.intelligence.compiler`. |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Focused ingestion behavior | `cd backend && .venv/bin/python -m pytest --noconftest tests/test_pipeline_orchestrator.py tests/test_microsoft_graph_teams_dm_export.py tests/test_meeting_signal_promotion.py -q` | Pass, 10/10 | Teams raw/RAG persistence, three-stage generic ingestion, deep extraction, and canonical task persistence remain intact. |
| Ownership guard | `node --test project-intelligence/runner/__tests__/ownership-contract.test.mjs` | Pass, 4/4 | Recursively scans the full pipeline and Microsoft Graph integration trees; an adversarial moved-helper fixture fails with the exact path and term. Graph `embed.py` is the single explicit temporary allowlist entry. |
| Predeploy enforcement | `npm run rag:verify:project-intelligence-live-paths` | Owned assertion passes; command fails on unrelated missing files | The verifier now invokes the recursive ingress assertion. Existing failures are missing `source-sync-health-panel.tsx` and four retired local docs paths, unrelated to this change. |
| Runtime import readback | Fresh Python import plus module-symbol probe | Pass | Importing Teams and then the generic pipeline does not load `src.services.intelligence.compiler`; Teams, orchestrator, and extractor expose no legacy hook symbols. |
| Static syntax | `py_compile` plus `node --check` on owned runtime/test files | Pass | No syntax errors; `git diff --check` rerun after final cleanup. |
| Normal backend pytest collection | `.venv/bin/python -m pytest tests/test_pipeline_orchestrator.py tests/test_microsoft_graph_teams_dm_export.py -q` | Blocked by unrelated checkout debt | `backend/tests/conftest.py` imports `list_llm_wiki_history`, but the dirty checkout's `src.services.agents.llm_wiki` does not export it. The owned tests pass with the unrelated global conftest disabled. |
| Independent review | Reviewer agent, two findings corrected, final re-review | Pass | Expanded removal through `pipeline/extractor.py`, recursive guard, predeploy wiring, and present-state handoff wording accepted. |
| Main publication/readback | Exact-file compare-and-swap publisher plus `git fetch origin main` | Pass | Eleven owned files published at `25fa59bd0f9fa26c8391fd5aced1efad820d3ecd`; `origin/main` resolves to that commit and remote extractor source contains zero retired compiler terms. |
| Production release | `render deploys list srv-d8271ohj2pic739klb7g -o json`; production `/health` probe | Pass | Deploy `dep-d9ggd36q1p3s73epugpg` is live on commit `25fa59bd0f9fa26c8391fd5aced1efad820d3ecd`; backend reports healthy and application DB reachable. |

## Remaining Risk

- Graph embedding still has a separate retired compiler ingress and must be removed in the next cut.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred Graph/compiler/queue work has an explicit next owner action.
