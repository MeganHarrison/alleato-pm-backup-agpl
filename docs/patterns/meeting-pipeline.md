# Meeting Analysis & Task Generation Pipeline

**Last Updated:** 2026-05-03
**Status:** Production (Phase 1 complete; no automated Fireflies sync cron yet)

This document is the technical reference for how meetings flow from Fireflies into the platform — ingestion, AI analysis, task extraction, and storage.

---

## Architecture Overview

```
Fireflies.ai API
      │
      │  GraphQL (transcript + summary + analytics)
      ▼
fireflies_pipeline.py
  ├─ Fetch recent transcripts
  ├─ Generate markdown
  ├─ Upload to Supabase Storage (transcripts/<date> - <title>.md)
  └─ Upsert → document_metadata (type="meeting")
                │
                │  trigger: run_full_pipeline(metadata_id)
                ▼
    orchestrator.py  ─── 4-stage pipeline
          │
      Stage 1: parser.py        ─── meeting_segments rows (decisions, risks, tasks arrays)
      Stage 2: embedder.py      ─── document_chunks (halfvec embeddings)
      Stage 3: extractor.py     ─── tasks + insights upserted
      Stage 4: compiler.py      ─── intelligence packets for exec dashboard
          │
          ├─ tasks table         ← action items (assignee, due date, priority)
          └─ insights table      ← decisions, risks, opportunities
```

---

## 1. Meeting Ingestion

### Primary Path — Fireflies Sync

**File:** `backend/src/services/ingestion/fireflies_pipeline.py`

- Connects to `https://api.fireflies.ai/graphql` using `FIREFLIES_API_KEY`
- `sync_recent_transcripts()` fetches recent transcript summaries, then pulls each full transcript: sentences, summary, analytics, attendees
- `_fetch_apps_outputs()` pulls AI filter outputs from Fireflies apps (paginated, 10/page)
- Full transcript is formatted as Markdown via `_format_transcript_markdown()` and uploaded to Supabase Storage at `transcripts/<date> - <title>.md`
- Calls `ingest_markdown_text()` → upserts to `document_metadata`

**Automatic sync:** Render cron `alleato-fireflies-sync` runs `python3 scripts/run_fireflies_sync.py` every **15 minutes**. That cron calls `FirefliesIngestionPipeline.sync_recent_transcripts(...)` directly, then runs the canonical Fireflies post-ingest extraction follow-through. This is the current production owner for scheduled Fireflies sync.

**Manual trigger endpoint:** `POST /api/ingest/fireflies/recent` on the Python backend (requires `require_admin_api_key`). Accepts: `limit`, `project_id`, `dry_run`, `write_markdown_dir`.

### Manual Meeting Creation

**File:** `frontend/src/app/api/projects/[projectId]/meetings/route.ts`

`POST /api/projects/[projectId]/meetings` inserts a `document_metadata` row with:
- `type: "meeting"`, `source: "manual"`, `status: "complete"`
- Does **not** trigger the Python AI pipeline — no task/insight extraction happens.

---

## 2. Data Storage

All meetings live in a single table: **`document_metadata`** (filtered by `type = "meeting"`).

### Key Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Fireflies transcript ID or generated UUID |
| `fireflies_id` | text | Nullable; only for synced meetings |
| `title`, `date`, `duration_minutes` | — | Meeting metadata |
| `participants` / `participants_array` | text / text[] | Attendees |
| `summary`, `overview`, `bullet_points`, `notes`, `outline` | text | AI-generated sections |
| `action_items` | text | Newline-separated raw action items from Fireflies |
| `content` / `raw_text` | text | Full markdown transcript |
| `type` | text | `"meeting"` or `"meeting_transcript"` |
| `source` | text | `"fireflies"` or `"manual"` |
| `host_email`, `organizer_email` | text | Organizer info |
| `sentiment`, `speakers`, `analytics` | JSONB | Structured data from Fireflies |
| `summary_embedding` | halfvec(3072) | For semantic meeting search |
| `status` | text | `"complete"` / `"processed"` / `"error"` |
| `project_id` | int4 | FK to `projects` |

### Supporting Tables

**`meeting_segments`** — Transcript chunks (from Stage 1 parser)
- Each segment: `decisions[]`, `risks[]`, `tasks[]` arrays
- Linked to `document_metadata` via `metadata_id`

**`document_chunks`** — Vector embeddings (from Stage 2 embedder)
- `source_type` = `"meeting_transcript"` or `"meeting_summary"`
- Used for semantic search via `match_document_chunks` RPC

**`tasks`** — Extracted action items (from Stage 3 extractor)
- `metadata_id` → FK to `document_metadata`
- `source_system: "fireflies"` for all meeting-derived tasks
- Contains: `description`, `assignee_name`, `assignee_email`, `due_date`, `priority`, `status`, `embedding`

**`insights`** — Decisions, risks, opportunities (from Stage 3 extractor)
- `type`: `"decision"` | `"risk"` | `"opportunity"`
- `approval_status` gate added in migration `20260503190000`
- Linked to `document_metadata` via `metadata_id`

**`fireflies_ingestion_jobs`** — Pipeline status per meeting
- `stage`: `"start"` | `"done"` | `"error"`
- `attempt_count`, `last_attempt_at`, `error_message`

---

## 3. AI Analysis Pipeline

**Entry point:** `backend/src/services/pipeline/orchestrator.py` → `run_full_pipeline(metadata_id)`

Runs in a FastAPI `BackgroundTasks` thread. Concurrency bounded by `_PIPELINE_MAX_CONCURRENCY = 3` (threading semaphore).

### Stage 1 — Parser (`parser.py`)

For meetings (`source == "fireflies"` or `category in {meeting, transcript, meeting_transcript}`):
- Semantically segments the markdown transcript using LLM
- Each segment stored in `meeting_segments` with `decisions`, `risks`, `tasks` arrays

### Stage 2 — Embedder (`embedder.py`)

- Chunks transcript content
- Generates `halfvec(3072)` embeddings using `text-embedding-3-large`
- Stores in `document_chunks` table
- Generates `summary_embedding` on `document_metadata` for meeting-level semantic search

### Stage 3 — Extractor (`extractor.py`)

This is where tasks and insights are created.

1. Fetches `document_metadata` + all `meeting_segments` rows
2. Collects raw `decisions`, `risks`, `tasks` from all segment rows
3. Appends raw `action_items` from `document_metadata.action_items`
4. Builds `speaker_email_map` from attendee JSON
5. Calls `llm.extract_structured_data()` with title, participants, summary, and raw items

**Task source priority:**
- Fireflies task extraction now runs through the canonical post-ingest extractor path.
- The extractor can rewrite raw Fireflies action items into cleaner tasks, but task persistence is owned in one place by `_upsert_task()`.
- Transcript ingestion no longer writes a second inline Fireflies-only task batch during chunking.

**Task quality gates** (applied before upsert):
1. Tasks with no assignee (both `assignee` and `assignee_email` null) → **dropped**
2. Low-signal tasks (< 24 chars, or generic prefix + vague timing) without due dates → **dropped**
3. High/urgent priority tasks without due dates → **downgraded to medium**

**Output:**
- Upserts to `insights` table via `_upsert_insight()` (decisions, risks, opportunities)
- Upserts canonical Fireflies tasks via `_upsert_task()`
- Marks `fireflies_ingestion_jobs.stage = "done"` and `document_metadata.status = "complete"`

**Memory extraction** (best-effort, in `ingest_markdown_text()`):
`_extract_meeting_memories()` extracts team-scoped AI memories → writes to `ai_memories` table via the memory service.

### Stage 4 — Intelligence Compiler (`compiler.py`)

Generates AI intelligence packets used for the executive dashboard and project health views.

---

## 4. Task Generation Detail

### Source A — Canonical Fireflies Post-Ingest Extraction

The post-ingest extractor owns Fireflies task creation:
- It can rewrite raw Fireflies action items into cleaner tasks when meeting metadata carries usable action items
- It resolves assignees and persists tasks through the unified `_upsert_task()` path
- It is used by both scheduled sync and document reprocessing

### Source B — LLM Extraction from Segments

`llm.extract_structured_data()` normalizes raw task strings from `meeting_segments`, resolves assignees from participant list, infers due dates.

### Upsert Logic

Conflict resolution on `(metadata_id, description)` — re-running the pipeline for the same meeting replaces existing tasks rather than duplicating.

### Frontend Task API

**File:** `frontend/src/app/api/tasks/route.ts`

`GET /api/tasks` joins `tasks` with `projects` and `document_metadata`, excludes interview/test meetings, returns enriched rows via `mapTaskRow()`.

`mapTaskRow()` in `frontend/src/features/tasks/task-utils.ts` extracts:
- `meeting_title`, `fireflies_link`, `meeting_link`, `source_web_url` from the joined `document_metadata` row

---

## 5. AI Assistant Access

The AI assistant surfaces meeting data through three tools in `frontend/src/lib/ai/tools/operational.ts`:

| Tool | Line | What it does |
|------|------|--------------|
| `searchMeetingsByTopic` | ~1652 | Runs `full_text_search_meetings` + `match_document_metadata_by_summary` RPCs in parallel; returns meeting summaries with action items |
| `getMeetingDetails` | ~1802 | Fetches full `document_metadata` row + all linked `insights` rows, grouped by type |
| `semanticSearch` | ~946 | Searches `document_chunks` where `source_type` is `"meeting_transcript"` or `"meeting_summary"`; stitches adjacent chunks; applies recency+source boost + LLM reranker |

The `getActionItemsAndInsights` tool surfaces open tasks from meetings as the primary signal for what needs attention (see `rag-assistant-prompt.ts:96`).

---

## 6. UI Entry Points

| Page | Path | What it shows |
|------|------|---------------|
| Project meetings list | `/(main)/[projectId]/meetings/page.tsx` | All meetings for a project, queried from `document_metadata` where `type = "meeting"` |
| Meeting detail | `/(main)/[projectId]/meetings/[meetingId]/` | Full transcript, action items, insights |
| Admin document metadata | `/(admin)/document-metadata/page.tsx` | All `document_metadata` rows with pipeline stage and `fireflies_link` |
| Document pipeline status | `GET /api/documents/status` | Joins `document_metadata` + `fireflies_ingestion_jobs` |

---

## 7. Scheduled Jobs

The Python backend runs APScheduler (`backend/src/services/scheduler.py`) as part of the FastAPI process. All meeting-relevant jobs live here — **not** in Vercel crons.

### Backend scheduler jobs (APScheduler)

| Job ID | Cadence | What it does |
|--------|---------|--------------|
| `fireflies_sync` | Every 15 min (configurable) | Fetches recent Fireflies transcripts → full pipeline |
| `daily_digest` | 6 PM daily (configurable) | Aggregates meetings into executive briefing + sends email |
| `intelligence_compiler` | Every 10 min (configurable) | Drains queued intelligence packet jobs |
| `graph_sync` | Every 60 min (auto-enabled when creds present) | Syncs Outlook/Teams/OneDrive |
| `acumatica_financial_sync` | Daily 00:15 UTC (configurable) | ERP finance import |

### Vercel crons (`vercel.json`) — meeting-adjacent only

| Cron | Schedule | Relevant to meetings? |
|------|----------|-----------------------|
| `daily-flags` | Daily 6am UTC | No — budget/RFI/schedule/CE only |
| `progress-reports` | Monday 8am UTC | Indirectly — generates reports that draw on meeting data |

---

## 8. Known Gaps

### 8.1 Manual Meetings Skip AI Pipeline

Meetings created via `POST /api/projects/[projectId]/meetings` (source: "manual") get no task or insight extraction — no Stage 1–4 pipeline runs.

**Fix:** After manual meeting creation, optionally call the backend pipeline trigger endpoint if content (notes/transcript) was provided.

### 8.3 Insights Approval Gate Not Surfaced in UI

Migration `20260503190000` added `approval_status` to `insights` but the approval workflow in the UI is not confirmed complete — verify `/(main)/[projectId]/meetings` surfaces pending approvals.

### 8.4 Recurring Issues Tracking Not Connected to Meetings

Migration `20260503200000` adds `recurring_issues_tracking` table. The connection from meeting-extracted insights to recurring issue detection is not yet wired.

---

## 9. Related Files

| File | Purpose |
|------|---------|
| `backend/src/services/ingestion/fireflies_pipeline.py` | Fireflies GraphQL client, markdown gen, `document_metadata` upsert, direct task rows |
| `backend/src/services/pipeline/orchestrator.py` | 4-stage pipeline runner |
| `backend/src/services/pipeline/extractor.py` | LLM task/decision/risk extraction + quality gates |
| `backend/src/api/main.py` | FastAPI routes: `/api/ingest/fireflies/recent` |
| `frontend/src/app/api/projects/[projectId]/meetings/route.ts` | Meeting CRUD (manual, no pipeline) |
| `frontend/src/app/api/tasks/route.ts` | Tasks GET with joined meeting metadata |
| `frontend/src/app/api/documents/status/route.ts` | Pipeline status per document |
| `frontend/src/lib/ai/tools/operational.ts` | `searchMeetingsByTopic`, `getMeetingDetails`, `semanticSearch` |
| `frontend/src/lib/ai/rag-assistant-prompt.ts` | System prompt — meeting data as primary intelligence |
| `frontend/src/features/tasks/task-utils.ts` | `mapTaskRow()` — enriches tasks with meeting source links |
| `supabase/migrations/20260503190000_ai_insights_approval_gate.sql` | Adds approval_status to insights |
| `supabase/migrations/20260503200000_recurring_issues_tracking.sql` | Recurring issue detection table |
