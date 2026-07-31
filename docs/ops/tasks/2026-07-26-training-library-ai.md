# Task: Ask the Training Library

Status: Blocked — AI Gateway Credits and Production Authentication
Owner: S242
Created: 2026-07-26
Task ID: ALL-29
Linear Issue: https://linear.app/alleato-group/issue/ALL-29/t15-ask-the-library-ai-over-training-content
Related Handoff: `docs/ops/handoffs/2026-07-26-S242-training-library-ai.md`

## Objective

Replace the legacy NotebookLM-first link with an authenticated in-app chat that
answers from Alleato training guides and published resources, and renders a
clickable source for every grounded answer.

## Scope

- Reuse the existing AI chat, conversation, AI Gateway, RAG database, retrieval,
  and citation owners with a training-only adapter.
- Index the three in-app MDX guides and every currently published training
  resource through one idempotent reconciliation service.
- Keep NotebookLM as a recovery link only.
- Exclude a second chat framework, a second vector database, generic assistant
  routing changes, external resource scraping, and unreviewed resources.

## Source of Truth

- Canonical runtime/data owner: `/api/ai-assistant` chat/conversation
  primitives, AI Database `rag_document_metadata` + `document_chunks`, and the
  FastAPI embedding pipeline.
- Existing shared primitives/services:
  `frontend/src/components/ai-assistant/rag-chat-page.tsx`,
  `frontend/src/lib/ai/retrieval/retrieve-chunks.ts`,
  `frontend/src/lib/ai/chat-surface.ts`,
  `backend/src/services/supabase_helpers.py`, and
  `backend/src/services/integrations/microsoft_graph/embed.py`.
- Deprecated or parallel paths: legacy `training-source` NotebookLM navigation
  remains fallback-only and is not a runtime owner.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `/training/ask` uses the shared AI conversation/chat UI.
- [x] Training conversations cannot appear on or post through other assistant surfaces.
- [x] Retrieval is restricted to `training_guide` and `training_resource` chunks.
- [ ] The three in-app guides and all published resources are indexed idempotently.
- [ ] Archived/review resources are not searchable.
- [x] A grounded answer includes at least one clickable guide or resource source.
- [x] Empty/degraded retrieval is explicit and offers the NotebookLM recovery link.
- [ ] Desktop and mobile production flows have no horizontal overflow or product errors.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an authenticated chat error that distinguishes unavailable
  training retrieval, an empty corpus, synthesis failure, and persistence
  failure; the UI exposes the recovery-only NotebookLM link.
- Detection path: focused route/retrieval/indexer tests, indexed-document and
  chunk readback, browser console inspection, and an authenticated production
  question with source-link proof.
- Recovery path: run the idempotent training index reconciliation, inspect the
  named failed document, then retry; learners can use the NotebookLM fallback
  while the owned index is repaired.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: `TrainingDocument.as_metadata()` wrote `training_guide`/`training_resource` into `document_metadata.document_type`, which has an FK to the controlled `document_type_taxonomy`; production returned SQLSTATE `23503` on the first guide upsert.
- Detection gap: The first count-only health response proved zero catalogue rows but did not expose the last reconciliation stage or error type outside restricted Render logs.
- Prevention: Training source types remain in `type` and `category`; a regression forbids writing them into the taxonomy FK, and the health response retains secret-free stage/code/fingerprint diagnostics.
- Guardrail evidence: `docs/ops/evidence/2026-07-26-training-module-completion/all-29/production-diagnostic-1.json`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Backend index tests | `PYTHONPATH=backend python3 -m pytest backend/tests/test_training_rag_index.py -q` | Pass | 12 passed; includes idempotence, stale removal, periodic refresh, flag drift, and count-only health. |
| Frontend surface tests | focused Jest page, grounding, and surface suites | Pass | 14 passed. |
| Training chat route tests | focused Jest route suite | Pass | 3 passed; auth, exact source types, explicit recovery, and persistence failure. |
| Static and contract checks | ESLint, corpus check, route conflicts, RAG chat/source/embedding contracts, map checks, `git diff --check` | Pass | All targeted checks passed. |
| Scoped TypeScript | task-owned `tsconfig` | Pass with unrelated diagnostic | No new ALL-29 diagnostic; existing `chat-area.tsx:739` `Uint8Array`/`BlobPart` mismatch also exists on `origin/main`. |
| Production build | `pnpm --dir frontend run build` | Unrelated failure | Node exhausted the configured 7 GB heap, exit 134, before any task-owned diagnostic. |
| Independent review | S235 initial review and re-review | Pass after fixes | Recovery-only fallback, periodic refresh, write-flag drift, serialized manual reconcile, and cancellation verified. |
| Pre-release manifest | `docs/ops/evidence/2026-07-26-training-module-completion/all-29/pre-release-verification.md` | Pass | Commands, findings, and known constraints recorded. |
| Production index and browser proof | production health readback plus signed-in desktop/mobile chat | Blocked | Live index reconciliation reaches the first embedding call, then the required AI Gateway returns HTTP 402; authenticated browser proof also needs a signed-in production session. |
| Production diagnostic 1 | `docs/ops/evidence/2026-07-26-training-module-completion/all-29/production-diagnostic-1.json` | Failure localized | Provider and app DB health passed; index failure occurs before the first catalogued document. |
| Production diagnostic 2 | `docs/ops/evidence/2026-07-26-training-module-completion/all-29/production-diagnostic-2.json` | First failing operation identified | `upsert-training_guide`, `APIError`, fingerprint `3e4a0c2452c3`. |
| Production diagnostic 3 | `docs/ops/evidence/2026-07-26-training-module-completion/all-29/production-diagnostic-3.json` | Root cause confirmed | SQLSTATE `23503` plus the generated FK contract proves the source type was incorrectly written into `document_type_taxonomy`. |
| Post-fix embedding readback | production health | Blocked | Taxonomy FK is cleared (`catalogued=1`); `embed-training_guide` now returns HTTP 402 from the required AI Gateway. |
| Production diagnostic 4 | `docs/ops/evidence/2026-07-26-training-module-completion/all-29/production-diagnostic-4.json` | External blocker confirmed | Required AI Gateway returns 402; no direct OpenAI fallback is configured, so reconciliation cannot index the remaining 69 documents. |

## Remaining Risk

- The required Vercel AI Gateway provider rejects `text-embedding-3-large`
  requests with HTTP 402. The live corpus is therefore `1/70` catalogued and
  `0/70` searchable.
- Cause: provider account/billing state, after the application successfully
  crosses the database boundary and reaches `embed-training_guide`.
- Detection gap: provider configuration health previously proved only that the
  gateway was configured, not that a live embedding request had available
  credit. The reconciliation health now records the safe upstream status.
- Prevention: keep the per-reconciliation provider status and require the
  production index health gate (`searchable=desired`, zero missing/unsearchable)
  before closing future training releases.
- Owner and next action: the Alleato AI provider administrator must restore AI
  Gateway credit/budget, or authorize a securely configured direct OpenAI
  fallback on Render. Afterward, rerun/read the existing reconciliation health
  until all 70 documents are searchable.
- Production authentication proof requires either a configured E2E account or
  explicit approval for a temporary verification-only account.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
