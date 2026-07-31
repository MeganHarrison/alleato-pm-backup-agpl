# Environment Variables Reference

## Overview

This project runs two services: a **Next.js 15 frontend** (deployed on Vercel) and a **Python FastAPI backend** (deployed on Render). Each has its own env var set. They share some var names but are configured independently in their respective dashboards.

**Why this matters — Gate 17 (Build Crash Prevention):** Missing server-side env vars at build time crash `next build`. Specifically:
- Any file that reads a non-`NEXT_PUBLIC_*` var at module load time (not inside a function) fails CI because the var is absent during static analysis.
- Any server page that calls `createServiceClient()` without `export const dynamic = "force-dynamic"` attempts to prerender at build time and crashes.

Set env vars in **Vercel Dashboard → Project → Settings → Environment Variables** for the frontend, and **Render Dashboard → Service → Environment** for backend services.

---

## Frontend Env Vars (Next.js / Vercel)

### Supabase

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Vercel | Supabase project URL — used in browser and server | Must be `NEXT_PUBLIC_` so the browser client can access it |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Vercel | Supabase anon (public) key | Safe to expose; Row Level Security enforces access |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Vercel | Server-side admin key — bypasses RLS | Never expose to browser. Absent at build time → build crash unless page uses `force-dynamic` |
| `SUPABASE_SERVICE_KEY` | No | Vercel | Alias for `SUPABASE_SERVICE_ROLE_KEY` used in some older API routes | Set both to avoid breakage |
| `SUPABASE_URL` | No | Vercel | Alias for `NEXT_PUBLIC_SUPABASE_URL` used in some server-only routes | Set to same value |
| `SUPABASE_ANON_KEY` | No | Vercel | Alias for anon key used in some server routes | Set to same value |
| `SUPABASE_ACCESS_TOKEN` | No | Vercel | Supabase Management API token | Used for programmatic project management only |
| `SUPABASE_MANAGEMENT_API_TOKEN` | No | Vercel | Alias for Management API token | |
| `POSTGRES_URL` | No | Vercel | Direct Postgres connection string | Used if bypassing Supabase client for raw SQL |

### AI / OpenAI

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `OPENAI_API_KEY` | Yes | Vercel | OpenAI API key for embeddings + completions | Billing goes to OpenAI account |
| `AI_GATEWAY_API_KEY` | Yes | Vercel | Vercel AI Gateway key (BYOK mode) | All LLM/embedding calls route through `ai-gateway.vercel.sh`. Falls back to direct OpenAI if not set |
| `TAVILY_API_KEY` | No | Vercel | Tavily search API for RAG web search tool | Optional — search tool degrades gracefully |
| `PHOENIX_ENDPOINT` | No | Vercel | Phoenix/Arize tracing endpoint | LLM observability; disabled if absent |
| `PHOENIX_TRACING` | No | Vercel | Enable/disable Phoenix tracing (`true`/`false`) | |
| `AI_ASSISTANT_DISABLE_EXCALIDRAW_MCP` | No | Vercel | Disables the default Excalidraw MCP App server in AI assistant | Feature flag; default server is `https://mcp.excalidraw.com/mcp` |
| `AI_ASSISTANT_DISABLE_SUPABASE_MCP` | No | Vercel | Disables Supabase MCP integration in AI assistant | Feature flag |
| `AI_ASSISTANT_MCP_SERVERS` | No | Vercel | JSON config for additional AI assistant MCP server list | Supports `name`, `url`, optional `authorization`, `headers`, and `allowedTools`; generic servers are read-only unless `allowedTools` is set |
| `EXECUTIVE_BRIEFING_SYNTHESIS_MODEL` | No | Vercel | Override model used for executive briefing synthesis | Defaults to configured OpenAI model |
| `SUB_AGENT_TIMEOUT_MS` | No | Vercel | Timeout in ms for sub-agent calls | |
| `RAG_EVAL_PYTHON_BIN` | No | Local dev | Path to Python binary for RAG evaluation scripts | Dev-only |

### Backend Connection

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `BACKEND_URL` | Yes | Vercel | URL of the Python FastAPI backend on Render | Must be `https://alleato-backend-rbnj.onrender.com` unless a new active backend is deliberately approved and the guardrail is updated |
| `PYTHON_BACKEND_URL` | No | Vercel | Alias used in some routes | Set to same value as `BACKEND_URL` |

### Security / API Guards

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `ADMIN_API_KEY` | Yes | Vercel | Guards `/api/admin/*` routes | Must match on frontend and backend |
| `CRON_SECRET` | Yes | Vercel | Guards cron trigger endpoints | Vercel sends this in `Authorization` header for scheduled calls |
| `ACCOUNTING_SYNC_SECRET` | No | Vercel | Guards Acumatica sync webhook endpoints | |

### Integrations — Microsoft / Graph

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `MICROSOFT_CLIENT_ID` | Yes (if Graph sync enabled) | Vercel | Azure AD app client ID | Same app registration used by both frontend and backend |
| `MICROSOFT_CLIENT_SECRET` | Yes (if Graph sync enabled) | Vercel | Azure AD app client secret | Rotate annually |
| `MICROSOFT_TENANT_ID` | Yes (if Graph sync enabled) | Vercel | Azure AD tenant ID | |
| `MICROSOFT_SYNC_USERS` | Yes (if Graph sync enabled) | Vercel | Comma-separated email addresses to sync Outlook/Teams data for | e.g. `user@company.com,other@company.com` |

### Integrations — Acumatica ERP

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `ACUMATICA_BASE_URL` | Yes (if Acumatica enabled) | Vercel | Base URL of Acumatica instance | e.g. `https://company.acumatica.com` |
| `ACCOUNTING_USER` | Yes (if Acumatica enabled) | Vercel | Acumatica login username | Cookie-based auth — NOT bearer token |
| `ACCOUNTING_PASSWORD` | Yes (if Acumatica enabled) | Vercel | Acumatica login password | Cookie-based auth |
| `ACUMATICA_COMPANY` | No | Vercel | Company name in Acumatica | Must match exactly — default `"Alleato Group LLC"` |
| `ACUMATICA_SYNC_USER_ID` | No | Vercel | Acumatica user ID for sync operations | |
| `NEXT_PUBLIC_ACCOUNTING_SYNC_SECRET` | No | Vercel | Public-facing sync secret for client-initiated syncs | |

### Integrations — Linear

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `LINEAR_API_KEY` | Yes (if Linear enabled) | Vercel | Linear personal API key | |
| `LINEAR_DEFAULT_TEAM_ID` | No | Vercel | Default Linear team ID for issue creation | |
| `LINEAR_DEFAULT_TEAM_KEY` | No | Vercel | Default Linear team key | |
| `LINEAR_ERROR_TEAM_ID` | No | Vercel | Linear team ID for error/bug issues | |
| `LINEAR_ERROR_TEAM_KEY` | No | Vercel | Linear team key for error/bug issues | |
| `LINEAR_API_URL` | No | Vercel | Override Linear GraphQL API URL | Defaults to `https://api.linear.app/graphql` |
| `LINEAR_MCP_SERVER_URL` | No | Vercel | Linear MCP server URL for AI assistant | |
| `LINEAR_MCP_TOKEN` | No | Vercel | Auth token for Linear MCP server | |

### Integrations — GitHub Feedback

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `GITHUB_FEEDBACK_TOKEN` | Yes (if feedback enabled) | Vercel | GitHub personal access token for creating issues | Needs `repo` scope |
| `GITHUB_FEEDBACK_REPO_NAME` | Yes (if feedback enabled) | Vercel | GitHub repo name | e.g. `alleato-pm` |
| `GITHUB_FEEDBACK_REPO_OWNER` | Yes (if feedback enabled) | Vercel | GitHub repo owner | e.g. `MeganHarrison` |
| `GITHUB_FEEDBACK_LABELS` | No | Vercel | Comma-separated default labels for feedback issues | |

### Integrations — Resend (Email)

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `RESEND_API_KEY` | Yes (if email sending enabled) | Vercel | Resend API key | |
| `RESEND_FROM_EMAIL` | No | Vercel | Default from address for outgoing email | |
| `RESEND_WEBHOOK_SECRET` | No | Vercel | Verifies incoming Resend webhook signatures | |
| `EMAIL_FROM_ADDRESS` | No | Vercel | Override from address for generic email sending | |
| `DIGEST_FROM_EMAIL` | No | Vercel | From address for daily digest emails | |

### Integrations — Slack

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `SLACK_BOT_TOKEN` | No | Vercel | Slack bot OAuth token | |
| `SLACK_SIGNING_SECRET` | No | Vercel | Verifies incoming Slack webhook signatures | |
| `ERROR_ALERT_WEBHOOK_URL` | No | Vercel | Slack incoming webhook URL for error alerts | |

### Integrations — Telegram

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `TELEGRAM_BOT_TOKEN` | No | Vercel | Telegram bot token | |
| `TELEGRAM_BOT_USERNAME` | No | Vercel | Telegram bot username | |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | No | Vercel | Verifies incoming Telegram webhook requests | |

### Integrations — Teams Bot

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `TEAMS_APP_ID` | No | Vercel | Microsoft Teams bot app ID | |
| `TEAMS_APP_PASSWORD` | No | Vercel | Microsoft Teams bot app password | |
| `TEAMS_APP_TENANT_ID` | No | Vercel | Tenant ID for Teams bot | |

### Notifications

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `NOTIFICATION_SERVICE_KEY` | No | Vercel | Auth key for internal notification service | |

### Feature Flags (Runtime)

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `NEXT_PUBLIC_ENABLE_DEV_BRIDGE` | No | Vercel | Enables dev bridge tooling in browser | Dev/preview only |
| `NEXT_PUBLIC_TESTING_SCENARIO_DEPTH_FILTER_ENABLED` | No | Vercel | Enables depth filter in testing scenarios UI | |
| `TESTING_SCENARIO_DEPTH_FILTER_ENABLED` | No | Vercel | Server-side version of above flag | |

### App Identity / URLs

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `NEXT_PUBLIC_APP_URL` | No | Vercel | Canonical app URL | e.g. `https://projects.alleatogroup.com` |
| `NEXT_PUBLIC_BASE_URL` | No | Vercel | Alias for app URL | |
| `NEXT_PUBLIC_SITE_URL` | No | Vercel | Alias for site URL | |
| `SITE_URL` | No | Vercel | Server-side canonical URL | |
| `NEXT_PUBLIC_APP_VERSION` | No | Vercel | App version string shown in UI | |
| `NEXT_PUBLIC_DOCS_DIR` | No | Vercel | Path to docs directory for in-app docs viewer | |
| `DOCS_CONTENT_DIR` | No | Vercel | Server-side docs directory path | |

### Vercel-Injected (Read-only)

These are set automatically by Vercel — do not set them manually.

| Variable | Purpose |
|----------|---------|
| `VERCEL` | `"1"` when running on Vercel |
| `VERCEL_ENV` | `"production"`, `"preview"`, or `"development"` |
| `VERCEL_URL` | Deployment URL (not canonical — use `NEXT_PUBLIC_APP_URL` for canonical) |
| `VERCEL_PROJECT_PRODUCTION_URL` | Production URL |
| `VERCEL_GIT_COMMIT_SHA` | Git commit SHA of the deployment |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | Same, exposed to browser |
| `NEXT_RUNTIME` | `"nodejs"` or `"edge"` |
| `NODE_ENV` | `"production"`, `"development"`, or `"test"` |

### Misc / Dev

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `BOT_STATE_DATABASE_URL` | No | Vercel | Database URL for bot state storage (separate DB) | |

---

## Backend Env Vars (Python FastAPI / Render)

### Supabase

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `SUPABASE_URL` | Yes | Render | Supabase project URL | Note: same name as frontend alias, not `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_KEY` | Yes | Render | Service role key (bypasses RLS) | Render uses `SUPABASE_SERVICE_KEY`; frontend uses `SUPABASE_SERVICE_ROLE_KEY` — both should point to the same key value |
| `SUPABASE_ANON_KEY` | No | Render | Supabase anon key | Used in some public-facing backend operations |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Render | Alias — set if backend code imports shared config | |
| `SUPABASE_DOCUMENTS_BUCKET` | No | Render | Storage bucket name for documents | Default inferred from code |

### AI / OpenAI

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `OPENAI_API_KEY` | Yes | Render | OpenAI API key for embeddings and completions | |
| `AI_GATEWAY_API_KEY` | Yes | Render | Vercel AI Gateway key | Same key as frontend |

### Security

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `ADMIN_API_KEY` | Yes | Render | Guards admin endpoints — must match frontend value | |

### Microsoft Graph Sync

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `MICROSOFT_CLIENT_ID` | Yes (if Graph enabled) | Render | Azure AD app client ID | |
| `MICROSOFT_CLIENT_SECRET` | Yes (if Graph enabled) | Render | Azure AD app client secret | |
| `MICROSOFT_TENANT_ID` | Yes (if Graph enabled) | Render | Azure AD tenant ID | |
| `MICROSOFT_SYNC_USERS` | Yes (if Graph enabled) | Render | Comma-separated emails to sync | |
| `GRAPH_SYNC_ENABLED` | No | Render | Master switch for Graph sync (`true`/`false`) | Default `false` |
| `GRAPH_SYNC_OUTLOOK` | No | Render | Enable Outlook email sync | Default `false` |
| `GRAPH_SYNC_TEAMS` | No | Render | Enable Teams message sync | Default `false` |
| `GRAPH_SYNC_ONEDRIVE` | No | Render | Enable OneDrive file sync | Default `false` |
| `GRAPH_SYNC_TEAMS_DM` | No | Render | Enable Teams DM sync | Known limitation: 10 cross-tenant chats permanently 403 |
| `GRAPH_SYNC_RUN_EMBEDDING` | No | Render | Run embedding step at end of each sync | Default `true` |
| `GRAPH_EMBEDDING_ENABLED` | No | Render | Enable embedding pipeline | |
| `GRAPH_EMBEDDING_INTERVAL_MINUTES` | No | Render | Embedding run interval | |
| `GRAPH_EMBEDDING_LIMIT` | No | Render | Max docs to embed per run | |
| `GRAPH_PROJECT_ASSIGN_MIN_CONFIDENCE` | No | Render | Min confidence score for project assignment (0.0–1.0) | Default `0.70` |
| `GRAPH_SUBSCRIBE_OUTLOOK` | No | Render | Enable Graph change notifications for Outlook | |
| `GRAPH_SUBSCRIBE_SHAREPOINT_DRIVE_IDS` | No | Render | Comma-separated SharePoint drive IDs to subscribe | |
| `GRAPH_WEBHOOK_CLIENT_STATE` | No | Render | Webhook validation token | |
| `GRAPH_WEBHOOK_LIFECYCLE_URL` | No | Render | Webhook lifecycle notification URL | |
| `GRAPH_WEBHOOK_NOTIFICATION_URL` | No | Render | Webhook change notification URL | |
| `MICROSOFT_GRAPH_WEBHOOK_CLIENT_STATE` | No | Render | Alias for `GRAPH_WEBHOOK_CLIENT_STATE` | |
| `MICROSOFT_GRAPH_WEBHOOK_LIFECYCLE_URL` | No | Render | Alias for `GRAPH_WEBHOOK_LIFECYCLE_URL` | |
| `MICROSOFT_GRAPH_WEBHOOK_NOTIFICATION_URL` | No | Render | Alias for `GRAPH_WEBHOOK_NOTIFICATION_URL` | |

### Outlook Sync Tuning

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `OUTLOOK_SYNC_SINCE` | No | Render | ISO date to start syncing email from | e.g. `2024-01-01` |
| `OUTLOOK_SYNC_INTAKE` | No | Render | Enable email intake sync | |
| `OUTLOOK_SYNC_INTAKE_ATTACHMENTS` | No | Render | Sync email attachments | |
| `OUTLOOK_MAX_ATTACHMENTS_PER_EMAIL` | No | Render | Cap attachments processed per email | |
| `OUTLOOK_ATTACHMENT_MAX_BYTES` | No | Render | Max attachment size in bytes | |

### OneDrive / SharePoint Sync

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `ONEDRIVE_SYNC_FOLDER` | No | Render | Primary OneDrive folder path to sync | |
| `ONEDRIVE_SYNC_FOLDERS` | No | Render | Comma-separated list of OneDrive folders | |
| `SHAREPOINT_SYNC_FOLDERS` | No | Render | Comma-separated SharePoint folder paths | |

### Teams Sync Tuning

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `TEAMS_DM_EXPORT_INITIAL_LOOKBACK_DAYS` | No | Render | Days to look back on first DM export | |
| `TEAMS_DM_EXPORT_MAX_PAGES` | No | Render | Max pages per DM export | |
| `TEAMS_DM_EXPORT_PAGE_SIZE` | No | Render | Messages per page for DM export | |
| `TEAMS_DM_EXPORT_SINCE` | No | Render | ISO date for incremental DM sync | |
| `TEAMS_COMPILER_BATCH_MAX_MS` | No | Render | Max ms for teams compiler batch | Default `170000` |
| `TEAMS_COMPILER_REQUEST_TIMEOUT_SECONDS` | No | Render | Timeout for individual compiler requests | |

### Intelligence Compiler

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `INTELLIGENCE_COMPILER_ENABLED` | No | Render | Master switch for intelligence compiler | |
| `INTELLIGENCE_COMPILER_INTERVAL_MINUTES` | No | Render | Compiler run interval | |
| `INTELLIGENCE_COMPILER_MAX_CONCURRENCY` | No | Render | Max concurrent compiler tasks | |
| `INTELLIGENCE_COMPILER_MAX_MS` | No | Render | Max ms per compiler run | |
| `INTELLIGENCE_COMPILER_PACKET_LIMIT` | No | Render | Max packets processed per run | |
| `INTELLIGENCE_COMPILER_SOURCE_LIMIT` | No | Render | Max source documents per compiler run | |

### Fireflies Integration

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `FIREFLIES_API_KEY` | Yes (if Fireflies enabled) | Render | Fireflies.ai API key for meeting transcripts | |
| `FIREFLIES_PROJECT_ASSIGN_MIN_CONFIDENCE` | No | Render | Min confidence for project assignment | |

### Task Extraction

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `TASK_EXTRACTION_ENABLED` | No | Render | Enable daily task extraction cron | |
| `TASK_EXTRACTION_CRON` | No | Render | Cron schedule string for task extraction | Render cron handles this for the Render cron job |
| `TASK_EXTRACTION_MAX_DOCS` | No | Render | Max docs processed per run | |
| `TASK_EXTRACTION_WINDOW_DAYS` | No | Render | Lookback window in days | Default `2` |

### Acumatica ERP

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `ACUMATICA_BASE_URL` | Yes (if enabled) | Render | Acumatica instance base URL | |
| `ACCOUNTING_USER` | Yes (if enabled) | Render | Acumatica login username | |
| `ACCOUNTING_PASSWORD` | Yes (if enabled) | Render | Acumatica login password | |
| `ACUMATICA_COMPANY` | No | Render | Company name (exact casing) | Default `"Alleato Group LLC"` |
| `ACUMATICA_SYNC_USER_ID` | No | Render | Acumatica user ID for sync | |
| `ACUMATICA_FINANCIAL_SYNC_ENABLED` | No | Render | Enable financial sync from Acumatica | |
| `ACUMATICA_FINANCIAL_SYNC_CRON` | No | Render | Cron schedule for financial sync | |
| `ACUMATICA_SYNC_PAGE_SIZE` | No | Render | Page size for Acumatica API pagination | |

### Resend (Email)

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `RESEND_API_KEY` | No | Render | Resend API key for backend-originated emails | |
| `DIGEST_FROM_EMAIL` | No | Render | From address for daily digest emails | |
| `DAILY_DIGEST_HOUR` | No | Render | Hour (UTC) to send daily digest | |
| `DAILY_DIGEST_MINUTE` | No | Render | Minute to send daily digest | |
| `DAILY_DIGEST_RECIPIENTS` | No | Render | Comma-separated recipient emails | |

### Notifications / Alerts

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `SLACK_WEBHOOK_URL` | No | Render | Slack incoming webhook for RAG health alerts and failures | Render `alleato-rag-health` cron posts here on failure |
| `ERROR_ALERT_WEBHOOK_URL` | No | Render | Generic error alert webhook | |

### Pipeline Tuning

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `PIPELINE_MAX_CONCURRENCY` | No | Render | Default `3` — max concurrent pipeline tasks | |
| `PIPELINE_TRANSIENT_RETRIES` | No | Render | Retry count for transient pipeline failures | |
| `BACKFILL_LOOKBACK_DAYS` | No | Render | Days to look back for backfill operations | |
| `COMM_PROJECT_BACKFILL_AFTER_SYNC` | No | Render | Run project backfill after each sync | |
| `COMM_PROJECT_BACKFILL_LIMIT` | No | Render | Max items to backfill per run | |
| `COMM_PROJECT_BACKFILL_MIN_CONFIDENCE` | No | Render | Min confidence for backfill assignment | |

### Document / RAG Tuning

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `DOC_SEGMENT_WINDOW_LINES` | No | Render | Lines per document segment for chunking | |
| `DOC_SEGMENT_WINDOW_OVERLAP` | No | Render | Overlap lines between segments | |
| `DOC_SUMMARY_MAX_CHARS` | No | Render | Max chars for document summaries | |
| `SEGMENT_TRANSCRIPT_MAX_CHARS` | No | Render | Max chars per transcript segment | |
| `FINANCIAL_PARSER_HEADER_SCAN_ROWS` | No | Render | Rows to scan for financial doc headers | |
| `FINANCIAL_PARSER_MAX_CONTENT_CHARS` | No | Render | Max content chars for financial parser | |
| `FINANCIAL_PARSER_MAX_ROWS` | No | Render | Max rows per financial document parse | |
| `FINANCIAL_PARSER_ROW_BATCH` | No | Render | Batch size for financial parser | |
| `EMAIL_COMPILER_BATCH_MAX_MS` | No | Render | Max ms for email compiler batch | |

### Company / Project Config

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `COMPANY_EMAIL_DOMAINS` | No | Render | Comma-separated internal email domains | Used for project assignment heuristics |
| `PYTHON_BACKEND_URL` | No | Render | Self-referential backend URL | Used when backend calls itself |

### Scheduler

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `DISABLE_SCHEDULER` | No | Render | Set `true` to disable inline Python scheduler | Use when Render cron jobs handle all scheduling |

### Sentry

| Variable | Required | Where Set | Purpose | Notes |
|----------|----------|-----------|---------|-------|
| `NEXT_PUBLIC_SENTRY_DSN` | Yes for frontend monitoring | Vercel Production + Preview | Enables browser-side Sentry error capture and Replay-on-error | Must be public for the browser SDK |
| `SENTRY_DSN` | No | Vercel / Render | Optional server-side DSN fallback | Use when server events should use a separate Sentry project |
| `SENTRY_BACKEND_DSN` | Yes for backend monitoring | Render | Enables FastAPI backend Sentry capture | Backend also falls back to `SENTRY_DSN` |
| `SENTRY_ORG` | Required when any frontend DSN is configured | Vercel Production + Preview | Sentry organization slug for source-map upload | `next.config.ts` fails CI if missing while DSN is set |
| `SENTRY_PROJECT` | Required when any frontend DSN is configured | Vercel Production + Preview | Sentry project slug for source-map upload | Needed for readable production stack traces |
| `SENTRY_AUTH_TOKEN` | Required when any frontend DSN is configured | Vercel Production + Preview | Sentry auth token for source-map upload | Secret token; never expose to the browser |

---

## Build Crash Prevention (Gate 17)

The following frontend vars cause `next build` to fail if absent AND the file using them is statically prerendered:

| Variable | Risk | Fix |
|----------|------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Any page calling `createServiceClient()` without `force-dynamic` crashes at build time | Add `export const dynamic = "force-dynamic"` as first line of the page |
| `OPENAI_API_KEY` | Same — module-level OpenAI client init | Lazy singleton pattern |
| `AI_GATEWAY_API_KEY` | Same | Lazy singleton pattern |
| Any non-`NEXT_PUBLIC_*` key read at module level | Build fails in CI where the var is absent | Move read inside a function; add `force-dynamic` if it's a page |

**Guardrail scripts** (run in predeploy gate):
- `scripts/check-server-prerender-safety.mjs` — catches pages missing `force-dynamic`
- `scripts/check-no-module-level-server-init.mjs` — catches module-level server client init

---

## Adding a New Env Var — Checklist

1. Add to `.env.local` (local development) — never commit this file
2. Add to **Vercel Dashboard** under both `Production` and `Preview` environments (and `Development` if needed for `vercel dev`)
3. If the backend also needs it, add to **Render Dashboard** for all affected services (`alleato-backend`, `alleato-graph-sync`, `alleato-task-extraction`, `alleato-rag-health` as appropriate)
4. If it's a Render-managed var, add an entry in `render.yaml` with `sync: false` so future service recreations prompt for the value
5. Add a row to this document in the correct section
6. If it's read at module level in a server file, apply the lazy singleton pattern (Gate 17)
7. If it guards a page via `createServiceClient()`, ensure `export const dynamic = "force-dynamic"` is at the top of the page file

---

## Testing Env Vars

| Variable | Where Set | Purpose | Notes |
|----------|-----------|---------|-------|
| `TEST_USER_1` | `.env.local` | Test user email — `test1@mail.com` | Used by Playwright auth setup |
| `TEST_PASSWORD_1` | `.env.local` | Test user password — `test12026!!!` | Used by Playwright auth setup |
| `CI_PLAYWRIGHT` | CI environment | Set to `true` in CI to activate CI-specific behavior | |
| `PLAYWRIGHT` | Set by Playwright runner | Detected to skip certain UI interactions during tests | |
| `PLAYWRIGHT_TEST_BASE_URL` | `.env.local` / CI | Override base URL for Playwright tests | Default `http://localhost:3002` |

Playwright uses a saved auth session at `frontend/tests/.auth/user.json`. To refresh:
```bash
cd frontend && npx playwright test tests/auth.setup.ts
```

Never add login code to individual tests — the session is pre-configured.
