# Eve and RAG Pipeline Implementation Report

**Date:** 2026-07-29

**Task:** AAI-1280

**Repository:** `MeganHarrison/alleato-pm-backup`

**Status:** Backup implementation and live-data verification complete;
canonical production deployment verification remains open

## Executive summary

The backup repository now has one assistant runtime, Eve, and one durable
document-processing owner, Vercel Workflow. FastAPI executes authenticated,
single-stage adapters; it no longer owns hidden ordering or retries. Retrieval
is project-scoped and source-attributed, and the Vercel AI Gateway is the
primary model and embedding provider.

The implementation has been proven against live data:

- a bounded Microsoft Graph acquisition synchronized 21 Outlook and 33 Teams-DM
  records with zero errors;
- a newly acquired Outlook record completed source-aware processing, produced
  one readable embedded chunk, and became the top authorized retrieval result;
- a seven-page SharePoint PDF completed the explicit vision stage and persisted
  three text chunks plus seven page-intelligence chunks;
- embedding did not secretly invoke vision;
- all counted chunks had embeddings; and
- project, source, communication, Business Area, and leadership restrictions
  passed the focused retrieval contract.

This report does not claim canonical production cutover. The canonical
production repository and live Vercel/Render route probes still lack the new
Eve and Workflow contracts.

## Runtime ownership

| Responsibility | Sole owner |
| --- | --- |
| Assistant answer generation and streaming | `agents/alleato-assistant` (Eve) |
| App authentication and durable assistant-turn binding | Next.js Eve proxy |
| Eve tool discovery and execution | Authenticated request-scoped tool bridge |
| Document ordering and retries | Vercel Workflow |
| Parse, vision, embed, and extract execution | Authenticated FastAPI stage adapters |
| Source acquisition schedules | Dedicated Render source services |
| Canonical documents and workflow status | PM Supabase |
| Chunks and vectors | RAG Supabase |
| Retrieval and authorization | Canonical Next.js RAG read tools |
| Model and embedding provider | Vercel AI Gateway; direct OpenAI is fallback only |

Eve consumes retrieval. It does not ingest, OCR, parse, embed, schedule source
jobs, or own document-processing retries.

## Implementation tree

```text
agents/alleato-assistant/
|-- agent/
|   |-- agent.ts
|   |-- channels/eve.ts
|   |-- lib/auth.ts
|   |-- skills/
|   |   |-- business-development.md
|   |   |-- financial-analysis.md
|   |   |-- marketing-strategy.md
|   |   |-- operations-review.md
|   |   |-- people-capacity.md
|   |   `-- risk-review.md
|   `-- tools/
`-- package.json

frontend/src/
|-- app/api/
|   |-- ai-assistant/eve/
|   |   |-- proxy/[...path]/
|   |   `-- tools/route.ts
|   `-- rag-pipeline/process/route.ts
|-- components/
|   |-- ai-assistant/
|   `-- chat/
`-- lib/
    |-- ai/
    |   |-- eve-runtime/
    |   `-- tools/
    |       |-- guardrails.ts
    |       `-- read/rag-search-tools.ts
    `-- rag-pipeline/
        |-- enqueue.ts
        `-- process-document-workflow.ts

backend/src/
|-- api/main.py
`-- services/
    |-- pipeline/
    |   |-- stage_runner.py
    |   `-- workflow_client.py
    `-- integrations/
        `-- microsoft_graph/
            |-- embed.py
            `-- ocr_worker.py

scripts/
|-- ops/
|   |-- reconcile-render-rag-crons.mjs
|   `-- requeue-vision-analysis.mjs
|-- rag/detect-under-embedded-docs.mjs
|-- verify/
|   |-- verify_rag_chunk_integrity.mjs
|   |-- verify_rag_retrieval_contract.mjs
|   |-- verify_render_ai_gateway_health.mjs
|   |-- verify_render_rag_cron_health.mjs
|   `-- __tests__/
|       |-- rag-pipeline-callers-auth-contract.test.mjs
|       `-- rag-workflow-ownership-contract.test.mjs
`-- jobplanner/import-submittal-documents.mjs

.github/workflows/
`-- rag-pipeline-ops.yml

docs/architecture/
|-- AI-ASSISTANT-FUNCTIONALITY.md
|-- AI-RAG-ARCHITECTURE.md
`-- RAG-PIPELINE-OWNERSHIP.md
```

## Improvements and benefits

### One durable ordering owner

Previously, orchestration behavior could be started in-process or hidden inside
another stage. The ordered sequence is now explicit:

`load -> parse -> vision -> embed -> extract -> complete`

Benefits:

- deterministic retries;
- one place to inspect stage order;
- no duplicate or nested orchestration;
- stage-specific error recovery; and
- durable run identifiers instead of process-local work.

### Pure, independently retryable stages

The embedding adapter no longer invokes vision analysis. The vision adapter
owns page intelligence for eligible PDFs, while source-aware routing skips
irrelevant stages for normalized communications.

Benefits:

- retrying embedding cannot unexpectedly rerun costly vision work;
- latency and provider cost are easier to attribute;
- each stage can fail loudly with its own owner and recovery; and
- Outlook and Teams records avoid inappropriate generic document extraction.

### Persisted-source routing matches real data

The stage classifier now recognizes actual stored aliases including
`outlook_email`, `outlook_attachment`, and `teams_dm`.

Benefits:

- communications follow their normalized Graph path;
- false extraction errors are removed;
- fewer unnecessary provider calls; and
- routing tests cover the production-shaped values that caused the defect.

### Authenticated compatibility and stage boundaries

The compatibility ingress requires `ADMIN_API_KEY`, delegates only to the
Workflow owner, and all audited operator callers send the required credential.
Workflow-to-FastAPI stage calls use a separate authenticated boundary.

Benefits:

- no unauthenticated processing trigger;
- operator failures name the missing credential;
- compatibility cannot become a second orchestrator; and
- caller regressions fail in focused tests.

### Scoped retrieval and citations

Retrieval is bound to verified server-owned project context and applies
project, Business Area, communication, and leadership restrictions before
returning source-attributed evidence.

Benefits:

- user text cannot override authorization scope;
- evidence retains document/source identity;
- communications do not leak through broad semantic search; and
- retrieval behavior is independently testable from answer generation.

### Provider consolidation

Vercel AI Gateway is the primary provider for model and embedding traffic.
Direct OpenAI is fallback-only.

Benefits:

- centralized billing and provider visibility;
- simpler key ownership;
- a controlled fallback rather than competing provider paths; and
- health verification can name the active provider without exposing secrets.

### Legacy removal

The deleted Next.js generator, specialist-agent tree, orchestrator, and
`bot-core` are no longer runtime owners. Eve contains one root assistant with
six authored reasoning skills.

Benefits:

- one generation path;
- less duplicated policy and prompt behavior;
- simpler debugging; and
- documentation can distinguish reasoning skills from permissions and tools.

## Verification evidence

| Boundary | Result |
| --- | --- |
| Eve-only runtime guard | Pass |
| Canonical assistant tool documentation | Pass: 131/131 documented |
| Eve bridge exposure | Pass: 79 reads; 52 writes/delivery functions excluded |
| Workflow ownership contract | Pass: 7 focused assertions |
| Compatibility caller authentication | Pass: 4 focused assertions |
| Backend Python compile | Pass |
| Chunk and embedding integrity | Pass: zero counted chunks missing embeddings |
| AI provider health | Pass: Vercel AI Gateway primary |
| Controlled Graph acquisition | Pass: 54 records, zero errors |
| New Outlook processing trace | Pass: one appropriate embedded chunk |
| New Outlook scoped retrieval | Pass: top authorized result with metadata references |
| SharePoint PDF stage purity | Pass: 3 text + 7 vision-page chunks |
| App Expert generated registries | Pass: 364 routes/features, no retired route |
| Deployed Eve proxy and Workflow ingress | Pending: production probes returned 404 |
| Deployed FastAPI stage adapter | Pending: live OpenAPI lacks the stage route |
| Scheduled Render owner readback | Pending: Render control-plane credential unavailable |
| Visible deployed Eve citation | Pending until the deployment contracts exist |

## Independent review

An independent Codex reviewer first returned `NEEDS_REWORK` because three paths
in the implementation tree did not match the repository. After the tree was
rebuilt from the filesystem, the reviewer reran an exact `Test-Path` sweep over
every listed entry and returned `APPROVED` for publication on 2026-07-29.

The review also reran or inspected:

- the seven-test Workflow ownership contract;
- the four-test compatibility-caller authentication contract;
- the Eve-only runtime guard;
- the canonical 131-tool registry assertion; and
- the report's explicit limitation that canonical production deployment remains
  open.

## Remaining limitations and exact next actions

1. Publish the cutover into the canonical production repository or deliberately
   designate this repository as the deployable source of truth.
2. Supply authenticated Render control-plane access to CI, then deploy and read
   back `/api/pipeline/stages/{stage}`.
3. Verify every scheduled source owner is configured and unsuspended; reconcile
   only the named service when it is not.
4. Deploy the Next.js Eve proxy and Workflow ingress and verify their route
   contracts.
5. Run one deployed acquisition-to-citation trace that records the Workflow
   `runId`, every stage result, persisted chunk IDs, scoped retrieval result,
   and the citation rendered by Eve.

## Failure accounting

- **Cause:** the completed cutover lives in a backup repository that is
  thousands of commits divergent from the canonical production repository, and
  the available credential set cannot mutate or read the Render control plane.
- **Detection gap:** earlier checks proved provider, vectors, and retrieval but
  did not first assert the deployed Eve/Workflow/stage routes.
- **Prevention:** retain route readback, source-owner readback, ownership
  contract tests, caller-auth tests, and one deployed source-to-citation trace
  as mandatory release evidence.

## Detailed capability reference

Every AI Assistant surface, Eve skill, read function, unavailable action,
adjacent AI feature, RAG source, security boundary, provider, and retired path
is cataloged in `docs/architecture/AI-ASSISTANT-FUNCTIONALITY.md`.
