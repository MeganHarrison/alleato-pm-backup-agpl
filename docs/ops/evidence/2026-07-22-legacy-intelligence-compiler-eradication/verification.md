# Legacy intelligence compiler eradication verification

## Runtime boundary

- The deleted compiler has no active import, enqueue, invocation, or direct queue-read consumer in backend or frontend runtime source.
- Source ingestion health ends at durable embedding. The legacy `uncompiled` response properties remain zero-valued compatibility fields and do not read historical queue or snapshot state.
- Project Intelligence readiness reads current packets, insight cards, evidence-review candidates, and the canonical AI Ops run ledger.
- Historical queue rows remain database history only. Production created zero retired compiler rows after the Render deployment boundary, and all formerly active rows are terminal.

## Focused checks

- `node --test project-intelligence/runner/__tests__/ownership-contract.test.mjs project-intelligence/runner/__tests__/operations-readiness-web-ownership.test.mjs project-intelligence/runner/__tests__/retired-compiler-consumers.test.mjs project-intelligence/runner/__tests__/rag-snapshots-retired-compiler.test.mjs` — 7 passed.
- Frontend Jest `source-sync-summary.test.ts` — 7 passed.
- ESLint on all changed frontend runtime files — passed.
- Direct isolated source-health regression harness — 23 zero-argument tests passed.
- Normal backend pytest collection is blocked by unrelated duplicate FastAPI router inclusion in `backend/src/api/main.py`; the isolated module harness avoids that unrelated bootstrap failure.

## Negative path

The ownership test injects both a backend compiler import and a frontend `.from("source_intelligence_jobs")` read. Each raises an actionable Project Intelligence ownership violation.
