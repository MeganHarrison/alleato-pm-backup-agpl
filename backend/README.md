# Alleato Backend

The backend is the FastAPI execution layer for source ingestion, document
processing stages, project data, and scheduled integrations. It is deployed as
the Render service `alleato-backend`.

It is not the production AI assistant runtime. Eve, under
`agents/alleato-assistant`, owns assistant reasoning, skills, and tool
execution. Browser requests reach Eve through the authenticated Next.js proxy
at `/api/ai-assistant/eve/proxy/[...path]`.

## Runtime ownership

| Concern | Sole owner |
| --- | --- |
| Assistant runtime, skills, and tool execution | `agents/alleato-assistant` |
| Browser-to-Eve authentication and proxying | `frontend/src/app/api/ai-assistant/eve/proxy/[...path]` |
| Durable RAG ordering and retries | `frontend/src/lib/rag-pipeline/process-document-workflow.ts` |
| Workflow ingress | `frontend/src/app/api/rag-pipeline/process/route.ts` |
| Single RAG stage execution | `backend/src/services/pipeline/stage_runner.py` |
| Backend-to-Workflow enqueue | `backend/src/services/pipeline/workflow_client.py` |
| Source ingestion and scheduled sync | FastAPI services under `backend/src/services` |
| Retrieval and citation tools | Eve tool registry and its RAG client |

The durable document sequence is exactly:

```text
load -> parse -> vision -> embed -> extract
```

Vercel Workflow is the only component allowed to order or retry those stages.
FastAPI's `/api/pipeline/process` endpoint is compatibility ingress only: it
authenticates the caller, starts the Workflow, and returns its durable `runId`.
It never performs in-process orchestration.

## RAG request flow

```text
Source adapter or admin action
  -> backend workflow_client.enqueue_document_workflow()
  -> authenticated POST /api/rag-pipeline/process
  -> Vercel Workflow durable run
  -> authenticated POST /api/pipeline/stages/{stage}
  -> one FastAPI stage
  -> document metadata, chunks, embeddings, and structured extraction in Supabase
```

Each stage adapter executes only the requested stage. It does not enqueue the
next stage and does not retry the entire pipeline.

## Source ingestion

FastAPI owns acquisition and normalization for:

- Fireflies transcripts
- Microsoft Graph Outlook and Teams content
- OneDrive documents
- drawing OCR through Azure Document Intelligence
- URL resources
- manual and administrative reprocessing

After a source record is materialized, the source adapter enqueues the durable
Workflow and records the returned run ID. Scheduled Microsoft Graph ingestion
performs OCR before enqueue when the source requires it; vision remains an
explicit Workflow stage.

Drawing OCR text is stored in `document_metadata.content`. Drawing-upload
records use `source_system='drawing_upload'`, `document_type='drawing'`, and a
Supabase Storage URL. See `docs/architecture/OCR-PIPELINE.md` before changing
that path.

## Key pipeline modules

```text
backend/src/
├── api/
│   ├── main.py                         # FastAPI app, protected workflow ingress/stages
│   └── admin_endpoints.py              # Protected repair and replay operations
├── services/
│   ├── ingestion/
│   │   ├── fireflies_pipeline.py       # Fireflies acquisition and workflow enqueue
│   │   └── sync_followups.py           # Scheduled follow-up processing
│   ├── integrations/
│   │   └── microsoft_graph/
│   │       ├── sync.py                 # Source sync and post-OCR enqueue
│   │       ├── embed.py                # Graph normalization/repair helpers
│   │       └── ocr_worker.py           # Azure Document Intelligence OCR
│   ├── pipeline/
│   │   ├── document_parser.py          # Document parsing
│   │   ├── embedder.py                 # Chunking and embedding
│   │   ├── extractor.py                # Structured fact extraction
│   │   ├── stage_runner.py             # One named stage per call
│   │   └── workflow_client.py          # Authenticated Workflow starter
│   └── url_resource_ingestion.py       # URL acquisition and workflow enqueue
└── scripts/                            # Explicit repair/backfill utilities
```

The removed `pipeline/orchestrator.py`, `pipeline/digest.py`, and
`ingestion/fireflies_reprocessing.py` modules are not runtime owners and must
not be restored.

## Authentication

The following endpoints require `ADMIN_API_KEY` via `Authorization: Bearer ...`
or `X-Admin-API-Key`:

- `/api/admin/*`
- `/api/pipeline/process`
- `/api/pipeline/stages/{stage}`
- Fireflies ingestion endpoints
- Microsoft Graph sync endpoints
- Teams compiler execution

Protected endpoints fail with `503` when the server key is absent and reject
invalid credentials. The Workflow ingress separately requires
`RAG_PIPELINE_WORKFLOW_SECRET`.

## Provider configuration

The primary embedding/provider path on Render uses `AI_GATEWAY_API_KEY`.
`OPENAI_API_KEY` is a direct-provider fallback and may be quota-limited. BYOK
for Eve assistant requests does not transfer ownership of ingestion or durable
RAG orchestration; it only selects credentials for model calls that support
that path.

Required pipeline configuration includes:

| Variable | Runtime | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Render | Primary AI Gateway provider credential |
| `OPENAI_API_KEY` | Render | Direct OpenAI fallback |
| `ADMIN_API_KEY` | Render and Vercel | Authenticates Workflow stage calls |
| `RAG_PIPELINE_WORKFLOW_SECRET` | Render and Vercel | Authenticates Workflow enqueue |
| `RAG_PIPELINE_WORKFLOW_URL` or `FRONTEND_URL` | Render | Resolves Workflow ingress |
| `BACKEND_URL` or `PYTHON_BACKEND_URL` | Vercel | Resolves FastAPI stage adapter |
| `SUPABASE_URL` | Render | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Render | Service database access |

Never print or commit secret values.

## Local development

From `backend/`:

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.api.main:app --reload --port 8000
```

Health check:

```text
GET http://localhost:8000/health
```

Focused RAG verification from the repository root:

```bash
node --test scripts/verify/__tests__/rag-workflow-ownership-contract.test.mjs
node --test scripts/verify/__tests__/rag-pipeline-callers-auth-contract.test.mjs
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_pipeline_stage_runner.py backend/tests/test_pipeline_workflow_client.py -q
```

## Failure behavior

- Missing configuration raises an explicit error; it does not silently switch
  runtime owners.
- Workflow enqueue is accepted only when a non-empty `runId` is returned.
- Permanent 4xx stage failures are not retried as transient failures.
- Source adapters record queue state and durable run IDs for operational
  traceability.
- Compatibility ingress cannot call the stage runner.
- Contract tests fail if a deleted in-process orchestrator or unauthenticated
  caller is reintroduced.

For complete product behavior, tools, skills, citations, lifecycle, and legacy
status, use:

- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- the authoritative `AI-ASSISTANT-FUNCTIONALITY-CATALOG.md` and
  `RAG-PIPELINE-OWNERSHIP.md` architecture records in the
  `The-Alleato-Group/alleato-pm-backup` documentation repository
