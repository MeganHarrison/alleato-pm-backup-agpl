# S242 Handoff: ALL-29 Ask the Training Library

Status: Blocked — AI Gateway Credits and Production Authentication
Delivery lane: High-risk

## Ownership

- Training-only AI surface, retrieval adapter, generated guide corpus,
  idempotent backend RAG reconciliation, focused tests, and release evidence.

## Acceptance Contract

See `docs/ops/tasks/2026-07-26-training-library-ai.md`.

## Work Summary

- Added `/training/ask` on the canonical shared RAG chat and conversation owners.
- Isolated `training_library` conversations from the general and Ask Alleato surfaces.
- Restricted retrieval and citations to `training_guide` and `training_resource`.
- Generated a deterministic corpus from the three owned MDX guides.
- Added serialized, idempotent indexing for guides and published resources.
- Added startup plus five-minute reconciliation, authenticated manual reconcile,
  graceful cancellation, and a count-only public health readback.
- Removed the persistent NotebookLM action; it is now shown only in explicit
  empty or unavailable recovery messages.

## Verification

- Backend index suite: 12 passed.
- Frontend page, grounding, and surface suites: 14 passed.
- Training chat route suite: 3 passed.
- Focused ESLint, corpus drift, route conflict, RAG chat architecture,
  source-specific RAG, graph embedding, project map, system map, Python compile,
  and diff whitespace checks passed.
- Scoped TypeScript emitted only the pre-existing `chat-area.tsx:739`
  `Uint8Array`/`BlobPart` diagnostic, confirmed identical on `origin/main`.
- Full frontend build exited 134 after exhausting its configured 7 GB heap; no
  ALL-29-specific compile diagnostic was emitted before termination.

## Index Readback

- The production endpoint is live and returns only safe counts and diagnostic
  classifications. The current readback is `desired=70`, `catalogued=1`,
  `searchable=0`, `missing=69`, and `unsearchable=1`.

## Independent Review

- Initial review found three blockers: steady-state NotebookLM action,
  startup-only index freshness, and write-flag suppression.
- Re-review passed with no remaining P0-P2 after recovery-only UI, periodic
  refresh, ungated RAG client selection, serialized manual reconcile, regression
  tests, and shutdown cancellation were added.

## Evidence

- `docs/ops/evidence/2026-07-26-training-module-completion/all-29/pre-release-verification.md`

## Post-publication Diagnostic

- The first live `/health/training-library` readback returned HTTP 503 with
  `desired=70`, `catalogued=0`, `indexed=0`, and `missing=70`.
- General backend health reported the AI Gateway, embedding provider, app DB,
  RAG credentials, and Supabase service configuration as available.
- S243 localized the failure to `upsert-training_guide` with `APIError` and fingerprint `3e4a0c2452c3`.
- S245 exposed SQLSTATE `23503` without private text. The generated schema shows `document_metadata.document_type` is an FK to `document_type_taxonomy`.
- S246 removes the invalid taxonomy field while retaining training `type` and `category`, with a regression covering both training source types. Production then catalogued the first guide and reached the embed call.
- S247 adds only `lastErrorStatus` so the upstream embedding response can be classified without exposing response text; 12 focused tests pass.
- The live post-S247 readback identifies HTTP 402 at
  `embed-training_guide`. General health confirms the Vercel AI Gateway is
  required and configured, while no direct OpenAI fallback is configured.

## Remaining Risk

- Production reconciliation cannot continue until the AI provider administrator
  restores the gateway credit/budget or authorizes a securely configured direct
  OpenAI fallback on Render. The current health response will fail loudly and
  verify recovery without exposing provider response text.
- Authenticated production desktop/mobile and grounded-answer proof still
  requires either an existing signed-in browser session, a configured E2E user,
  or explicit approval to create and immediately delete a verification-only user.
