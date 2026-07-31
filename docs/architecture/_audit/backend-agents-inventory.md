# Backend Python Agents Inventory — `backend/src/services/agents/`

**Audit pass:** 1c of 4 (fact-gathering)
**Date collected:** 2026-05-19
**Scope:** All Python files under `/Users/meganharrison/Documents/alleato-pm/backend/src/services/agents/` plus duplication comparison against `alleato-ai/alleato_ai/tools/`

---

- **File:** `backend/src/services/agents/deep_project_intelligence.py`
- **File:** `backend/src/services/agents/deep_project_intelligence_contracts.py`
- **File:** `backend/src/services/agents/pm_advisor_tools.py`

**2. `alleato_ai_tools/` Directory Deep-Dive**
- `identity.md`, `soul.md`
- `orchestrator.md`
- `_subagent_output_rule.md`
- `financial_analyst.md`
- `schedule_analyst.md`
- `risk_analyst.md`
- `communications_analyst.md`
- **Exports:** `ORCHESTRATOR_PROMPT`, `FINANCIAL_ANALYST_PROMPT`, `SCHEDULE_ANALYST_PROMPT`, `RISK_ANALYST_PROMPT`, `COMMUNICATIONS_ANALYST_PROMPT`

---

## 1. Top-Level Files

### `deep_project_intelligence.py`

- **File:** `backend/src/services/agents/deep_project_intelligence.py`
- **Lines:** ~1360
- **Role:** agent-definition (both agent setup + orchestration logic)
- **Purpose:** The primary orchestrator entry point for backend Deep Agents project and executive intelligence. Defines two public `build_*` functions that handle the "contract spike" path (read-only Supabase probes → typed coverage response) and the "deep_agents" path (live `create_deep_agent` call with tools + subagents + memory). Also holds shared utilities `_extract_agent_text`, `_resolve_deep_agents_model`, and `deep_agents_runtime_inventory()`.
- **Exports / public functions:**
  - `build_project_status_contract_spike(request, store, *, runtime, create_agent, model) -> DeepProjectIntelligenceResponse`
  - `build_executive_briefing_contract_spike(request, store, *, runtime, create_agent, model) -> DeepExecutiveIntelligenceResponse`
  - `deep_agents_runtime_inventory() -> dict`
  - `deep_agents_runtime_tool_names() -> tuple`
  - `deep_agents_runtime_subagent_names() -> tuple`
  - `_extract_agent_text(result) -> str` (used by `content_builder/agent.py` and `research_agent/agent.py`)
  - `_resolve_deep_agents_model(model) -> Any` (used by `content_builder/agent.py` and `research_agent/agent.py`)
- **Tools defined here:** None decorated with `@tool`. Internal callables (`source_coverage`, `pm_budget_summary`, `pm_briefing_snapshot`, `pm_risk_snapshot`) are defined as closures inside `_run_deep_agents_runtime` and `_run_deep_agents_executive_runtime` and passed directly to `create_agent()`.
- **Data source:** `multiple`
  - `supabase_table:projects`, `intelligence_targets`, `intelligence_packets`, `document_metadata`, `project_emails`, `project_documents`, `acumatica_project_budgets`, `schedule_tasks`, `rfis`, `submittals`
  - executive path adds: `daily_recaps`, `executive_briefing_follow_ups`
- **External deps:** `langchain_openai.ChatOpenAI`, `deepagents.create_deep_agent` (optional, imported at call-time), `src.services.agents.alleato_ai_tools` (tool groups), `src.services.agents.pm_advisor_tools` (Supabase-client-based versions), `src.services.agents.memory.DbMemoryMiddleware` (optional, flag-gated)
- **Imported by:** `backend/src/api/main.py` (3 symbols), `content_builder/agent.py` (2 symbols), `research_agent/agent.py` (same 2 symbols)

**Agent setup detail:**
When `runtime == "deep_agents"` and `DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED=true`, calls `deepagents.create_deep_agent()` with:
- `model`: resolved via `_resolve_deep_agents_model`, default `openai:gpt-5.4-mini`
- `tools`: closure tools + memory tools (if `DEEP_AGENTS_MEMORY_ENABLED`) + `_runtime_tools()` (gated by 4 separate feature flags)
- `system_prompt`: `ORCHESTRATOR_PROMPT` + backend runtime addendum
- `subagents`: `ALL_SUBAGENTS` (if `DEEP_AGENTS_SUBAGENTS_ENABLED`)
- `middleware`: `[DbMemoryMiddleware()]` (if `DEEP_AGENTS_MEMORY_ENABLED`)

**Source probe mechanism:** `_SourceProbe` objects enumerate 9 project sources (packet, teams, meetings, emails, documents, financials, schedule, rfi, submittal) and 10 executive sources. `_collect_source_coverage` / `_collect_executive_source_coverage` run each probe against Supabase, returning `SourceCoverage`, `EvidenceItem`, and `ToolTraceItem` lists.

### `deep_project_intelligence_contracts.py`

- **File:** `backend/src/services/agents/deep_project_intelligence_contracts.py`
- **Lines:** 140
- **Role:** contract/types
- **Purpose:** Pydantic v2 models defining the typed API contract for both the project-status and executive-briefing intelligence endpoints.
- **Exports:** `DeepProjectIntelligenceRequest`, `DeepExecutiveIntelligenceRequest`, `DeepProjectIntelligenceResponse`, `DeepExecutiveIntelligenceResponse`, `DeepProject`, `DeepOrganization`, `SourceCoverage`, `EvidenceItem`, `RecommendedAction`, `ToolTraceItem`, `MemoryCandidate`; Literal types: `Confidence`, `ProjectStatusIntent`, `ExecutiveBriefingIntent`, `SourceStatus`, `ToolStatus`, `MemoryScope`
- **Data source:** `internal_state`
- **Imported by:** `backend/src/api/main.py`, `deep_project_intelligence.py`, `memory/tools.py`

### `pm_advisor_tools.py`

- **File:** `backend/src/services/agents/pm_advisor_tools.py`
- **Lines:** 348
- **Role:** tool-collection
- **Purpose:** Supabase-client-based (not SQLAlchemy) versions of the four core PM advisor functions. Called by `deep_project_intelligence.py` closures when the agent runtime reads from a `SupabaseRagStore`-injected client. Distinct from `alleato_ai_tools/pm.py` which uses SQLAlchemy and `DATABASE_URL`. These functions receive a `supabase.Client` directly.
- **Exports:**
  - `project_budget_summary(client: Client, project_id: int) -> str`
  - `project_risk_snapshot(client: Client, project_id: int) -> str`
  - `project_briefing_snapshot(client: Client, project_id: int) -> str`
  - `portfolio_overview(client: Client, phase: str, max_projects: int) -> str`
- **Data source:** `multiple` (same tables as `alleato_ai_tools/pm.py`)
- **External deps:** `supabase.Client`
- **Imported by:** `deep_project_intelligence.py`

> ⚠️ **AUDIT FLAG:** This file duplicates the four PM functions in `alleato_ai_tools/pm.py` using a different DB access method (supabase.Client vs SQLAlchemy). Synthesis pass should call out whether both implementations need to exist.

---

## 2. `alleato_ai_tools/` Directory Deep-Dive

### `alleato_ai_tools/__init__.py`

- **Lines:** 149
- **Role:** tool-collection (barrel re-export + group definitions)
- **Purpose:** Imports all tools from sibling modules and assembles them into named groups used by the orchestrator and sub-agents.
- **Tool groups:**
  - `RESOLVERS`: 4 resolver tools
  - `READ_ONLY_PM_TOOLS`: RESOLVERS + 11 PM/RAG/comms tools
  - `SQL_TOOLS`: `describe_schema`, `query_db`
  - `DRAFT_ACTION_TOOLS`: 6 draft tools
  - `EXTERNAL_ACCOUNTING_TOOLS`: 10 Acumatica tools
  - `ORCHESTRATOR_TOOLS`: all of the above (29 total)
- **Imported by:** `deep_project_intelligence.py`, `research_agent/agent.py`, `subagents.py`

### `alleato_ai_tools/actions.py`

- **Lines:** 535
- **Role:** tool-collection
- **Purpose:** Six `@tool`-decorated draft-generation functions. The agent never writes directly to the database. Each tool builds a preview JSON payload (`action: "preview"`, `approval_required: true`) and returns it as a JSON string. The PM platform UI executes the write after approval.
- **Tools:** `draft_email`, `draft_teams_message`, `draft_rfi`, `draft_commitment`, `draft_change_event`, `draft_task`
- **Data source:** `internal_state` (no DB reads; returns approval preview payload only)

### `alleato_ai_tools/acumatica.py`

- **Lines:** 506
- **Role:** tool-collection
- **Purpose:** Ten `@tool`-decorated read-only functions querying the Acumatica ERP REST API. Uses singleton `_AcumaticaClient` with cookie-session management. OData `$filter` is never used.
- **Tools:** `acumatica_ap_aging`, `acumatica_ar_aging`, `acumatica_cash_position`, `acumatica_vendor_spend`, `acumatica_recent_bills`, `acumatica_recent_invoices`, `acumatica_project_budget`, `acumatica_project_pnl` (alias), `acumatica_project_list`, `acumatica_purchase_orders`
- **Data source:** `acumatica_live`
- **Source specifics:** `https://alleatogroup.acumatica.com/entity/Default/24.200.001/{Bill,Invoice,Payment,Check,Project,ProjectBudget,PurchaseOrder}`

### `alleato_ai_tools/db.py`

- **Lines:** 238
- **Role:** data-access + tool-collection
- **Purpose:** Two `@tool` SQL tools plus helper. Connects to Main App DB via `DATABASE_URL` using SQLAlchemy with `NullPool`. `query_db` rejects non-SELECT via regex. 200-row cap, 30s statement timeout.
- **Tools:** `describe_schema(table_name)`, `query_db(sql)`
- **Helpers:** `get_project_names(project_ids)`, `_engine()` (lru_cache)
- **Data source:** `supabase_table:*` (any table in PM APP via `DATABASE_URL`)

### `alleato_ai_tools/graph_api.py`

- **Lines:** 83
- **Role:** tool-collection
- **Purpose:** Two thin `@tool` wrappers that delegate to `rag.retrieve()`. **Despite the filename, these do NOT make live Microsoft Graph API calls.** Teams and email content is queried via the `document_chunks` vector corpus.
- **Tools:** `search_teams_messages`, `search_emails`
- **Data source:** `document_chunks_rag` (`supabase_rpc:search_document_chunks` in AI Database `fqcvmfqldlewvbsuxdvz`)

> ⚠️ **AUDIT FLAG:** Misleading filename — same issue flagged in alleato-ai inventory. Both `graph_api.py` files (backend + standalone) read RAG, not live Graph.

### `alleato_ai_tools/pm.py`

- **Lines:** 570
- **Role:** tool-collection
- **Purpose:** Four `@tool`-decorated high-level PM advisor tools using SQLAlchemy + `DATABASE_URL`. SQL equivalents of `pm_advisor_tools.py` (which uses `supabase.Client`).
- **Tools:** `project_budget_summary`, `project_briefing_snapshot`, `project_risk_snapshot`, `portfolio_overview`
- **Data source:** `multiple` (PM APP DB tables/views)

### `alleato_ai_tools/rag.py`

- **Lines:** 479
- **Role:** data-access + tool-collection
- **Purpose:** Three `@tool` RAG retrieval functions plus public `retrieve()`. Connects to AI Database via `get_rag_read_client()`. Embeds with `openai.OpenAI` (model `text-embedding-3-large`, 3072 dims) via Vercel AI Gateway or direct.
- **Tools:** `search_meeting_transcripts`, `list_recent_meetings`, `search_unstructured`
- **Data source:** `document_chunks_rag` (`supabase_rpc:search_document_chunks` + `supabase_table:document_chunks` in AI Database `fqcvmfqldlewvbsuxdvz`)

### `alleato_ai_tools/recent.py`

- **Lines:** 363
- **Role:** data-access + tool-collection
- **Purpose:** Single `@tool` for "what changed lately" digests. Schema-introspecting (`information_schema.columns`), per-table errors swallowed.
- **Tools:** `recent_activity(days_back, project_id, per_category_limit)`
- **Data source:** `multiple` (`rfis`, `change_orders`, `change_events`, `submittals`, `owner_invoices`, `subcontractor_invoices`, `outlook_email_intake`, `daily_logs`)

### `alleato_ai_tools/resolvers.py`

- **Lines:** 424
- **Role:** tool-collection + resolver
- **Purpose:** Four `@tool` entity-resolution functions. Uses `pg_trgm similarity()` when available; falls back to `ILIKE`. Returns `ResolverResult` with confidence + status.
- **Tools:** `resolve_project_by_name`, `resolve_vendor_by_name`, `resolve_contract`, `resolve_cost_code`
- **Data source:** `supabase_table:projects`, `subcontractors`, `commitments_unified` (view), `cost_codes`

### `alleato_ai_tools/think.py`

- **Lines:** 20
- **Role:** tool-collection
- **Purpose:** Single `@tool` that echoes back a reflection string. Forces explicit reasoning step.
- **Tools:** `think_tool(reflection) -> str`
- **Data source:** `internal_state`

### `alleato_ai_tools/rerank.py`

- **Lines:** 188
- **Role:** rerank
- **Purpose:** Cross-encoder reranking. Cohere Rerank 3.5 → OpenAI `gpt-4.1-mini` → identity fallback. Fails open.
- **Exports:** `rerank_results(query, rows, top_n)`
- **Data source:** `external_api:cohere` or `external_api:openai`

### `alleato_ai_tools/_retry.py`

- **Lines:** 78
- **Role:** retry-utility
- **Purpose:** Decorator that retries `sqlalchemy.exc.OperationalError` on 5 specific transient Supabase pgbouncer error patterns. Max 3 attempts, base delay 1.0s.
- **Exports:** `with_db_retry`

### `alleato_ai_tools/subagents.py`

- `alleato_ai_tools/subagents.py`

- **Lines:** 121
- **Role:** agent-definition (sub-agent definitions)
- **Purpose:** Defines 4 sub-agent config dicts consumed by `create_deep_agent(subagents=...)`.

| Sub-agent | Tools |
|---|---|
| `financial_analyst` | `describe_schema`, `query_db`, 9 Acumatica tools, `project_budget_summary`, `portfolio_overview`, `think_tool` |
| `schedule_analyst` | `describe_schema`, `query_db`, `project_briefing_snapshot`, `project_risk_snapshot`, `search_meeting_transcripts`, `list_recent_meetings`, `recent_activity`, `think_tool` |
| `risk_analyst` | `describe_schema`, `query_db`, `project_briefing_snapshot`, `project_risk_snapshot`, `search_meeting_transcripts`, `list_recent_meetings`, `recent_activity`, `search_emails`, `search_teams_messages`, `think_tool` |
| `communications_analyst` | `search_meeting_transcripts`, `list_recent_meetings`, `recent_activity`, `search_unstructured`, `search_emails`, `search_teams_messages`, `think_tool` |

- **Exports:** `ALL_SUBAGENTS`, individual dicts

### `alleato_ai_tools/prompts/__init__.py`

- **Lines:** 63
- **Role:** prompt
- **Purpose:** Loads and composes system prompts from markdown files. `ORCHESTRATOR_PROMPT = identity.md + soul.md + orchestrator.md`. Each sub-agent prompt appends `_subagent_output_rule.md`.
- **Prompt files:** `identity.md`, `soul.md`, `orchestrator.md`, `_subagent_output_rule.md`, `financial_analyst.md`, `schedule_analyst.md`, `risk_analyst.md`, `communications_analyst.md`
- **Exports:** `ORCHESTRATOR_PROMPT`, `FINANCIAL_ANALYST_PROMPT`, `SCHEDULE_ANALYST_PROMPT`, `RISK_ANALYST_PROMPT`, `COMMUNICATIONS_ANALYST_PROMPT`

---

## 3. `content_builder/` Agent Deep-Dive

### `content_builder/agent.py`

- **Lines:** 271
- **Role:** agent-definition
- **Purpose:** Content builder Deep Agent. Creates per-request filesystem workspace (under `/tmp/alleato-content-builder/<user>/<session>`), copies packaged `AGENTS.md`, `subagents.yaml`, and `skills/` into it. Writes blog posts, LinkedIn posts, Twitter/X threads, research files. `_collect_artifacts()` scans workspace afterward.
- **Public function:** `run_content_builder_agent(request, *, create_agent, model)`
- **Model:** `openai:gpt-5.4-mini` default; override via `DEEP_AGENTS_CONTENT_BUILDER_MODEL`
- **Tools:** `content_builder_tools()` (image tools if `include_images`) + researcher subagent with `web_search`
- **Data source:** `external_api:tavily` (web_search), `external_api:gemini` (image gen)

### `content_builder/tools.py`

- **Lines:** 139
- **Tools:** `web_search` (Tavily), `generate_cover` (gemini-2.5-flash-image), `generate_social_image`
- **Data source:** `external_api:tavily`, `external_api:gemini`

### `content_builder/contracts.py`

- **Lines:** 63
- **Exports:** `ContentBuilderRequest`, `ContentBuilderResponse`, `ContentBuilderArtifact`, `ContentBuilderTraceItem`

---

## 4. `research_agent/` Agent Deep-Dive

### `research_agent/agent.py`

- **Lines:** 277
- **Role:** agent-definition
- **Purpose:** Research Deep Agent. Combines public-web tools (Tavily + fetch_url) with full `READ_ONLY_PM_TOOLS`. Defines 2 fixed sub-agents (`web_researcher`, `alleato_internal_researcher`) plus the 4 from `ALL_SUBAGENTS`. Optional `DbMemoryMiddleware`.
- **Public function:** `run_research_agent(request, *, create_agent, model)`
- **Model:** `openai:gpt-5.4-mini` default; override via `DEEP_AGENTS_RESEARCH_MODEL`
- **Data source:** `multiple` (`external_api:tavily`, `document_chunks_rag`, `supabase_table:*`)

### `research_agent/tools.py`

- **Lines:** 110
- **Tools:** `web_search(query, max_results)` (Tavily, returns formatted string), `fetch_url(url, max_chars)` (httpx + BeautifulSoup)
- **Data source:** `external_api:tavily`, `external_api:web`

### `research_agent/contracts.py`

- **Lines:** 60
- **Exports:** `ResearchRequest`, `ResearchResponse`, `ResearchSource`, `ResearchTraceItem`

---

## 5. `memory/` Deep-Dive

### `memory/store.py`

- **Lines:** 373
- **Role:** memory-store
- **Purpose:** Read/query layer for `ai_memories` table. `load_user_memory` (≤30 entries, user-scoped, null project_id), `load_project_memory` (≤40 entries, project-scoped). Recall functions rank in-process: `score = importance * 2.0 + confidence * 0.5 + term_hits + exact_bonus`.
- **Exports:** `load_user_memory`, `load_project_memory`, `build_memory_block`, `recall_user_memories`, `recall_project_memories`, `recall_team_memories`, `format_memory_entries`, `UserMemory`, `ProjectMemory`, `MemoryEntry`
- **Data source:** `supabase_table:ai_memories`, `supabase_table:projects`

### `memory/tools.py`

- **Lines:** 89
- **Role:** tool-collection
- **Purpose:** Factory `build_memory_tools()` returns 4 `StructuredTool`s bound to current `user_id`/`project_id`. `propose_memory_candidate` does NOT write to DB — appends to in-memory `candidate_sink` for human approval.
- **Tools:** `recall_user_memory`, `recall_project_memory`, `recall_team_memory`, `propose_memory_candidate`
- **Data source:** `supabase_table:ai_memories` (read only)

### `memory/middleware.py`

- **Lines:** 145
- **Role:** Deep Agents middleware
- **Purpose:** `DbMemoryMiddleware` implements `AgentMiddleware`. `before_agent` loads `ai_memories` once per thread. `wrap_model_call`/`awrap_model_call` inject memory block as `<durable_memory>` XML in system prompt via `append_to_system_message`.
- **Exports:** `DbMemoryMiddleware`

---

## 6. Architecture Answers

### Q1: Is there an agent definition? Where? What tools/model/prompt?

Yes — **three distinct agent definitions**, each calling `deepagents.create_deep_agent()`:

**1. Project / Executive Intelligence Agent** (`deep_project_intelligence.py:1002–1098`, `1101–1181`)
- Gated by: `DEEP_AGENTS_PROJECT_INTELLIGENCE_RUNTIME=deep_agents` AND `DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED=true`
- Model: `openai:gpt-5.4-mini` default
- Tools: closure tools (`source_coverage`, `pm_budget_summary`, etc.) + optional memory + `_runtime_tools()` gated by 4 separate flags
- Prompt: `ORCHESTRATOR_PROMPT` + backend runtime addendum
- Sub-agents: `ALL_SUBAGENTS` (4 domain agents)
- Middleware: `DbMemoryMiddleware()` when flagged

**2. Content Builder Agent** (`content_builder/agent.py:179–270`)
- Gated by: `DEEP_AGENTS_CONTENT_BUILDER_ENABLED=true`
- Model: `openai:gpt-5.4-mini` default
- Tools: image tools (orchestrator) + `web_search` (researcher subagent)
- Backend: `FilesystemBackend` with per-request workspace

**3. Research Agent** (`research_agent/agent.py:183–256`)
- Gated by: `DEEP_AGENTS_RESEARCH_ENABLED=true`
- Model: `openai:gpt-5.4-mini` default
- Tools: `web_research_tools()` + `READ_ONLY_PM_TOOLS` (17 total) + optional memory
- Sub-agents: `web_researcher`, `alleato_internal_researcher`, plus all 4 from `ALL_SUBAGENTS` (6 total)
- Middleware: `DbMemoryMiddleware` when flagged

### Q2: Relationship between `agents/alleato_ai_tools/` and `alleato-ai/alleato_ai/tools/`?

**Near-identical copies that have diverged slightly.** Both directories contain the same 11 filenames. Not symlinks — independent packages with different import roots (`src.services.agents.alleato_ai_tools.*` vs `alleato_ai.tools.*`).

| File | Backend lines | Standalone lines | Verdict |
|---|---|---|---|
| `actions.py` | 535 | 535 | identical-likely |
| `acumatica.py` | 506 | 503 | diverged-minor (3 lines) |
| `db.py` | 238 | 238 | identical-likely |
| `graph_api.py` | 83 | 83 | identical-likely |
| `pm.py` | 570 | 570 | identical-likely |
| `rag.py` | 479 | 484 | **diverged** — backend uses `openai.OpenAI` + `get_rag_read_client()`; standalone uses `langchain_openai.OpenAIEmbeddings` + own SQLAlchemy engine |
| `recent.py` | 363 | 363 | identical-likely |
| `rerank.py` | 188 | 183 | diverged-minor (5 lines) |
| `resolvers.py` | 424 | 424 | identical-likely |
| `think.py` | 20 | 20 | identical |
| `_retry.py` | 78 | 78 | identical |

**Backend-only:** `subagents.py` (121 lines), `prompts/` directory.

### Q3: Is `deep_project_intelligence.py` a tool or agent?

**Both — an orchestration service AND an indirect agent launcher.** It does not expose `@tool`-decorated functions. As orchestration: the two public `build_*` functions probe Supabase and return typed Pydantic responses. As agent launcher: when `runtime == "deep_agents"`, they call `create_deep_agent()` internally.

**Invoked from `backend/src/api/main.py`:**
- Line 1159: `POST /api/intelligence/deep-agent/project-status` → `build_project_status_contract_spike()`
- Line 1199: `GET /api/intelligence/deep-agent/tool-inventory` → `deep_agents_runtime_inventory()`
- Line 1211: `POST /api/intelligence/deep-agent/executive-briefing` → `build_executive_briefing_contract_spike()`

All require `require_admin_api_key`.

### Q4: Backend AI HTTP endpoints

5 routes under `/api/intelligence/`, all admin-key gated:

| Method | Path | Function | Feature flag |
|---|---|---|---|
| POST | `/api/intelligence/deep-agent/project-status` | `run_deep_agent_project_status` | `DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED` |
| GET | `/api/intelligence/deep-agent/tool-inventory` | `get_deep_agent_tool_inventory` | none |
| POST | `/api/intelligence/deep-agent/executive-briefing` | `run_deep_agent_executive_briefing` | `DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED` |
| POST | `/api/intelligence/content-builder` | `run_deep_agent_content_builder` | `DEEP_AGENTS_CONTENT_BUILDER_ENABLED` |
| POST | `/api/intelligence/research` | `run_deep_agent_research` | `DEEP_AGENTS_RESEARCH_ENABLED` |

---

## 7. Duplication Map

| Backend file | Standalone counterpart | Verdict |
|---|---|---|
| `alleato_ai_tools/actions.py` | `alleato_ai/tools/actions.py` | identical-likely (import path only) |
| `alleato_ai_tools/acumatica.py` | `alleato_ai/tools/acumatica.py` | diverged-minor (3 lines) |
| `alleato_ai_tools/db.py` | `alleato_ai/tools/db.py` | identical-likely (import path only) |
| `alleato_ai_tools/graph_api.py` | `alleato_ai/tools/graph_api.py` | identical-likely |
| `alleato_ai_tools/pm.py` | `alleato_ai/tools/pm.py` | identical-likely |
| `alleato_ai_tools/rag.py` | `alleato_ai/tools/rag.py` | **diverged** (embedding client + RAG DB access) |
| `alleato_ai_tools/recent.py` | `alleato_ai/tools/recent.py` | identical-likely |
| `alleato_ai_tools/rerank.py` | `alleato_ai/tools/rerank.py` | diverged-minor (5 lines) |
| `alleato_ai_tools/resolvers.py` | `alleato_ai/tools/resolvers.py` | identical-likely |
| `alleato_ai_tools/think.py` | `alleato_ai/tools/think.py` | identical |
| `alleato_ai_tools/_retry.py` | `alleato_ai/tools/_retry.py` | identical |
| `alleato_ai_tools/subagents.py` | (no counterpart — alleato-ai uses `subagents/__init__.py` instead) | backend-only filename |
| `alleato_ai_tools/prompts/*` | `alleato_ai/prompts/*` | backend has 8 .md files; alleato-ai has same set |

**Standalone-only:** `alleato-ai/alleato_ai/schemas.py`, `memory/store.py`, `memory/middleware.py`, `agent.py` (graph entrypoint), `subagents/content-builder-agent/`, `subagents/llm-wiki/`, `subagents/deep_research/`.

**Backend-only:** `deep_project_intelligence.py` (orchestration shell), `pm_advisor_tools.py` (supabase.Client version), `content_builder/` directory, `research_agent/` directory, `memory/` directory (functionally similar to standalone but separate code).

---

## Audit-pass summary

**Tools and agents:**
- **29 named `@tool`-decorated functions** in `alleato_ai_tools/` (11 PM/resolver/RAG/comms + 2 SQL + 6 draft + 10 Acumatica) + 2 in `research_agent/tools.py` + 3 in `content_builder/tools.py` + 4 from `build_memory_tools()` = **38+ tool functions total**
- **3 agent runtimes** invoked via `create_deep_agent()`: project/executive intelligence, content builder, research
- **4 sub-agents** in `subagents.py` (financial, schedule, risk, communications) + 2 inline in research agent

**Duplication:** Backend `alleato_ai_tools/` and standalone `alleato_ai/tools/` share 11 filenames. 9 of 11 are same-size (likely identical except import paths). `rag.py` has diverged in embedding client (backend uses `openai.OpenAI` + Supabase helper; standalone uses `langchain_openai.OpenAIEmbeddings` + own SQLAlchemy engine). Backend has additional orchestration shell (`deep_project_intelligence.py`, `pm_advisor_tools.py`) and dedicated agent subdirectories (`content_builder/`, `research_agent/`, `memory/`) not present in the standalone repo.

**Backend HTTP routes:** 5 routes in `backend/src/api/main.py` wire these agents — all under `/api/intelligence/`, all admin-key gated.

**Cross-cutting flags for synthesis pass:**
1. `graph_api.py` is misleadingly named — its tools `search_teams_messages` and `search_emails` read from RAG, NOT live Microsoft Graph (same finding as alleato-ai inventory).
2. `pm_advisor_tools.py` and `alleato_ai_tools/pm.py` implement the same 4 PM functions using different DB access methods (supabase.Client vs SQLAlchemy). Synthesis should determine whether both versions need to coexist.
3. `rag.py` has genuinely diverged between backend and standalone — the backend uses `openai.OpenAI` + `get_rag_read_client()`; the standalone uses `langchain_openai.OpenAIEmbeddings` + own SQLAlchemy engine. Either intentional or drift.
