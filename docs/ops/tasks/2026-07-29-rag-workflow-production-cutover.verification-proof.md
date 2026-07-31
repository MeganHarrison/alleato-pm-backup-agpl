# Verification Proof: Canonical RAG Workflow Cutover

## Source Proof

- `npm run test:rag:workflow-ownership`: 8 passed.
- Caller-authentication contract: 4 passed.
- Focused backend pytest: 29 passed, 1 platform skip.
- `render.yaml` PyYAML parse: pass, 21 services.
- Python compile: pass.
- `git diff --check`: pass.
- Legacy reference search: no live references to the removed orchestrator,
  digest, Fireflies reprocessor, or post-ingest extraction helper.
- Independent source review: approved after the stale replay endpoint was
  moved to the durable Workflow client and protected by a regression contract.

## Deployment Proof

- Canonical Vercel deployment
  `dpl_kF3Cp1hELMMzet6r8cuuzbR8LKyb` is `READY` on exact commit
  `17c7b78eac63d81a004ce671da800d898d364f4a`.
- The build compiled 13 Workflow steps and two workflows, generated all routes,
  and deployed successfully in nine minutes.
- Live Render health is healthy and exposes both `/api/pipeline/process` and
  `/api/pipeline/stages/{stage}`; unauthenticated requests return `401`.
- The first URL ingestion failed loudly before data creation because Render
  lacked its optional URL override. The tested stable production URL fallback
  was deployed, and replay returned a durable Workflow run ID.
- The production build uses the enhanced machine, 11-GB Node heap, disabled
  non-reusable Webpack cache, and an enforced server-only Workflow boundary.

## Source Freshness Proof

- The verifier now creates separate PM and RAG Supabase clients.
- Source records and Graph state use the PM database.
- `source_sync_health_snapshots` and `document_chunks` use the RAG database.
- JSON output now propagates a nonzero process exit for degraded health.
- Four focused regression tests pass.
- Live read-only RAG coverage:
  - email chunks: 14,086
  - Teams message chunks: 36,007
  - meeting transcript chunks: 32,155
  - meeting segment summary chunks: 14,133
  - meeting summary chunks: 4,201
- The corrected live run exits `1` for genuine upstream source-sync
  degradation rather than falsely reporting missing chunks.
- Authenticated Render recompute completed, updated 25 snapshots, and routed
  one alert. Its 80 critical inputs group into 78 stale Teams resources, one
  Microsoft Graph resource about four hours stale, and one Acumatica resource
  blocked by the provider's missing payment-application GI/endpoint. The
  recomputed payload reports zero unembedded and zero uncompiled items for
  those groups; the degradation is upstream acquisition/provider freshness,
  not missing vector coverage.

## Workflow Credential Proof

- Backend enqueue prefers `RAG_PIPELINE_WORKFLOW_SECRET`.
- When the scoped secret is absent, backend enqueue uses the existing
  server-only `ADMIN_API_KEY` already shared with the Workflow stage boundary.
- Next.js accepts either configured server credential and compares the
  presented bearer token with `timingSafeEqual`.
- If neither credential exists, both sides fail with a specific configuration
  error rather than accepting an unauthenticated request.
- Focused backend tests: 5 passed.
- Workflow ownership/authentication contract: 9 passed.
- Normalized Outlook/Teams messages now skip vision, preventing an
  inappropriate provider call and preserving explicit vision for SharePoint
  and other Graph documents.
- Vercel build logs localized two distinct memory failures: a 7-GB V8 heap
  limit and a 14-GB heap that starved the 16-GB container while Webpack
  serialized its cache. The next deployment uses an 11-GB heap and disables
  Webpack cache on Vercel because the wrapper always deletes `.next` before
  compilation, making that cache impossible to reuse.
- A live Render vision-stage probe exposed a stale RAG mirror select:
  `rag_document_metadata` stores `storage_path`, not `file_path`. The loader
  now queries the PM database without `.single()` exception control flow,
  falls back only when the PM row is absent, selects the live RAG schema, and
  maps `storage_path` into the common classification shape.
- The first controlled URL ingestion then exposed live Render URL-env drift:
  neither `RAG_PIPELINE_WORKFLOW_URL` nor `FRONTEND_URL` was present. The
  workflow client now falls back to the stable Vercel production-project
  alias after checking both overrides; the dedicated override remains
  preferred. The fallback route was probed directly and rejects unauthenticated
  requests with `401`.

## End-to-End Proof

- Controlled document:
  `web_resource_4eb05ce7-b567-577f-b562-2b7bea5aae1f`, project `67`.
- Workflow run `wrun_01KYR3MKXQEHC80QFCB56TSD5F` completed in 27.7 seconds.
- Five steps completed on attempt one in exact order:
  `load → parse → vision → embed → extract`.
- Load selected the document parser and returned `raw_ingested`.
- Parse extracted 7,269 characters and one segment.
- Vision correctly skipped the non-PDF source.
- Embed persisted five chunks; production readback confirmed stored embeddings.
- Extract returned six insights, two decisions, two risks, and two
  opportunities.
- RAG metadata readback reported `parsing_status=segmented`,
  `embedding_status=embedded`, project `67`, and the source URL/title.
- Project- and source-scoped `search_document_chunks` returned the controlled
  document first with similarity and vector score `1.0`, including citation
  metadata.
