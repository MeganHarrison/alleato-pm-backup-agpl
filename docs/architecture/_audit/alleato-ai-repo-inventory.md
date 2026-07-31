# alleato-ai/ Standalone Repo — Tool & Agent Inventory

**Audit pass:** 1d of 4 (fact-gathering)
**Date collected:** 2026-05-19
**Scope:** `/Users/meganharrison/Documents/alleato-pm/alleato-ai/` (standalone LangGraph package)

---

## 1. Repo Overview

`alleato-ai` is a standalone Python package (`name = "alleato-ai"`, `version = "0.1.0"`) described as a "Strategic AI advisor for Alleato construction project management." It is a clean rebuild of the AI advisor that previously lived inside the `alleato-pm` monorepo. Per AGENTS.md: "The earlier *agent layer* is not working and we are deliberately rebuilding it." The data layer (two Supabase projects) is reused as-is.

It is a **LangGraph + Deep Agents deployment target**. There is no UI in this repo. It exposes a single graph (`advisor`) via `langgraph.json` and is consumed by the PM platform and `deep-agents-ui` locally via `@langchain/langgraph-sdk`.

**Key architectural rule documented in both CLAUDE.md and AGENTS.md:** The agent never writes to the database directly. All write actions produce draft payloads that the PM platform UI shows to the user for approval before execution.

**Python ≥3.11, <3.14. Package manager: `uv`. Dev server: `uv run langgraph dev` on `http://127.0.0.1:2024`.**

---

## 2. Entry Point and Graph Structure

### `alleato-ai/agent.py` — 85 lines

- **Role:** agent-graph entry point
- **Purpose:** Builds the single `advisor` LangGraph graph using `create_deep_agent()` from the `deepagents` library. Configures the model, tools, system prompt, sub-agents, memory middleware, skills, and backend.
- **Graph structure:** Single node — `create_deep_agent()` returns a compiled LangGraph graph. The Deep Agents framework handles the internal node/edge structure (orchestrator loop, tool execution, sub-agent delegation). From the caller's perspective it is one graph object.
- **Model:** `openai:gpt-5.4` at `temperature=0.0` via `langchain.chat_models.init_chat_model`
- **Backend:** `FilesystemBackend(root_dir=REPO_ROOT, virtual_mode=True)`
- **Memory middleware:** `DbMemoryMiddleware()` — loads `ai_memories` rows from the Main App DB and injects them into the system prompt once per conversation thread
- **Skills:** `"./skills/"` directory loaded on demand
- **Runtime memory:** `"./alleato_ai/runtime/AGENTS.md"` injected as static memory

### Orchestrator tools (17 total)

| Tool | Source module |
|---|---|
| `resolve_project_by_name`, `resolve_vendor_by_name`, `resolve_contract`, `resolve_cost_code` (`RESOLVERS`) | `tools/resolvers.py` |
| `project_briefing_snapshot`, `project_budget_summary`, `project_risk_snapshot`, `portfolio_overview` | `tools/pm.py` |
| `describe_schema`, `query_db` | `tools/db.py` |
| `list_recent_meetings`, `search_meeting_transcripts`, `search_unstructured` | `tools/rag.py` |
| `recent_activity` | `tools/recent.py` |
| `think_tool` | `tools/think.py` |
| `draft_email`, `draft_teams_message`, `draft_rfi`, `draft_commitment`, `draft_change_event`, `draft_task` | `tools/actions.py` |

### `langgraph.json`

```json
{
  "dependencies": ["."],
  "graphs": { "advisor": "./agent.py:agent" },
  "env": ".env"
}
```

One graph named `advisor`, exported from `agent.py:agent`.

---

## 3. `tools/` Directory — File-by-File

### `tools/__init__.py`
- **File:** `alleato-ai/alleato_ai/tools/__init__.py`
- **Lines:** 95
- **Role:** tool-collection barrel export
- **Purpose:** Re-exports all tools from sub-modules into a single flat namespace. Defines `RESOLVERS` list (4 resolver tools). Provides `__all__` with 35 entries.
- **Data source:** `internal_state`

### `tools/actions.py`
- **File:** `alleato-ai/alleato_ai/tools/actions.py`
- **Lines:** 449
- **Role:** tool-collection (draft/write actions)
- **Purpose:** Implements the "draft, never execute" write pattern. Every tool serializes a Pydantic model into a standard JSON payload: `{"action":"preview","type":"...","message":"...","preview":{"table":"...","fields":{...}},"approval_required":true,"approval_reason":"..."}`. The PM platform UI consumes this payload and performs the actual write after human approval.

| Tool | Purpose |
|---|---|
| `draft_email` | Drafts an outbound email to one or more recipients |
| `draft_teams_message` | Drafts a Microsoft Teams channel message |
| `draft_rfi` | Drafts a new RFI record (`rfis` table) |
| `draft_commitment` | Drafts a subcontract or purchase order (`subcontracts` or `purchase_orders` table) |
| `draft_change_event` | Drafts a change event (`change_events` table) |
| `draft_task` | Drafts a task/action item (`tasks` table) |

- **Internal Pydantic models:** `DraftEmail`, `DraftTeamsMessage`, `DraftRFI`, `DraftCommitment`, `DraftChangeEvent`, `DraftChangeOrder`, `DraftSubmittal`, `DraftTask` (not all exposed as `@tool`)
- **Helper:** `_make_draft(draft_type, message, fields, table)` wraps any field dict into the standard payload shape
- **Table map:** `_TABLE_MAP` dict mapping type names to target DB table names. `commitment` dynamically resolves to `subcontracts` or `purchase_orders` based on `commitment_type`.
- **Data source:** `internal_state` (no DB calls; returns JSON string)

### `tools/acumatica.py`
- **File:** `alleato-ai/alleato_ai/tools/acumatica.py`
- **Lines:** 400
- **Role:** tool-collection (Acumatica ERP read access)
- **Purpose:** Cookie-based auth singleton (`_AcumaticaClient`) that calls the Acumatica OData REST API. Auth: POST to `/entity/auth/login` returns 204 + cookies. Session TTL: 15 min with auto-re-login on 401/403. Never uses `$filter` OData parameter (causes HTTP 500); filters in-memory after fetch.
- **Singleton:** `_client = _AcumaticaClient()` at module level. Thread-safe via `threading.Lock()`.
- **Unwrap utility:** `_unwrap()` recursively strips Acumatica's `{"value": ...}` envelope from all response fields.

| Tool | Purpose | Live status (per CLAUDE.md 2026-05-18) |
|---|---|---|
| `acumatica_ap_aging` | AP aging buckets (Current/1-30/31-60/61-90/90+) from `Bill` entity | Working |
| `acumatica_ar_aging` | AR aging buckets from `Invoice` entity | Broken (HTTP 500) |
| `acumatica_cash_position` | Rolling-window inflows (Payment) vs outflows (Check) | Broken (HTTP 500) |
| `acumatica_vendor_spend` | Total invoiced/paid/outstanding by vendor from `Bill` entity | Working |
| `acumatica_recent_bills` | Most recent AP bills from `Bill` entity | Working |
| `acumatica_recent_invoices` | Most recent AR invoices from `Invoice` entity | Broken (HTTP 500) |
| `acumatica_project_budget` | Project budget (original/revised/actuals/committed/variance) from `Project` + `ProjectBudget` | Not smoke-tested |
| `acumatica_project_pnl` | Alias for `acumatica_project_budget` | — |
| `acumatica_project_list` | All active projects with income/expenses/net from `Project` entity | Working |
| `acumatica_purchase_orders` | POs from `PurchaseOrder` entity | Broken (HTTP 500) |

- **Data source:** `acumatica_live`
- **External deps:** `httpx`, `os`, `threading`, `datetime`

### `tools/db.py`
- **File:** `alleato-ai/alleato_ai/tools/db.py`
- **Lines:** 199
- **Role:** tool-collection (PM database read access)
- **Purpose:** Read-only SQLAlchemy access to the Main App DB (Supabase `lgveqfnpkxvzbnnwuled`) via `DATABASE_URL` env var. Uses `NullPool` so each call gets a fresh connection; server-side pgbouncer does the pooling.

| Tool/Function | Purpose |
|---|---|
| `describe_schema(table_name?)` | Lists all public tables (no arg) or describes one table's columns + 2 sample rows |
| `query_db(sql)` | Executes read-only SELECT/WITH; rejects writes via regex; enforces 200-row cap + 30s timeout |
| `get_project_names(project_ids)` | Non-tool helper: resolves numeric project IDs to names; used by `recent.py` and `rag.py` |

- **Safety:** `_SELECT_RE`, `_FORBIDDEN_RE`, `_HAS_LIMIT_RE` regex guards. Auto-appends `LIMIT 200` if absent. Statement timeout set via `SET LOCAL statement_timeout`.
- **Data source:** `supabase_table:projects` (and all public schema tables via dynamic SQL)
- **External deps:** `sqlalchemy`, `langchain_core`, `alleato_ai.tools._retry`

### `tools/rag.py`
- **File:** `alleato-ai/alleato_ai/tools/rag.py`
- **Lines:** 418
- **Role:** tool-collection (RAG vector retrieval)
- **Purpose:** Queries the AI Database (Supabase `fqcvmfqldlewvbsuxdvz`) via the `search_document_chunks` RPC (pgvector cosine similarity). Embeds the query using `text-embedding-3-large` (3072 dims, same model as the ingestion pipeline). Supports two embedding variants: `baseline` (raw-text) and `contextual` (Anthropic Contextual Retrieval backfill — not yet active). Over-fetches 3× `match_count` to allow post-RPC date/version_status filtering. Optional Cohere or OpenAI reranking via `tools/rerank.py`.
- **Core function:** `retrieve(query, source_types?, project_id?, date_from?, date_to?, version_status?, max_results, rerank?, variant?)` — returns raw row dicts; called by all three tool wrappers.

| Tool | Purpose |
|---|---|
| `search_meeting_transcripts` | Semantic search restricted to `MEETING_SOURCE_TYPES` (6 meeting source types) |
| `list_recent_meetings` | Direct DB query (no embedding) on `document_chunks` ordered by `created_at DESC`; avoids the recurring-meeting `file_date` bug |
| `search_unstructured` | Semantic search across the full corpus with optional `source_types` filter |

- **`list_recent_meetings`** queries the AI Database directly using raw SQL with `DISTINCT ON (document_id)`, preferring summary chunks over transcript chunks.
- **Data source:** `supabase_rpc:search_document_chunks` (AI Database) + `supabase_table_rag:document_chunks` (for `list_recent_meetings`)
- **External deps:** `langchain_openai.OpenAIEmbeddings`, `sqlalchemy`, `alleato_ai.tools._retry`, `alleato_ai.tools.rerank` (conditional), `alleato_ai.tools.db.get_project_names`

### `tools/recent.py`
- **File:** `alleato-ai/alleato_ai/tools/recent.py`
- **Lines:** 313
- **Role:** tool-collection (structured PM recent-activity digest)
- **Purpose:** Answers "what changed lately" questions by querying 8 PM tables in parallel: `rfis`, `change_orders`, `change_events`, `submittals`, `owner_invoices`, `subcontractor_invoices`, `outlook_email_intake`, `daily_logs`. Self-introspecting: queries `information_schema.columns` at call time to discover which timestamp/label/status columns each table has, making it tolerant of schema drift. Per-table errors are swallowed and shown as `_(skipped: ...)_` so one bad table never blocks the digest.

| Tool | Purpose |
|---|---|
| `recent_activity(days_back?, project_id?, per_category_limit?)` | Markdown digest grouped by category, most-recent-first within each category. Project-scoped or portfolio-wide. |

- **Data source:** `multiple` (Main App DB: `rfis`, `change_orders`, `change_events`, `submittals`, `owner_invoices`, `subcontractor_invoices`, `outlook_email_intake`, `daily_logs`)
- **External deps:** `sqlalchemy`, `alleato_ai.tools.db.get_project_names`

### `tools/resolvers.py`
- **File:** `alleato-ai/alleato_ai/tools/resolvers.py`
- **Lines:** 361
- **Role:** tool-collection (entity disambiguation)
- **Purpose:** Turns ambiguous user strings into clean IDs with a confidence score. Uses `pg_trgm similarity()` when the extension is available (it is in the Main App DB), falling back to ILIKE. Implements a token-fallback strategy for low-confidence full-string matches (splits query into discriminating tokens ≥4 chars, not stopwords, and merges results). Classifies results into `confident`/`single_weak`/`ambiguous`/`no_match` based on top score and rival proximity.

| Tool | Purpose |
|---|---|
| `resolve_project_by_name(query)` | Matches against `projects.name`, `"job number"`, `address`, `aliases[]` |
| `resolve_vendor_by_name(query)` | Matches against `subcontractors.company_name`, `legal_business_name`, `dba_name` |
| `resolve_contract(query, project_id?)` | Matches against `commitments_unified` view on `contract_number` and `title` |
| `resolve_cost_code(query, project_id?)` | Matches against `cost_codes.id`, `title`, `division_title` (project_id accepted but not used — cost codes are global) |

- **Return type:** `ResolverResult` TypedDict: `{id, label, confidence, status, alternatives[]}`
- **Data source:** `supabase_table:projects`, `supabase_table:subcontractors`, `supabase_table:commitments_unified` (view), `supabase_table:cost_codes`

### `tools/pm.py`
- **File:** `alleato-ai/alleato_ai/tools/pm.py`
- **Lines:** 498
- **Role:** tool-collection (high-level PM briefing tools)
- **Purpose:** Compact markdown summaries of project state, budget, risk, and portfolio. Each tool runs multiple SQL queries against the Main App DB and assembles a formatted markdown response. Used directly by the orchestrator for fast answers without needing sub-agent delegation.

| Tool | Purpose | Tables queried |
|---|---|---|
| `project_briefing_snapshot` | Broad status snapshot: health, budget, contract, counts, recent docs, open items | `projects`, `v_budget_lines`, `prime_contract_financial_summary`, `rfis`, `submittals`, `schedule_tasks`, `commitments_unified`, `change_events`, `document_metadata` |
| `project_budget_summary` | Budget + prime contract financial summary | `projects`, `v_budget_lines`, `prime_contract_financial_summary` |
| `project_risk_snapshot` | Risk counts + open items + recent change events | `projects`, `rfis`, `submittals`, `schedule_tasks`, `change_events` |
| `portfolio_overview` | Cross-project table: health, completion, contract value, pending COs, issues, meetings | `projects`, `prime_contract_financial_summary`, `project_issue_summary`, `document_metadata` |

- **`_resolve_project(project_id?, project_name?)`:** Internal helper that accepts either an integer ID or fuzzy name string; raises `ValueError` if nothing found.
- **Data source:** `multiple` (Main App DB views and tables)

### `tools/graph_api.py`
- **File:** `alleato-ai/alleato_ai/tools/graph_api.py`
- **Lines:** 70
- **Role:** tool-collection
- **Purpose:** Named "Graph API" but does NOT make live Microsoft Graph API calls. Instead delegates to the RAG corpus via `tools/rag.retrieve()`. Teams and email content is already embedded in the AI Database by the alleato-pm Graph sync. Live Graph calls (send/post) go through `tools/actions.py`.

| Tool | Purpose |
|---|---|
| `search_teams_messages(query, channel?, date_from?, max_results?)` | Retrieves from `document_chunks` with `source_types=["teams_dm","teams_channel","teams_message"]` |
| `search_emails(query, from_address?, date_from?, max_results?)` | Retrieves from `document_chunks` with `source_types=["email","email_attachment"]` |

- **Data source:** `document_chunks_rag`

> ⚠️ **AUDIT FLAG:** This file's name implies live Graph access but it's actually pure RAG retrieval. This is exactly the kind of source-of-truth confusion the audit is meant to surface. See cross-cutting issues section in the eventual synthesis doc.

### `tools/think.py`
- **File:** `alleato-ai/alleato_ai/tools/think.py`
- **Lines:** 14
- **Role:** tool-collection
- **Purpose:** A no-op reflective pause tool. The orchestrator calls it between investigation steps to reason explicitly about what's known, missing, and what to investigate next. Returns the reflection string back to the model.
- **Exports:** `think_tool(reflection: str) -> str`
- **Data source:** `internal_state`

### `tools/rerank.py`
- **File:** `alleato-ai/alleato_ai/tools/rerank.py`
- **Lines:** 142
- **Role:** data-access helper (reranking layer for RAG)
- **Purpose:** Cross-encoder reranking for RAG results. Backend selection priority: (1) Cohere Rerank 3.5 if `COHERE_API_KEY` set, (2) OpenAI `gpt-4.1-mini` scoring if `OPENAI_API_KEY` set, (3) identity fallback (vector order). Fails open — any error returns `rows[:top_n]` in vector order.
- **Public entry point:** `rerank_results(query, rows, top_n) -> list[dict]`
- **OpenAI approach:** Batches candidates (20 per call) through a structured JSON scoring prompt, then sorts by score.
- **Data source:** `external_api:cohere` or `external_api:openai`

### `tools/_retry.py`
- **File:** `alleato-ai/alleato_ai/tools/_retry.py`
- **Lines:** 63
- **Role:** other (utility decorator)
- **Purpose:** Exponential-backoff retry decorator for transient Supabase pooler failures. Only retries on `OperationalError` whose message contains one of 6 known transient markers (e.g. `ECHECKOUTTIMEOUT`, `SSL connection has been closed`). Other exceptions propagate immediately. Max 3 attempts, base delay 1s.
- **Public function:** `with_db_retry(fn, *, max_attempts=3, base_delay=1.0) -> Callable`
- **Data source:** `internal_state`

---

## 4. `subagents/` Deep-Dive

The `alleato_ai/subagents/` directory contains three distinct things:

1. **`__init__.py`** — defines the 4 core advisor sub-agents as plain dicts passed to `create_deep_agent(subagents=...)`
2. **`content-builder-agent/`** — a standalone Deep Agents example (content writing, not PM-related)
3. **`llm-wiki/`** — another standalone Deep Agents example (wiki ingestion/query, not PM-related)
4. **`deep_research/`** — a third standalone Deep Agents example with its own `.venv`

The content-builder, llm-wiki, and deep_research directories appear to be reference examples included alongside the main agent code, **not part of the `advisor` graph's runtime**.

### `subagents/__init__.py` — 4 Core Sub-Agents
- **File:** `alleato-ai/alleato_ai/subagents/__init__.py`
- **Lines:** 121
- **Role:** subagent definitions
- **Purpose:** Defines 4 sub-agent dicts consumed by `create_deep_agent()`. Each dict has `name`, `description`, `system_prompt`, and `tools`. Exports `ALL_SUBAGENTS`.

| Sub-agent | Description | Tools |
|---|---|---|
| `financial-analyst` | Budget, commitments, change orders, pay apps, Acumatica data | `describe_schema`, `query_db`, all 9 `acumatica_*` tools, `project_budget_summary`, `portfolio_overview`, `think_tool` |
| `schedule-analyst` | Schedule status, float, critical path, delays | `describe_schema`, `query_db`, `project_briefing_snapshot`, `project_risk_snapshot`, `search_meeting_transcripts`, `list_recent_meetings`, `recent_activity`, `think_tool` |
| `risk-analyst` | RFIs, submittals, communications, contractual exposure | `describe_schema`, `query_db`, `project_briefing_snapshot`, `project_risk_snapshot`, `search_meeting_transcripts`, `list_recent_meetings`, `recent_activity`, `search_emails`, `search_teams_messages`, `think_tool` |
| `communications-analyst` | Meetings, Teams, email tone, stakeholder sentiment | `search_meeting_transcripts`, `list_recent_meetings`, `recent_activity`, `search_unstructured`, `search_emails`, `search_teams_messages`, `think_tool` |

Each sub-agent's system prompt is assembled from the prompt markdown files with `_SUBAGENT_OUTPUT_RULE` appended.

### `subagents/content-builder-agent/content_writer.py`
- **File:** `alleato-ai/alleato_ai/subagents/content-builder-agent/content_writer.py`
- **Lines:** 284
- **Role:** other (standalone example)
- **Purpose:** A standalone CLI script demonstrating the Deep Agents framework for content writing (blog posts, social media). Not connected to the PM advisor graph. Creates its own `create_deep_agent()` instance configured from `AGENTS.md`, `skills/`, and a `subagents.yaml` file. Tools: `web_search` (Tavily), `generate_cover` (Gemini image gen), `generate_social_image`.
- **Data source:** `external_api:tavily`, `external_api:google_genai`

### `subagents/llm-wiki/`
- **Files:** `runner.py`, `ingest.py`, `models.py`, `helpers.py`, `index.py`, `lint.py`, `log.py`, `query.py`, `init.py`
- **Role:** other (standalone example)
- **Purpose:** A LLM-backed wiki system using Deep Agents + LangSmith Sandbox. CLI modes: `init`, `ingest`, `query`, `lint`. Supports pulling/pushing a git-hosted wiki, staging source files in `/raw/`, having an agent update `/wiki/` pages, and committing back. `ingest.py` implements a two-phase review → apply workflow. Not connected to the PM advisor graph.
- **Data source:** `external_api:langsmith_sandbox`

### `subagents/deep_research/agent.py`
- **File:** `alleato-ai/alleato_ai/subagents/deep_research/agent.py`
- **Lines:** ~50 (has its own `.venv`)
- **Role:** other (standalone example)
- **Purpose:** A generic deep research agent using Tavily search and `think_tool`. References `research_agent.prompts` and `research_agent.tools` modules (not fully read; has its own virtualenv). Not connected to the PM advisor graph.
- **Data source:** `external_api:tavily`

---

## 5. `memory/` and `prompts/` Brief Overview

### `memory/`

- **`store.py`** (296 lines) — `load_user_memory(user_id)` and `load_project_memory(project_id)` query `ai_memories` table (Main App DB) filtering on `is_active=TRUE`, non-expired, and `type IN ('preference','lesson','commitment','context')`. Returns `UserMemory` and `ProjectMemory` dataclasses with a pre-formatted `raw_markdown` string. Limits: 30 user entries, 40 project entries. All failures return `None` (non-blocking).
- **`middleware.py`** (224 lines) — `DbMemoryMiddleware(AgentMiddleware)` — deepagents middleware. `before_agent` (sync and async variants) loads memories once per thread via a `_memory_loaded` private state flag. `wrap_model_call` / `awrap_model_call` inject the memory block as a `<durable_memory>` XML tag appended to the system prompt on every model call. Reads `user_id` and `project_id` from `config["configurable"]`.
- **`__init__.py`** — barrel export

**Data source:** `supabase_table:ai_memories`, `supabase_table:projects`

### `prompts/`

- **`__init__.py`** (63 lines) — Reads all `.md` files at import time using `pathlib.Path.read_text()`. Composes 5 constants:
  - `ORCHESTRATOR_PROMPT` = `identity.md` + `soul.md` + `orchestrator.md`
  - `FINANCIAL_ANALYST_PROMPT` = `financial_analyst.md` + `_subagent_output_rule.md`
  - `SCHEDULE_ANALYST_PROMPT` = `schedule_analyst.md` + `_subagent_output_rule.md`
  - `RISK_ANALYST_PROMPT` = `risk_analyst.md` + `_subagent_output_rule.md`
  - `COMMUNICATIONS_ANALYST_PROMPT` = `communications_analyst.md` + `_subagent_output_rule.md`
- **`identity.md`** — Agent identity: "Alleato AI — senior strategic advisor", "institutional memory that doesn't leave when someone does", PM domain vocabulary
- **`soul.md`** — Voice and behavioral constraints
- **`orchestrator.md`** (80 lines) — Entity resolution protocol, sub-agent delegation rules, graceful degradation ladder, answer contract (direct answer → evidence → interpretation → next steps → uncertainty), output style, data integrity rules
- **`financial_analyst.md`**, **`schedule_analyst.md`**, **`risk_analyst.md`**, **`communications_analyst.md`** — Domain-specific sub-agent instructions
- **`_subagent_output_rule.md`** — Shared `SubAgentReport` output contract appended to all four sub-agent prompts

---

## 6. Architecture Answers

### Q1: What is this repo's role?

`alleato-ai` is the **production LangGraph deployment target** for Alleato's AI advisor. It is a clean rebuild (not a migration) of the agent layer that previously existed in `alleato-pm`. It serves the PM platform as a backend service consumed via `@langchain/langgraph-sdk`. The data layer (both Supabase projects) is shared read-only with `alleato-pm`. As of CLAUDE.md (2026-05-18), it is in an active development/wiring state — some Acumatica tools are broken against the live instance, and the contextual RAG variant is not yet active.

### Q2: How does it get invoked?

- **Local dev:** `uv run langgraph dev` serves the graph at `http://127.0.0.1:2024` with assistant ID `advisor`. The `deep-agents-ui` connects to it locally.
- **Production:** The `langgraph.json` config makes this a LangGraph Platform deployment target. The PM platform frontend calls it via `@langchain/langgraph-sdk` using the `advisor` graph name, passing `user_id` and `project_id` in `config["configurable"]`.
- **No direct HTTP endpoint** is defined in this repo — the LangGraph Platform runtime manages the API surface.

### Q3: What's the agent graph structure?

The graph is a single `create_deep_agent()` call from the `deepagents` library. Internally, Deep Agents implements the orchestrator-subagent pattern as a LangGraph graph:
- **Orchestrator node:** Runs `gpt-5.4` with 17 tools + 4 sub-agent delegation capabilities
- **Sub-agent nodes (4):** `financial-analyst`, `schedule-analyst`, `risk-analyst`, `communications-analyst` — each with an isolated context window and its own tool subset
- **Memory middleware hook:** `DbMemoryMiddleware` runs `before_agent` (once per thread) and `wrap_model_call` (every model call)
- **Skills backend:** `FilesystemBackend` provides on-demand workflow documents from `./skills/`

The orchestrator decomposes questions, resolves entities, delegates to sub-agents (optionally in parallel), reflects via `think_tool`, then synthesizes a final `AdvisorAnswer`.

### Q4: Relationship with `backend/src/services/agents/alleato_ai_tools/`?

The backend directory is a **near-identical copy** of `alleato-ai/alleato_ai/tools/` ported into the Render FastAPI backend. Per `backend/src/services/agents/alleato_ai_tools/__init__.py` docstring: "These tools mirror the `alleato-ai` Deep Agents runtime."

Key structural difference: the backend `__init__.py` exports additional tool groupings (`READ_ONLY_PM_TOOLS`, `SQL_TOOLS`, `DRAFT_ACTION_TOOLS`, `EXTERNAL_ACCOUNTING_TOOLS`, `ORCHESTRATOR_TOOLS`) for use by the backend's own agent entrypoint. The `alleato-ai` `__init__.py` exports a flat list plus the `RESOLVERS` sentinel list only.

The backend also has `subagents.py` (a nearly identical copy of `alleato_ai/subagents/__init__.py`) and a `prompts/` subdirectory with the same 8 markdown files. The backend does NOT have the `memory/`, `schemas.py`, or the standalone example subagent directories (content-builder, llm-wiki, deep_research).

### Q5: What subagents exist?

Four investigator sub-agents defined in `alleato_ai/subagents/__init__.py`: `financial-analyst` (DB + Acumatica), `schedule-analyst` (DB + meeting search), `risk-analyst` (DB + communications search), `communications-analyst` (RAG only). Plus three standalone Deep Agents example projects in subdirectories of `subagents/` that are not part of the `advisor` graph.

---

## 7. Duplication Comparison with `backend/src/services/agents/alleato_ai_tools/`

| File | alleato-ai/ lines | backend/ lines | Status |
|---|---|---|---|
| `tools/actions.py` | 449 | 449 | `identical-likely` |
| `tools/acumatica.py` | 400 | 403 | `diverged-minor` (3 lines) |
| `tools/db.py` | 199 | 199 | `identical-likely` |
| `tools/rag.py` | 418 | 417 | `diverged-minor` (1 line) |
| `tools/recent.py` | 313 | 313 | `identical-likely` |
| `tools/resolvers.py` | 361 | 361 | `identical-likely` |
| `tools/pm.py` | 498 | 498 | `identical-likely` |
| `tools/graph_api.py` | 70 | 70 | `identical-likely` |
| `tools/think.py` | 14 | 14 | `identical-likely` |
| `tools/rerank.py` | 142 | 147 | `diverged-minor` (5 lines) |
| `tools/_retry.py` | 63 | 63 | `identical-likely` |
| `subagents/__init__.py` | 121 | 114 (`subagents.py`) | `diverged-minor` (import path differences) |
| `prompts/__init__.py` | 63 | 44 | `diverged-minor` (backend version shorter) |
| `prompts/orchestrator.md` | 80 | 80 | `identical-likely` |
| `prompts/soul.md` | 25 | 25 | `identical-likely` |
| `tools/__init__.py` | 95 | 149 | `diverged-major` (backend adds 5 tool-group lists) |
| `schemas.py` | 64 | (absent) | `only-here` |
| `memory/store.py` | 296 | (absent) | `only-here` |
| `memory/middleware.py` | 224 | (absent) | `only-here` |
| `agent.py` | 85 | (absent — backend has its own entrypoint) | `only-here` |

---

## Audit-pass summary

**`alleato-ai/`** is a standalone LangGraph + Deep Agents Python package that serves as the production deployment target for Alleato's AI advisor. It exposes a single graph (`advisor`) via `langgraph.json`, served locally by `uv run langgraph dev` and consumed by the PM platform via `@langchain/langgraph-sdk`. The graph is one `create_deep_agent()` call: a `gpt-5.4` orchestrator with 17 tools that plans, resolves entities, and delegates heavy investigation to 4 domain sub-agents (`financial-analyst`, `schedule-analyst`, `risk-analyst`, `communications-analyst`), each with an isolated context window. All writes are draft-only payloads; the PM platform performs actual writes after user approval.

The `tools/` layer is **nearly entirely duplicated** in `backend/src/services/agents/alleato_ai_tools/`. All 11 tool files have matching or near-matching line counts (within 5 lines), and the 8 prompt markdown files are line-for-line identical. The backend copy adds 5 tool-group list exports for use by the Render FastAPI backend's own agent orchestration. Three things exist only in `alleato-ai/`: `schemas.py` (the `AdvisorAnswer`/`SubAgentReport` contracts), `memory/` (the `ai_memories`-backed memory middleware), and the `agent.py` graph entrypoint. Three subdirectories in `alleato_ai/subagents/` (`content-builder-agent/`, `llm-wiki/`, `deep_research/`) are standalone Deep Agents reference examples unrelated to the PM advisor.

**Cross-cutting flag for synthesis pass:** `tools/graph_api.py` is misleadingly named — its tools `search_teams_messages` and `search_emails` read from the synced RAG corpus (`document_chunks_rag`), NOT live Microsoft Graph. This is precisely the source-of-truth confusion that motivated this audit. Live Graph access in this repo exists only via draft actions in `tools/actions.py`.
