# Handoff: Legacy intelligence compiler eradication

Status: Complete
Session: SROOT-LEGACY-COMPILER-ERADICATION
Task: `docs/ops/tasks/2026-07-22-eradicate-legacy-intelligence-compiler.md`
Delivery lane: High-risk

## Acceptance contract

- No production ingestion or canonical projection imports or invokes `services.intelligence.compiler`.
- The legacy module and its compiler-only operator entrypoints are deleted.
- Graph ingestion and embedding remain independently testable.
- Production creates zero `ai_intelligence_compiler_v0_1` jobs after deployment.
- Exactly the active retired rows are cancelled; historical terminal rows remain unchanged.

## Current evidence

- AI Database project identity: `fqcvmfqldlewvbsuxdvz`, name `AI Database`, status `ACTIVE_HEALTHY`.
- Active retired source jobs before change: 1,880 queued + 8 running.
- Historical source jobs before change: 17,207 succeeded + 1,959 failed + 6 skipped.
- Recent rows through 2026-07-22 18:40 UTC were Teams DM `signal_extract` jobs; this localizes the surviving writer to the Graph embedding callback.

## Migration ledger evidence

N/A. No schema migration is planned; the data transition is a scoped row update after production code is live.

## Verification

- Published exact task-owned changes to `origin/main` at `6ce38e7bb5fdedaab66ac065266af308317b606b`.
- Focused backend verification passed: 60 tests passed and 1 unrelated staleness assertion was deselected.
- Recursive ownership guard passed 4 of 4 tests; the retired module/version survives only as forbidden text in the negative guard.
- Independent review passed and confirmed the origin-based tree preserved canonical packet, operating-record, timeline, and report-suggestion modules.
- Render deploy `dep-d9ghmuegvqtc73f5cmog` became live at `2026-07-22T19:41:15.303638Z`; `/health` was healthy with the app database reachable.
- After that deployment boundary, 21 source-processing jobs advanced through `2026-07-22T19:42:01.905025Z` and zero `ai_intelligence_compiler_v0_1` jobs were created.
- Scoped row transition cancelled exactly 1,880 queued and 8 running source jobs. Final active source rows: 0. Final active old-version packet-refresh rows: 0.
- Historical source rows were preserved unchanged: 17,207 succeeded, 1,959 failed, and 6 skipped. Final cancelled count: 1,888.
- Known unrelated verification debt: the aggregate live-path verifier references one absent frontend panel and four absent docs pages; normal Outlook pytest collection imports a missing `list_llm_wiki_history` helper from the shared test bootstrap.

## Remaining work

No legacy compiler runtime work remains. Observe the next scheduled canonical Daily Executive Brief as normal operations; separately repair the pre-existing aggregate-verifier and shared pytest-bootstrap debt in their owner surfaces.
