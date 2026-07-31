# Handoff: Retire Legacy Teams and Generic Intelligence Ingress

## Intake Block

1) Session ID: SROOT-LEGACY-INGRESS
2) Task ID: LOCAL-20260722-retire-legacy-teams-generic-ingress
3) Linear issue: N/A — single-session untracked work
4) Current status: Complete and published to `origin/main` at `25fa59bd0f9fa26c8391fd5aced1efad820d3ecd`
5) Files owned: Teams ingestion, generic orchestrator/extractor, focused tests, canonical ownership contract, predeploy verifier, this task/handoff
6) Commands run: focused pytest 10/10 pass; ownership contract 4/4 pass; Python/Node syntax pass; fresh runtime import readback pass
7) Evidence artifacts: `docs/ops/tasks/2026-07-22-retire-legacy-teams-generic-intelligence-ingress.md`
8) Top finding: current Teams and generic-pipeline source contains zero retired compiler hooks; the removed surface included the visible orchestrator stage plus two hidden extractor imports and its legacy signal/card projection code
9) Recommended next action: remove Graph embedding ingress, then terminalize active retired jobs and delete the compiler surface
10) Migration ledger evidence: N/A

## Acceptance Contract

- Teams and generic ingestion have no retired compiler import or invocation.
- Three-stage ingestion and canonical task behavior remain covered by focused tests.
- The shared ownership guard recursively scans both runtime trees, is enforced by the predeploy live-path verifier, and fails loudly on a moved-helper reintroduction.
- Independent review and exact-file publication complete before closeout.

## Evidence

- Teams and generic pipeline modules expose neither `process_source_document_to_packet` nor `_run_source_intelligence_compiler` after import.
- Focused Teams persistence, pipeline execution, deep extraction, and task tests pass 10/10 with the unrelated global conftest disabled.
- Ownership contract passes 4/4; its moved-helper fixture proves a transitive legacy import fails loudly, and the predeploy live-path verifier invokes the same assertion.
- Independent reviewer final result: PASS after the transitive extractor dependency and first guardrail weakness were corrected.
- Exact-file compare-and-swap publication succeeded for all 11 owned files; remote `origin/main` readback resolved to `25fa59bd0f9fa26c8391fd5aced1efad820d3ecd` with zero retired compiler terms in the published extractor.
- Render deploy `dep-d9ggd36q1p3s73epugpg` reached `live` on the code commit; the production backend health endpoint reports healthy with the application database reachable.
- Normal pytest collection is blocked before owned tests run by unrelated dirty-checkout `llm_wiki` export drift in `backend/tests/conftest.py`.
