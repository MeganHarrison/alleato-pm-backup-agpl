# Alleato PM — Backend

> **Last updated:** 2026-05-02
>
> This README explains what every folder and file does, how the RAG pipeline works end-to-end, and every known fragility or risk in the current setup.
> If you are new to this codebase, read this top-to-bottom before touching anything.

---

## Table of Contents

1. [What This Service Actually Does](#1-what-this-service-actually-does)
2. [Folder Structure — Every File Explained](#2-folder-structure--every-file-explained)
3. [How the RAG Pipeline Works](#3-how-the-rag-pipeline-works)
4. [Embedding Architecture](#4-embedding-architecture)
5. [Data Flow: Ingestion Path](#5-data-flow-ingestion-path)
6. [Data Flow: Query / Retrieval Path](#6-data-flow-query--retrieval-path)
7. [Identified Risks and Fragilities](#7-identified-risks-and-fragilities)
8. [Running the Server](#8-running-the-server)
9. [Environment Variables](#9-environment-variables)

---

## 1. What This Service Actually Does

**The backend is a Python FastAPI service responsible for:**

- **Ingesting** meeting transcripts from Fireflies.ai into the database
- **Embedding** document chunks into pgvector-compatible vectors (stored in Supabase)
- **Syncing** email and Teams messages from Microsoft Graph into the database
- **Running** scheduled background jobs (source sync, embeddings, task extraction, project summary generation)
- **Exposing** a small admin API for triggering pipeline tasks manually

**The backend does NOT handle:**
- Production assistant generation (owned by Eve at
  `agents/alleato-assistant`; the app proxy is
  `frontend/src/app/api/ai-assistant/eve/proxy/[...path]/route.ts`)
- User authentication (handled by Supabase Auth + Next.js middleware)
- Any Procore construction management features (all in the Next.js frontend)

---

## 2. Folder Structure — Every File Explained

```
backend/
├── src/
│   ├── api/                          # FastAPI app entry point
│   │   ├── main.py                   # App factory, route registration, CORS setup
│   │   ├── admin_endpoints.py        # Admin REST endpoints (/api/admin/*)
│   │   └── server.cpython-*          # Compiled bytecode — safe to ignore
│   │
│   ├── scripts/                      # One-off data migration / backfill scripts
│   │   ├── backfill_3072_embeddings.py              # Re-embed all chunks at 3072 dims
│   │   ├── backfill_missing_chunk_embeddings.py     # Find and fill null-embedding chunks
│   │   ├── backfill_missing_embeddings.py           # Generic missing-embedding backfill
│   │   ├── backfill_segment_embeddings.py           # Embed transcript segments
│   │   ├── backfill_tasks_quality.py                # Quality-score existing tasks
│   │   ├── backfill_transcript_chunks.py            # Re-chunk existing transcripts
│   │   ├── clean_and_reingest.py                    # Wipe + re-ingest a document
│   │   ├── create_test_data.py                      # Seed test fixtures
│   │   ├── eval_seed_test_cases.py                  # Seed RAG eval test cases
│   │   ├── execute_vector_fix.py                    # Fix corrupted vector data
│   │   ├── fix_document_statuses.py                 # Repair stuck document statuses
│   │   ├── fix_vector_search_functions.py           # Redeploy RPC functions to Supabase
│   │   ├── list_projects.py                         # Print all project IDs/names
│   │   ├── process_existing_documents.py            # Re-run pipeline on existing docs
│   │   ├── quick_status_fix.py                      # Patch specific document statuses
│   │   ├── rag_answer_eval.py                       # Evaluate LLM answer quality
│   │   ├── rag_chatkit_server*.py                   # OLD: standalone RAG chat server (deprecated)
│   │   ├── rag_e2e_eval.py                          # End-to-end RAG evaluation
│   │   ├── rag_eval.py                              # Batch RAG retrieval evaluation
│   │   ├── rag_reranker_eval.py                     # Evaluate LLM reranker quality
│   │   ├── rag_source_coverage.py                   # Check source type distribution
│   │   ├── refresh_fireflies_transcripts.py         # Re-fetch transcripts from Fireflies API
│   │   ├── replay_fireflies_jobs_direct.py          # Replay failed Fireflies ingestion jobs
│   │   ├── replay_stale_raw_ingested.py             # Re-process stale raw_ingested docs
│   │   ├── update_chunk_embeddings.py               # Batch update embeddings
│   │   ├── update_document_status.py                # Manually set a document's status
│   │   ├── update_done_to_complete.py               # Rename "done" → "complete" status values
│   │   ├── update_embedding_dimensions.py           # Alter embedding column dimensions
│   │   └── sql/                                     # Raw SQL for vector function deployment
│   │       ├── check_vector_dimensions.sql          # Audit which columns have which dims
│   │       ├── create_vector_search_functions.sql   # Original RPC function definitions
│   │       ├── create_vector_search_functions_fixed.sql  # Fixed version (dimension mismatch fix)
│   │       ├── create_vector_search_functions_no_dims.sql  # Version without explicit dims
│   │       └── fix_vector_dimensions.sql            # Alter existing columns to 3072 dims
│   │
│   ├── services/
│   │   ├── acumatica_sync.py         # Sync financial data from Acumatica ERP → Supabase
│   │   ├── email_service.py          # Send emails via SMTP/SendGrid
│   │   ├── env_loader.py             # Load .env with fallback logic
│   │   ├── memory_store.py           # In-memory KV cache (used by pipeline)
│   │   ├── scheduler.py              # APScheduler job definitions and registration
│   │   ├── supabase_helpers.py       # Supabase client factory + typed query helpers
│   │   │
│   │   ├── ingestion/                # Document ingestion pipeline
│   │   │   ├── __init__.py
│   │   │   ├── fireflies_pipeline.py        # Fireflies → document_metadata + document_chunks
│   │   │   ├── project_assignment.py        # Assign meetings to projects via LLM
│   │   │   └── communication_project_backfill.py  # Backfill project links for emails/Teams
│   │   │
│   │   ├── insights/                 # TypeScript insight generation service (not Python)
│   │   │   ├── InsightGenerationService.ts  # Generate AI insights from project data
│   │   │   ├── ProjectAssignmentService.ts  # Assign insights to projects
│   │   │   ├── ProjectsInsightsService.ts   # Query and serve project insights
│   │   │   ├── api.ts                        # REST API wrapper for insights
│   │   │   ├── insights.ts                   # Core insight types and logic
│   │   │   ├── prompts.ts                    # LLM prompts for insight generation
│   │   │   └── validators.ts                 # Zod schemas for insight validation
│   │   │
│   │   ├── integrations/
│   │   │   └── microsoft_graph/      # Microsoft 365 (Outlook + Teams + OneDrive) sync
│   │   │       ├── client.py                # MS Graph API client (OAuth + token refresh)
│   │   │       ├── embed.py                 # Embed emails/Teams messages → document_chunks
│   │   │       ├── onedrive.py              # Sync OneDrive files
│   │   │       ├── outlook.py               # Sync Outlook emails
│   │   │       ├── teams.py                 # Sync Teams channels + DMs + channel messages
│   │   │       ├── sync.py                  # Orchestrator: runs all MS Graph syncs
│   │   │       ├── project_inference.py     # Infer project from email/Teams context via LLM
│   │   │       └── cli_extract_attachment_text.py  # CLI tool for extracting attachment text
│   │   │
│   │   ├── intelligence/             # Intelligence packet compilation
│   │   │   ├── client.py             # HTTP client for calling the intelligence API
│   │   │   ├── prompts.py            # LLM prompts for intelligence synthesis
│   │   │   └── teams_compiler.py     # Compile Teams messages → structured intelligence
│   │   │
│   │   ├── pipeline/                 # Core document processing pipeline
│   │   │   ├── config.py             # Pipeline configuration constants
│   │   │   ├── document_parser.py    # Parse raw documents (PDF, DOCX, HTML, text)
│   │   │   ├── embedder.py           # Generate + store embeddings (calls OpenAI)
│   │   │   ├── extractor.py          # Extract structured data (tasks, decisions) from text
│   │   │   ├── financial_parser.py   # Parse financial documents (invoices, budgets)
│   │   │   ├── llm.py                # LLM client wrapper (OpenAI completions)
│   │   │   ├── models.py             # Pydantic models for pipeline data structures
│   │   │   ├── stage_runner.py        # Authenticated stage dispatcher called by Vercel Workflow
│   │   │   ├── workflow_client.py     # Enqueues the durable Vercel Workflow
│   │   │   └── parser.py              # Text cleaning and pre-processing utilities
│   │   │
│   │   └── rfi_agent/
│   │       └── rfi_agent.ts          # TypeScript RFI agent (standalone, not connected to pipeline)
│   │
│   └── __init__.py
│
├── scripts/                          # Operational scripts (run from command line)
│   ├── extract_meeting_insights.py           # Extract insights from processed meetings
│   ├── extract_tasks_from_meetings.py        # Extract action items from meeting transcripts
│   ├── generate_project_summaries_batch.py   # Batch-generate project summaries
│   ├── generate_project_summary.py           # Generate one project's summary
│   ├── import_budget_from_excel.py           # Import budget data from Excel files
│   ├── migrate_to_insights.py                # Migrate from old format → ai_insights table
│   ├── preview_budget.py                     # Preview an Excel budget before importing
│   ├── reprocess_recent_fireflies_tasks.py   # Re-extract tasks from recent meetings
│   ├── run_acumatica_financial_sync.py        # Trigger Acumatica → Supabase sync
│   ├── seed_cost_codes.py                    # Seed cost code data
│   ├── validate_schema.py                    # Validate DB schema matches expected shape
│   ├── vermillion_budget_import.sql          # One-off SQL for Vermillion budget import
│   └── check_schema.sh                       # Bash schema checker
│
├── tests/                            # Pytest test suite
│   ├── conftest.py                   # Shared fixtures (Supabase client, mock data)
│   ├── test_api_routes.py            # Tests for all FastAPI routes
│   ├── test_chat_api.py              # Tests for /api/chat legacy endpoint
│   ├── test_cors.py                  # Tests for CORS headers
│   ├── test_fireflies_action_items.py # Tests for action item extraction
│   ├── test_health.py                # Tests for /health endpoint
│   ├── test_ingestion.py             # Tests for Fireflies ingestion pipeline
│   ├── test_pipeline_config.py       # Tests for pipeline config values
│   ├── test_pipeline_constants.py    # Tests for pipeline constants
│   ├── test_project_assignment.py    # Tests for project assignment logic
│   └── test_projects_api.py          # Tests for /api/projects endpoints
│
├── API.md                  # REST endpoint reference (quick overview)
├── Dockerfile              # Production Docker image (Python 3.13, uvicorn)
├── conftest.py             # Root-level pytest configuration
├── api.py                  # Thin entrypoint (imports and runs src.api.main)
├── entrypoint.py           # Production entrypoint with health-check loop
├── deploy.sh               # Deployment helper script (Render.com)
├── render.yaml             # Render.com service config
├── nginx.conf              # Nginx reverse proxy config (for Docker production)
├── docker-compose.yml      # Local Docker Compose setup
├── docker-compose.production.yml  # Production Docker Compose
├── requirements.txt        # Python dependencies
├── pytest.ini              # Pytest settings
└── .env.production.template  # Template for production environment variables
```

> **Note on mixed TypeScript files:** `src/services/insights/*.ts` and `src/services/rfi_agent/rfi_agent.ts` are TypeScript files living inside the Python backend folder. They are NOT run by the Python server — they appear to be standalone scripts or prototypes that were never integrated. This is confusing and should be moved to the frontend or deleted if unused.

---

## 3. How the RAG Pipeline Works

The RAG system has two phases: **ingestion** (writing data in) and **retrieval** (reading data out for the AI chat). They run independently.

### Phase 1 — Ingestion (Python backend)

```
External Source
  ├── Fireflies.ai (meeting transcripts)
  │     └── POST /api/ingest/fireflies/recent
  │           → fireflies_pipeline.py
  │               → fetch transcript from Fireflies API
  │               → parse + clean text
  │               → split into chunks (pipeline/parser.py)
  │               → generate embeddings (pipeline/embedder.py → OpenAI text-embedding-3-large)
  │               → store in document_metadata + document_chunks (Supabase)
  │               → project_assignment.py → LLM infers which project this meeting belongs to
  │
  ├── Microsoft Outlook (emails)
  │     └── MS Graph sync job (scheduler.py or manual via scripts/)
  │           → outlook.py → fetch emails via Microsoft Graph API
  │           → embed.py → generate embeddings + write to document_chunks
  │           → project_inference.py → LLM assigns email to a project
  │
  ├── Microsoft Teams (channels, DMs, messages)
  │     └── teams.py → fetch Teams messages
  │           → embed.py → generate embeddings + write to document_chunks
  │
  └── OneDrive (files)
        └── onedrive.py → fetch files → document_parser.py parses content
              → embedder.py → generate embeddings + write to document_chunks
```

### Phase 2 — Retrieval and Assistant Generation

Eve is the production assistant generator. Next.js owns the authenticated Eve
proxy and request-scoped read-only tool bridge. Retrieval may read directly
through app-owned tools or approved backend intelligence services. The Python
backend does not own the assistant conversation runtime.

---

## 4. Embedding Architecture

### The Key Tables

| Table | Rows (approx) | Embedding Column | Dimensions | Model |
|-------|--------------|-----------------|-----------|-------|
| `document_chunks` | 24,000+ | `embedding` | `halfvec(3072)` | `text-embedding-3-large` |
| `document_metadata` | — | `summary_embedding` | `halfvec(3072)` | `text-embedding-3-large` |
| `ai_memories` | — | `embedding` | `halfvec(3072)` | `text-embedding-3-large` |
| `company_knowledge` | — | `embedding` | `halfvec(3072)` | `text-embedding-3-large` |
| `ai_insights` | — | searched via `search_all_knowledge` RPC | — | — |

All embeddings use `halfvec` (16-bit float) to halve storage vs `vector` (32-bit float). This is a valid pgvector optimization but means any backfill script must cast to `halfvec` when inserting.

### The RPC Functions (Supabase stored functions)

These are PostgreSQL functions called from the frontend via `supabase.rpc(...)`:

| Function | Purpose |
|----------|---------|
| `search_document_chunks` | Main vector search across all chunks |
| `match_document_metadata_by_summary` | Vector search at the document/meeting level |
| `search_all_knowledge` | Search insights + knowledge combined |
| `search_knowledge_base` | Search company knowledge articles |
| `search_ai_memories` | User-scoped memory search |
| `search_team_memories` | Team-scoped memory search |
| `find_duplicate_memory` | Deduplication check before memory insert |
| `touch_ai_memories` | Update access timestamps |
| `full_text_search_meetings` | Keyword (BM25-style) meeting search |

The SQL definitions for these functions live in `src/scripts/sql/`.

---

## 5. Data Flow: Ingestion Path

```
Fireflies webhook / manual trigger
  → POST /api/ingest/fireflies/recent
    → FirefliesPipeline.run()
      → [1] Fetch transcript from Fireflies GraphQL API
      → [2] Extract metadata (title, date, participants, duration)
      → [3] Split transcript into overlapping chunks
             Default chunk_size: see pipeline/config.py
             Overlap: see pipeline/config.py
      → [4] For each chunk:
             embedder.generate_embedding(chunk_text)
               → openai.embeddings.create(
                   model="text-embedding-3-large",
                   dimensions=3072,
                   input=chunk_text
                 )
               → returns List[float] with 3072 values
             Write to document_chunks:
               {
                 document_id,
                 chunk_index,
                 content: chunk_text,
                 embedding: halfvec(vector),  ← stored as halfvec
                 source_type: "meeting_transcript",
                 metadata: {title, date, participants, ...}
               }
      → [5] project_assignment.py
             → LLM classifies which project this meeting belongs to
             → writes project_id back to document_metadata
      → [6] extractor.py
             → LLM extracts action items, decisions, key points
             → writes to meeting_action_items / ai_insights tables
```

---

## 6. Data Flow: Query / Retrieval Path

Generation runs in Eve. Authentication, durable turn identity, and production
tool authorization are enforced by the Alleato app. Backend services can supply
approved intelligence/tool results but do not own the conversation runtime.

```
User types a message at /ai
  → use-alleato-eve-chat.ts
  → authenticated /api/ai-assistant/eve/proxy/[...path]
  → durable AssistantTurn
  → agents/alleato-assistant Eve runtime
    → load relevant domain skill(s)
    → fetch scoped catalog from /api/ai-assistant/eve/tools
    → execute approved structured/RAG reads
    → synthesize grounded answer with source receipts
```

---

## 7. Identified Risks and Fragilities

These are the issues most likely to cause silent failures, incorrect answers, or hard-to-debug breakage. **Read this section carefully before changing anything embedding-related.**

---

### RISK 1 — Embedding Dimension Mismatch Between Code Files (HIGH)
**File:** `frontend/src/lib/ai/tools/tool-utils.ts:14` vs `frontend/src/lib/ai/services/ai-memory-service.ts:63-71`

`tool-utils.ts` defines `EMBEDDING.SMALL = {model: "text-embedding-3-small", dimensions: 1536}` with a comment saying it's used for `ai_memories`. But `ai-memory-service.ts` calls `text-embedding-3-large` at `dimensions: 3072` directly — without using the `EMBEDDING` registry at all.

**Impact:** If the `ai_memories` table column is `halfvec(1536)`, all memory writes will fail at the Supabase layer with a dimension mismatch error. If the column is `halfvec(3072)`, the `EMBEDDING.SMALL` constant is a misleading dead reference.

**What to check:** Run `SELECT embedding_dimension FROM information_schema...` or check the migration files for `ai_memories`. One of the two code paths is wrong.

**Fix:** Either update `ai-memory-service.ts` to use `EMBEDDING.LARGE` from `tool-utils.ts`, or update `EMBEDDING.SMALL` to reflect 3072 dims. Then use the constant consistently.

---

### RISK 2 — Embedding JSON-String Format Coupling (HIGH)
**File:** `frontend/src/lib/ai/tools/tool-utils.ts:23-42`

`generateEmbedding()` returns `JSON.stringify(embedding_array)` — a JSON-encoded string, not a raw float array. Every Supabase RPC function that receives this as `query_embedding` must cast it from text to the correct vector type internally.

**Impact:** If you ever change `generateEmbedding()` to return a raw array (which is more natural), every RPC call will break with a type mismatch error. If a new developer adds a new embedding call returning a raw array and passes it to an existing RPC, it will silently fail or error.

**Fix:** Document this serialization contract in `tool-utils.ts`. Add a TypeScript type `type EmbeddingVector = string` with a JSDoc comment explaining it's a JSON-encoded `number[]`. Never pass raw arrays to the RPCs.

---

### RISK 3 — LLM Reranker Silent Fallback (MEDIUM)
**File:** `frontend/src/lib/ai/tools/tool-utils.ts:75-125`

If `gpt-4.1-mini` returns anything that can't be JSON-parsed as an array of integers, the reranker silently falls back to vector-similarity order. The error is only logged via `console.error` — there is no alerting, no metric, and no way to know this is happening in production.

**Impact:** Users may be getting lower-quality RAG results without any signal that the reranker is broken. A change to `gpt-4.1-mini`'s response format (e.g., after a model update) could silently degrade answer quality across the entire product.

**Fix:** Log reranker failures to a structured observability sink (Vercel logs + an `ai_reranker_failures` counter). Add a rate threshold — if >10% of reranker calls fail in a 5-minute window, alert.

---

### RETIRED RISK — Legacy Intent Planner Timeout

The referenced `/api/ai-assistant/chat` intent planner was deleted during the
Eve-only cutover. Do not repair or restore it. Current routing failures must be
diagnosed through Eve turn events, loaded skills, the scoped tool catalog, and
tool/source receipts.

---

### RISK 5 — Double Project Filtering Waste + Access Control Gap (MEDIUM)
**File:** `frontend/src/lib/ai/tools/operational.ts:1100-1116`

`semanticSearch` passes `filter_project_id` to the Supabase RPC AND then filters the returned results again in JavaScript. The JS filter uses the service-role client (bypasses RLS), which is correct for access control. But because both filters run, if the RPC filter incorrectly includes extra rows, the JS filter will catch them — masking the RPC bug. Conversely, if the JS filter has a bug, rows from unauthorized projects could appear in results.

**Impact:** Access control is load-bearing JavaScript logic, not database-enforced. A JavaScript runtime error in the filter block could expose cross-project data.

**Fix:** Move access control filtering into a Postgres row-security policy or a dedicated Postgres function that runs as the user's role. Don't rely on JS for security-critical filtering.

---

### RISK 6 — Transcript Stitching Gap Comment Mismatch (LOW)
**File:** `frontend/src/lib/ai/tools/operational.ts:1257`

The code merges transcript chunks when `currIdx <= prevIdx + 2` (gap ≤ 2), but the inline comment says "consecutive chunks (gap ≤ 1)". This means chunks that are two indices apart are being merged even though the comment implies they shouldn't be.

**Impact:** Merged context blocks may be larger than intended, consuming more LLM context window space per retrieval.

**Fix:** Either update the comment to say "gap ≤ 2" or tighten the condition to `currIdx === prevIdx + 1` if strict adjacency is intended.

---

### RISK 7 — `v_budget_lines` Fallback Uses String Matching on Error Objects (LOW)
**File:** `frontend/src/lib/ai/tools/financial.ts:101-109`

`isMissingBudgetViewError()` detects a missing database view by JSON-serializing the error object and checking for substrings like `"v_budget_lines"` and `"PGRST205"`. This is brittle — error object serialization varies across Supabase client versions and JS engines.

**Impact:** If the error format changes (after a Supabase client upgrade), the view-missing detection will fail silently. The function will then throw instead of falling back, breaking briefing tools.

**Fix:** Use structured error codes from the Supabase client (`error.code === "PGRST205"`) rather than serializing the entire error object to a string.

---

### RISK 8 — No Authentication on Backend Admin Endpoints (HIGH)
**File:** `backend/src/api/admin_endpoints.py`, `API.md:64-65`

The `API.md` explicitly states: "No API key or token auth is currently enforced on endpoints." The `/api/admin/*` endpoints — which trigger embedding generation, pipeline stats, and task management — are accessible to anyone who can reach the server.

**Impact:** Anyone who knows the Render.com URL can trigger embedding jobs (expensive OpenAI calls), view pipeline statistics, or interfere with background tasks.

**Fix:** Add a shared-secret header check (`X-Admin-Key: <secret>`) or require a Supabase service-role token on all `/api/admin/*` routes. At minimum, IP-allowlist the admin routes to the Vercel frontend's IP range.

---

### RISK 9 — Mixed TypeScript Files in Python Backend (MEDIUM)
**Files:** `backend/src/services/insights/*.ts`, `backend/src/services/rfi_agent/rfi_agent.ts`

There are TypeScript files sitting inside the Python backend directory. They are not executed by the Python server. Their relationship to the running system is unclear.

**Impact:** Future developers may assume these files are active and up-to-date, make changes to them, and have no idea why nothing changed. Or they may be deleted during a backend cleanup, removing code that was quietly still needed somewhere.

**Fix:** Either move these to the frontend (`frontend/src/services/insights/`) if they are active, or delete them if they are prototypes that were superseded. Do not leave TypeScript in a Python project.

---

### RISK 10 — Multiple Competing Backfill Scripts With No Canonical Order (MEDIUM)
**Directory:** `backend/src/scripts/`

There are 8+ backfill scripts that each re-embed subsets of the data in slightly different ways (`backfill_3072_embeddings.py`, `backfill_missing_chunk_embeddings.py`, `backfill_segment_embeddings.py`, `backfill_transcript_chunks.py`, etc.). There is no documentation explaining:
- Which one to run first
- Which is the current canonical script
- Whether running them in the wrong order will corrupt data
- Which ones are obsolete

**Impact:** The next time embeddings need to be regenerated (model change, dimension change, schema change), a developer will have to read all 8 scripts to figure out which one to use, and may run the wrong one.

**Fix:** Create a `MIGRATION_ORDER.md` file in `src/scripts/` listing the scripts in the order they should be run, which ones are obsolete, and what each one is for. Mark obsolete scripts with a `# DEPRECATED:` comment at the top.

---

### RISK 11 — `memory_store.py` In-Memory Cache Not Shared Across Workers (MEDIUM)
**File:** `backend/src/services/memory_store.py`

If this is a plain Python dict or a module-level variable (standard in-memory caching), it will NOT be shared across multiple uvicorn workers or across Render.com horizontal scaling instances.

**Impact:** Pipeline jobs or routes that depend on this cache may see stale or missing data when the service runs with >1 worker.

**Fix:** Replace with a Redis-backed cache (Upstash Redis is available free tier), or ensure the memory store is only used for request-scoped data that doesn't need to survive across workers.

---

### RISK 12 — Scheduler Jobs Have No Failure Alerting (MEDIUM)
**File:** `backend/src/services/scheduler.py`

Background scheduler jobs (MS Graph sync, source sync, and task extraction) likely fail silently when the Supabase connection drops, OpenAI rate-limits, or the MS Graph token expires. There is no evidence of email/Slack alerting on job failure.

**Impact:** The system can stop ingesting new meetings, emails, or Teams messages entirely with no notification. Users will notice the AI chat giving stale answers, but there will be no operational alert to trigger a fix.

**Fix:** Wrap each scheduled job in a try/except that calls the email service or a Slack webhook on failure. Log start/end/duration for each job to Supabase (`job_run_log` table) for auditability.

---

## 8. Running the Server

### Local Development

```bash
cd backend
python -m venv .venv           # already exists, skip if present
source .venv/bin/activate
pip install -r requirements.txt

# Start the FastAPI server
uvicorn src.api.main:app --host 0.0.0.0 --port 8051 --reload
```

The server starts at `http://localhost:8051`.

Interactive API docs: `http://localhost:8051/docs`

### Running a One-Off Script

```bash
cd backend
source .venv/bin/activate
python -m src.scripts.process_existing_documents   # example
```

### Running Tests

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

---

## 9. Environment Variables

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | pipeline/embedder.py, pipeline/llm.py | OpenAI key for embeddings + LLM calls |
| `SUPABASE_URL` | Yes | services/supabase_helpers.py | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | services/supabase_helpers.py | Supabase service role key (bypasses RLS) |
| `FIREFLIES_API_KEY` | Yes (for ingestion) | ingestion/fireflies_pipeline.py | Fireflies.ai API key |
| `MS_GRAPH_CLIENT_ID` | Yes (for MS Graph) | integrations/microsoft_graph/client.py | Azure app client ID |
| `MS_GRAPH_CLIENT_SECRET` | Yes (for MS Graph) | integrations/microsoft_graph/client.py | Azure app client secret |
| `MS_GRAPH_TENANT_ID` | Yes (for MS Graph) | integrations/microsoft_graph/client.py | Azure tenant ID |
| `ACUMATICA_BASE_URL` | Yes (for Acumatica sync) | services/acumatica_sync.py | Acumatica instance URL |
| `ACCOUNTING_USER` | Yes (for Acumatica sync) | services/acumatica_sync.py | Acumatica username |
| `ACCOUNTING_PASSWORD` | Yes (for Acumatica sync) | services/acumatica_sync.py | Acumatica password |
| `SMTP_HOST` / `SMTP_PORT` | For email | services/email_service.py | Email delivery config |
| `USE_UNIFIED_AGENT` | No | src/api/main.py | Set `"true"` to use unified agent routing |

See `.env.production.template` for the full list with example values.
