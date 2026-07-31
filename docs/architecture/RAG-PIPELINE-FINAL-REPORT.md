# RAG Pipeline Final Implementation Report

**Completed:** 2026-07-30

**Canonical repository:** `The-Alleato-Group/project-management`

**Assistant owner:** Eve (`agents/alleato-assistant`)

**Durable pipeline owner:** Vercel Workflow

## Final verdict

The common RAG pipeline is implemented, deployed, and production-proven.

- Vercel Workflow is the sole durable ordering and retry owner.
- Render/FastAPI executes exactly one authenticated stage per callback.
- Supabase owns canonical records, stored content, chunks, embeddings, and
  retrieval.
- Source adapters own acquisition and persistence before workflow start.
- Project-intelligence services own derived packets and scheduled projections.
- Eve owns assistant generation and consumes authorized retrieval; Eve does not
  own ingestion.
- Vercel AI Gateway is the primary model/embedding provider path. Direct OpenAI
  is fallback only.

Production deployment `dpl_kF3Cp1hELMMzet6r8cuuzbR8LKyb` is `READY` on commit
`17c7b78eac63d81a004ce671da800d898d364f4a`.

## Production proof

Controlled input:

- source: RFC 2606 text URL
- project: `67`
- document:
  `web_resource_4eb05ce7-b567-577f-b562-2b7bea5aae1f`
- workflow: `wrun_01KYR3MKXQEHC80QFCB56TSD5F`

The workflow completed in 27.7 seconds. Every step completed on attempt one:

| Order | Stage | Result |
| ---: | --- | --- |
| 1 | `load` | `raw_ingested`, project `67`, document parser selected |
| 2 | `parse` | 7,269 characters, one segment, 1,200-character summary |
| 3 | `vision` | Correctly skipped because the source was not a PDF |
| 4 | embed stage | Five chunks, all with stored embeddings |
| 5 | `extract` | Six insights, two decisions, two risks, two opportunities |

Stored-state proof:

- `parsing_status=segmented`
- `embedding_status=embedded`
- five `document_chunks`
- every sampled chunk had an embedding
- project ID `67` persisted in document and chunk metadata
- source title and source URL persisted

Retrieval proof:

- RPC: `search_document_chunks`
- project filter: `67`
- source-type filter: "document"
- top result: the controlled document
- similarity: `1.0`
- vector score: `1.0`
- citation title/project/content hash returned with the result

## Runtime ownership

| Boundary | Owner | What it does |
| --- | --- | --- |
| Fireflies/Graph/Teams/uploads/URLs | Source adapters | Authenticate, acquire, resolve project, persist, enqueue |
| Durable order/retry | Vercel Workflow | `load → parse → vision → embed → extract` |
| Stage algorithms | FastAPI on Render | Executes one named stage; never orchestrates all stages |
| Drawing OCR | Azure Document Intelligence | Writes drawing text to `document_metadata.content` |
| Records and artifacts | PM Supabase/Storage | Application document identity and binary artifacts |
| Chunks and vectors | RAG Supabase/pgvector | Embedded chunks and scoped search RPC |
| Derived intelligence | Project-intelligence services | Packets, summaries, risks, decisions, actions |
| Retrieval authorization | Next.js tool layer | User/project/source scoping and citations |
| Assistant answers | Eve | Skill-guided synthesis over authorized tools/evidence |
| Providers | Vercel AI Gateway | Primary model and embedding transport |

## Relevant file tree

```text
agents/alleato-assistant/
├── agent.py
├── server.py
├── tool_client.py
└── skills/
    ├── business-development/
    ├── financial/
    ├── marketing/
    ├── operations/
    ├── people/
    └── risk/

frontend/src/
├── app/api/ai-assistant/eve/
│   ├── proxy/[...path]/
│   └── tools/route.ts
├── app/api/rag-pipeline/process/route.ts
├── lib/rag-pipeline/
│   ├── enqueue.ts
│   └── process-document-workflow.ts
└── lib/documents/
    ├── pattern-c-attachments.ts
    ├── pattern-c-attachments.server.ts
    └── pipeline-trigger.ts

backend/src/
├── api/main.py
└── services/
    ├── pipeline/
    │   ├── workflow_client.py
    │   └── stage_runner.py
    ├── ingestion/
    ├── integrations/microsoft_graph/
    ├── project_intelligence/
    └── url_resource_ingestion.py

scripts/verify/
├── verify_integration_health.py
└── __tests__/rag-workflow-ownership-contract.test.mjs

docs/architecture/
├── AI-ASSISTANT-FUNCTIONALITY.md
├── AI-ASSISTANT-FUNCTIONALITY-CATALOG.md
├── AI-RAG-ARCHITECTURE.md
├── RAG-PIPELINE-OWNERSHIP.md
└── RAG-PIPELINE-FINAL-REPORT.md
```

## Improvements over the former setup

1. **One durable owner.** The old Python in-process orchestrator, reprocessor,
   digest chain, and competing frontend generator are no longer allowed to own
   ordering.
2. **Retries survive process restarts.** Vercel Workflow persists run and step
   state instead of relying on one Render process.
3. **Single-stage backend contract.** FastAPI cannot silently start a second
   orchestration loop.
4. **Authenticated boundaries.** Workflow ingress and stage callbacks reject
   missing or invalid server credentials.
5. **Server/client isolation.** The Workflow SDK is protected by `server-only`
   modules; browser-safe attachment helpers cannot import it.
6. **Dual-database correctness.** PM document lookup and RAG mirror fallback use
   their real schemas; RAG `storage_path` is explicitly mapped.
7. **Provider resilience.** The scoped workflow secret is preferred, the
   server admin credential is a compatibility fallback, and the stable
   production URL prevents a missing optional Render URL override from stopping
   ingestion.
8. **Source-aware vision.** Outlook/Teams communications skip inappropriate
   vision work; PDFs and drawing/document sources retain explicit vision/OCR.
9. **Honest health checks.** PM source state and RAG chunks use separate clients;
   JSON verification exits nonzero when health is degraded.
10. **Cold-build stability.** Vercel uses an enhanced build machine, an
    11-GB Node heap, and no unusable filesystem cache serialization.
11. **Regression guardrails.** Ownership, order, auth, stage purity, build
    boundaries, metadata fallback, and source-health failure behavior have
    focused tests.

## Verification summary

- Workflow ownership contracts: 11 passed.
- Workflow client tests: 5 passed.
- Stage-runner tests: 4 passed.
- Earlier focused backend regression set: 29 passed, one Windows-only skip.
- Changed-route guardrails: 10 routes checked, zero raw/unstructured failures.
- Route conflict check: passed.
- Vercel production build: passed.
- Five-step production workflow: completed.
- Stored embedding proof: passed.
- Project-scoped vector retrieval and citation proof: passed.
- Independent review: approved.

## Remaining legacy and operational work

The migration itself is complete. These are intentionally separate:

- Eve writes and external delivery remain blocked until permission, approval,
  idempotency, and receipt contracts are proven.
- The retired Teams and false Graph-freshness alerts are fixed. Production
  recompute now reports 61 current sources and five actionable alerts.
- Fifty-seven SharePoint project folders await initial inventory; 2,036 sampled
  documents lack chunks; one Graph subscription is outside the configured
  target set; and 282 searchable SharePoint documents are missing project
  Documents promotion.
- The Graph embedding backlog runner now honors its configured 100-document
  batch instead of silently clamping each scheduled cycle to 25. AI Gateway
  and the required $10 daily model budget remain the hard provider/cost guards.
- Acumatica remains blocked by the provider's missing payment-application
  GI/endpoint.
- Fresh one-record traces should be repeated when Fireflies, Graph, drawing OCR,
  or manual-upload acquisition code changes.
- Historical eval/help files that refer to deleted frontend specialist agents
  should remain cleanup targets and must never be interpreted as runtime owners.

These remaining items do not create another RAG owner and do not invalidate the
production-proven common pipeline.
