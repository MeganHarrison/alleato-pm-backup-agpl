# Alleato PM — Backend API Reference

## Interactive Documentation

FastAPI auto-generates interactive API docs. When the server is running:

- **Swagger UI:** [http://localhost:8051/docs](http://localhost:8051/docs)
- **ReDoc:** [http://localhost:8051/redoc](http://localhost:8051/redoc)
- **OpenAPI JSON:** [http://localhost:8051/openapi.json](http://localhost:8051/openapi.json)

These are the authoritative, always-up-to-date references. The summary below provides a quick overview.

---

## Endpoints Overview

### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns backend status and AI provider config |

### RAG Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Legacy keyword-based transcript lookup used by backend verification scripts |

Production assistant generation is owned by Eve under
`agents/alleato-assistant`. The Alleato app reaches Eve through the
authenticated Next.js proxy at
`frontend/src/app/api/ai-assistant/eve/proxy/[...path]/route.ts`. This backend
continues to own ingestion, processing stages, intelligence services, and
approved specialist/tool implementations; `/api/chat` is not the production
assistant runtime.

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | List all projects |
| `GET` | `/api/projects/{project_id}` | Get project details with open tasks |

### Ingestion

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ingest/fireflies/recent` | Ingest recent Fireflies meetings |

### Admin (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/documents/generate-embeddings` | Trigger embedding generation pipeline |
| `GET` | `/api/admin/documents/embedding-status/{task_id}` | Check embedding task status |
| `GET` | `/api/admin/documents/pipeline-stats` | Get document pipeline statistics |

### YokeFlow Agent Platform (`/yokeflow`)

Mounted as a sub-application. See YokeFlow-specific docs if available.

---

## Authentication & CORS

The API uses CORS-based access control for origin allowlisting. In addition, all
state-mutating endpoints require an `ADMIN_API_KEY` header.

**Allowed CORS origins:**
- `http://localhost:3000` / `http://127.0.0.1:3000`
- `http://localhost:3001` / `http://127.0.0.1:3001`
- `http://localhost:8080` / `http://127.0.0.1:8080`

**Admin API key authentication:**

The following endpoints require either:
- `Authorization: Bearer <ADMIN_API_KEY>`, or
- `X-Admin-Api-Key: <ADMIN_API_KEY>` header

Protected endpoints:
- All `/api/admin/*` routes
- `POST /api/ingest/fireflies/recent`
- `POST /api/graph/sync`
- `POST /api/intelligence/teams-compiler/run`

If `ADMIN_API_KEY` is not set in the environment, protected endpoints return `503`.

**Unprotected endpoints** (safe to expose publicly — read-only or triggered by Supabase):
- `GET /health`
- `GET /api/projects`, `GET /api/projects/{id}`
- `GET /api/digests/*`
- `GET /api/intelligence/teams-compiler/status`
- `POST /api/chat` (legacy, read-only)
- `POST /api/pipeline/stages/{stage}` (authenticated single-stage adapter; orchestration stays in Vercel Workflow)
- `POST /api/pipeline/stages/{stage}` (authenticated; called only by Vercel Workflow)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for agent workflows |
| `ADMIN_API_KEY` | Yes | Shared secret for all mutation endpoints |
| `USE_UNIFIED_AGENT` | No | Set to `"true"` to use unified agent instead of classification routing |

## Running the Server

```bash
cd backend
uvicorn src.api.main:app --host 0.0.0.0 --port 8051 --reload
```
