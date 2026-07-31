# Frontend AI Orchestration Inventory — `frontend/src/lib/ai/` (excluding `tools/`)

**Audit pass:** 1b of 4 (fact-gathering)
**Date collected:** 2026-05-19
**Scope:** Everything under `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/` EXCEPT the `tools/` subdirectory (covered by pass 1a)

---

## 1. Top-Level File Inventory

### `orchestrator.ts`
- **Lines:** ~1164
- **Role:** orchestrator
- **Purpose:** Defines `agentRegistry` (CFO, COO, CRO, CHRO, VP BD, CMO) with system prompt, model ID, trigger keywords, optional `createTools` factory each. Exports `consultAgent` (single specialist via `ToolLoopAgent`, max 5 steps, 15s timeout), `consultAgents` (parallel multi-specialist), `createStrategistTools` (assembles full Strategist tool set including all `consultXxx` consult tools + base project tools), `getStrategistSystemPrompt` (soul + identity + strategist prompt + today's date), `buildCouncilModePromptInjection`, and `STRATEGIST_MODEL = "openai/gpt-5.4"`.
- **Exports:** `agentRegistry`, `AgentConfig`, `consultAgent`, `consultAgents`, `createStrategistTools`, `createSpecialistAgentTools`, `getStrategistSystemPrompt`, `buildCouncilModePromptInjection`, `STRATEGIST_MODEL`
- **Imports from `tools/`:** `project-tools`, `web-search`, `action-tools`, `feature-request-tools`, `marketing`, `progress-report-tools`, `workspace-tools`, `structured-output`, `document-intelligence`, `intelligence-tools`
- **Data sources touched:** `internal_state` (orchestrates sub-agents; data access delegated to tool factories)
- **Used by:** `app/api/ai-assistant/chat/handler-v2.ts`, `bot-core.ts`, `system-prompt.ts`, `lib/bot/index.ts`

### `providers.ts`
- **Lines:** 134
- **Role:** provider-config
- **Purpose:** Creates the OpenAI-compatible language model provider. Lazily initializes `openaiProvider` via `getOpenAICompatibleClientConfig` (routes to AI Gateway at `https://ai-gateway.vercel.sh/v1` when `AI_GATEWAY_API_KEY` is set, or direct OpenAI otherwise). Wraps models with DevTools middleware in `development`. Exports `getLanguageModel(modelId)` as the single entry point for model instantiation. `getTitleModel()` / `getArtifactModel()` pinned to `gpt-4.1-nano`. In test envs uses `customProvider` with mocked models.
- **Exports:** `myProvider`, `getLanguageModel`, `getTitleModel`, `getArtifactModel`, `getGatewayProvider`
- **Data sources touched:** `none`
- **Used by:** virtually every AI module that makes LLM calls

### `provider-config.ts`
- **Lines:** 131
- **Role:** provider-config
- **Purpose:** Reads `AI_PROVIDER_PATH` / `AI_GATEWAY_API_KEY` to determine routing. Exports `getAiProviderPath()`, `getOpenAICompatibleClientConfig(purpose)`, `getOpenAIModelId(modelId)`, `formatAIProviderFailure(error, purpose)`.
- **Used by:** `providers.ts`, `services/conversation-memory.ts`, `services/ai-memory-service.ts`, `services/agent-learning-service.ts`

### `fallback-chain.ts`
- **Lines:** 59
- **Role:** utility
- **Purpose:** Generates recovery response when primary Strategist run produces empty text. Calls `generateText` on `openai/gpt-4.1` (different model to avoid same failure mode) with original message, failure cause, and last 12 tool trace entries. Falls back to `createStrategistFailureResponse`.
- **Used by:** `handler-v2.ts`

### `intent-router.ts`
- **Lines:** 231
- **Role:** intent-classifier
- **Purpose:** Deterministic regex-based intent classifier. 16 `AssistantIntent` values. Priority-ordered pattern matching: `task_write` first, then calendar, email, external research, source lookup, project status, app help, change management, financial, decision, task followup, risk, project status, implementation planning, strategy. Exports `classifyAssistantIntent` and `shouldUsePacketFirstIntent` (8 intents warrant pre-fetching project intelligence packet).
- **Used by:** `intent-classifier.ts`, `retrieval/planner.ts`, `deep-agent-project-status.ts`

### `intent-classifier.ts`
- **Lines:** 191
- **Role:** intent-classifier
- **Purpose:** Model-based intent planner augmenting deterministic router. Calls `generateObject` on active model with 7-second timeout to produce structured `IntentPlannerDecision` (intent, confidence, responseMode, requiredTools, shouldAskClarifyingQuestion, rationale). If model returns downgrade (e.g., `general_conversation` when deterministic said `task_write`), `shouldPreferDeterministicIntent` overrides. Falls back to deterministic on timeout/failure.
- **Used by:** `handler-v2.ts`

### `detect-rag-request.ts`
- **Lines:** 369
- **Role:** intent-classifier
- **Purpose:** Pattern-matching for source-specific RAG requests. `SourceSpecificRagKind`: 5 kinds — `meetings_on_date`, `recent_meetings`, `recent_emails`, `recent_onedrive_documents`, `recent_teams_discussions`. Date parsing (ISO, month ranges, "this week/last week/friday"). Exports `detectSourceSpecificRagRequest`, `detectRecentEmailInboxRequest`, `detectSourceLookupRecentTeamsRequest`.
- **Used by:** `preflights.ts`, `retrieval/planner.ts`, `intent-classifier.ts`

### `preflights.ts`
- **Lines:** 421
- **Role:** data-fetcher
- **Purpose:** Server-side pre-retrieval. `buildSourceSpecificRagAnswer` dispatches to `document_metadata` query by `SourceSpecificRagKind`. For meetings_on_date/recent_meetings: by `date` then `created_at`. For email/onedrive/teams: applies category filters. Admin-only for email/Teams. Exports `appendSourceHealthSummary`, `formatSourceSpecificRagContent`.
- **Imports from `tools/`:** `guardrails`
- **Data sources touched:** `supabase_table:document_metadata`
- **Used by:** `handler-v2.ts` (legacy path); newer path is `retrieval/source-specific-rag.ts`

### `prompt-diagnostics.ts`
- **Lines:** 202
- **Role:** trace/observability
- **Purpose:** Assembles & analyses system prompt for diagnostics. 15 `SECTION_MARKERS` regex patterns. Exports `assembleAssistantPromptDiagnostics` (calls `assembleSystemPrompt`, returns hash + char count + token estimate + section presence map), `assertNonEmptySystemPrompt`, `buildAiSdkPromptPayload`, `redactSystemPrompt`, `summarizeSystemPrompt`.
- **Used by:** `/api/ai-assistant/diagnostics` route

### `system-prompt.ts`
- **Lines:** 37
- **Role:** prompt
- **Purpose:** Thin re-export wrapper for `assembleSystemPrompt` from `bot-core`. Adds dev-only token-count log (heuristic `length / 4`).

### `prompts.ts`
- **Lines:** 140
- **Role:** prompt
- **Purpose:** Legacy/generic prompt strings: `artifactsPrompt`, `regularPrompt`, `codePrompt`, `sheetPrompt`, `updateDocumentPrompt`, `titlePrompt`, `systemPrompt` factory.
- **Used by:** `app/api/chat/route.ts` (simpler non-RAG endpoint)

### `rag-assistant-prompt.ts`
- **Lines:** 453
- **Role:** prompt
- **Purpose:** Exports `ragAssistantSystemPrompt` — full operational instructions for Alleato AI assistant. Composes `soul` + `identity` + `I_DONT_KNOW_REFLEX_PROMPT` + `getAssistantSelfKnowledgePrompt()` + tool-selection tables, write-action workflows, submit/spec workflows, disambiguation rules. **Not the primary prompt path in `handler-v2.ts`** (which uses `bot-core.assembleSystemPrompt`).

### `bot-core.ts`
- **Lines:** 672
- **Role:** orchestrator
- **Purpose:** Shared bot core used by both web UI (`handler-v2.ts`) and external channel bots (Slack, Teams). `assembleSystemPrompt` composes: `getStrategistSystemPrompt()` + user memories + conversation summaries + agent learnings + workspace artifacts + task training context + pinned project context + risk routing override + council mode. Also `assembleLeanAdvisorSystemPrompt`, `assembleTaskWriteSystemPrompt`. `generateBotResponse` / `streamBotResponse` wrap `generateText`/`streamText` with Strategist tools. Post-response: `runPostResponseTasks` fires memory generation. `persistChatMessage` / `loadConversationHistory` read/write `chat_history`.
- **Data sources touched:** `supabase_table:chat_history`, `supabase_table:projects`, `supabase_rpc:search_conversation_memories`
- **Used by:** `handler-v2.ts`, `lib/bot/index.ts`, `lib/bot/teams-chat.ts`

### `soul.ts`
- **Lines:** 81
- **Role:** prompt
- **Purpose:** Personality/tone/voice layer — "Direct, Specific, Confident, Human"

### `identity.ts`
- **Lines:** 44
- **Role:** prompt
- **Purpose:** Role/domain self-concept — construction specialist in Alleato's projects. Domain vocab (OAC, PCO, RFI, GMP, NTP).

### `persona-and-memory.ts`
- **Lines:** 17
- **Role:** prompt
- **Purpose:** Exports `I_DONT_KNOW_REFLEX_PROMPT` — "SEARCH FIRST, ADMIT LAST" mandate.

### `models.ts`
- **Lines:** 55
- **Role:** model-registry
- **Purpose:** UI model selector — 5 entries (GPT-5.4, GPT-5.4-mini, GPT-4.1, GPT-4.1-mini, o4-mini). `DEFAULT_CHAT_MODEL = "openai/gpt-5.4-mini"`.

### `model-pricing.ts`
- **Lines:** 108
- **Role:** model-registry
- **Purpose:** Static pricing lookup (USD per 1M tokens). `FALLBACK_PRICING` (1.5/6.0 input/output) for unknown models. `normalizeModelId` adds `openai/` or `anthropic/` prefixes.
- **Used by:** `/api/ai-assistant/usage-stats`, `/api/admin/ai-system-health`

### `assistant-models.ts`
- **Lines:** 27
- **Role:** model-registry
- **Purpose:** AI assistant-specific models — 3 entries (GPT-5.4, GPT-5.5, GPT-5.4-mini). `DEFAULT_AI_ASSISTANT_MODEL = "openai/gpt-5.4"`.

### `assistant-self-knowledge.ts`
- **Lines:** 352
- **Role:** utility
- **Purpose:** Defines self-inspection capability. `ASSISTANT_CAPABILITY_GROUPS` (7 groups), `ASSISTANT_RETRIEVAL_ORDER` (7 steps in canonical pipeline). `createAssistantSelfInspectionTools()` returns 3 tools: `describeAssistantCapabilities`, `explainAssistantRetrievalOrder`, `explainLastAnswerSources` (reads prior answer's persisted tool trace from `chat_history`).
- **Data sources touched:** `supabase_table:chat_history`
- **Used by:** `orchestrator.ts`

### `assistant-widgets.ts`
- **Lines:** 766
- **Role:** type-defs
- **Purpose:** 20 structured widget payload types emitted as data stream parts alongside text. Types include `DraftEmailWidgetPayload`, `OutlookEmailDraftWidgetPayload`, `CalendarInviteWidgetPayload`, `CreateTaskWidgetPayload`, `MeetingIntelligenceWidgetPayload`, `OutlookInboxSummaryWidgetPayload`, `ProjectPickerWidgetPayload`, `OwnerSnapshotWidgetPayload`, `OwnerActionQueueWidgetPayload`, `RiskExposurePacketWidgetPayload`, `FinancialPulseWidgetPayload`, `RecordWritePreviewWidgetPayload`, `DecisionPacketWidgetPayload`, etc. Also `buildAssistantWidgetsFromPrompt` (keyword-based pre-population).
- **Used by:** chat route handler, widget renderer components

### `action-capabilities.ts`
- **Lines:** 54
- **Role:** type-defs
- **Purpose:** `ASSISTANT_ACTION_CAPABILITIES` — 4 capability groups (create/update/prepare/save) with action names. Used for UI display.

### `entitlements.ts`
- **Lines:** 26
- **Role:** type-defs
- **Purpose:** Rate limits: `guest` = 20/day, `regular` = 50/day.

### `calendar-invite-parser.ts`
- **Lines:** 125
- **Role:** utility
- **Purpose:** Pure regex parsing for calendar invite creation. Extracts emails, date, time range, subject, body, confirmation intent. Returns `ParsedCalendarInviteRequest` or null.

### `deep-agent-project-status.ts`
- **Lines:** ~400+
- **Role:** data-fetcher
- **Purpose:** Bridge to Python FastAPI backend's deep-agent endpoints. Defines Zod schemas for response types. Exports `shouldUseDeepAgentExecutiveBridge`, `shouldUseDeepAgentResearchBridge`, and related fetch helpers. Frontend availability is derived from the configured backend URL; backend endpoint flags remain the service source of truth. Fetch helpers POST to backend intelligence endpoints via `fetchWithGuardrails` with `ADMIN_API_KEY`.
- **Data sources touched:** `external_api:python_backend`
- **Used by:** `handler-v2.ts`

### `meeting-insight-signals.ts`
- **Lines:** 125
- **Role:** utility
- **Purpose:** Extracts structured signal buckets from meeting transcript rows. `buildMeetingSignalBuckets(rows)` returns `{decisions, promises, risks, unresolvedQuestions}` via 4 regex pattern sets.

### `onboarding-insights.ts`
- **Lines:** 12
- **Role:** data-fetcher
- **Purpose:** Returns default onboarding insights (Tampa fallback). Per-user RAG summarizer intentionally not implemented.

### `personal-daily-brief.ts`
- **Lines:** 185
- **Role:** intent-classifier
- **Purpose:** Phrase predicates for personal/daily brief requests: `isPersonalDailyBriefRequest`, `isDailyBriefCritiqueRequest`, `isExecutiveBriefingMetadataQuestion`, `isPersonalTaskRegisterRequest`, `identityLooksLikeBrandon`.

### `score-response-quality.ts`
- **Lines:** 183
- **Role:** trace/observability
- **Purpose:** Scores response quality (0-100) from tool trace + response text. `SOURCE_BEARING_TOOLS` (10 tools). +25 for compiled packet with ≥3 cards, +25 for ≥3 successful tools, +12 for ≥1 tool, +15 for ≥2 source citations, -5/failed tool (max -20), -30 for meta-commentary. `META_COMMENTARY_PHRASES` (20 stalling phrases).
- **Used by:** `handler-v2.ts` (post-generation; stored to `chat_history.metadata`)

### `session-id.ts`
- **Lines:** 54
- **Role:** utility
- **Purpose:** `toSessionUuid(input)` converts arbitrary session identifiers (e.g., `teams:<userId>:<threadId>`) into deterministic UUID v5 using SHA-1. Ensures bot session IDs satisfy `chat_history.session_id uuid NOT NULL`.

### `source-health.ts`
- **Lines:** 277
- **Role:** data-fetcher
- **Purpose:** Loads sync health from two sources: `source_sync_health_snapshots` (RAG DB) and `graph_subscriptions` (PM APP). `loadAssistantSourceHealthContext` runs both in parallel, computes `overallStatus` (healthy/degraded/unknown), `missingStage`, and `promptInjection` string. `shouldAttachAssistantSourceHealth(message)` checks sync-related keywords.
- **Data sources touched:** `supabase_table:source_sync_health_snapshots` (RAG), `supabase_table:graph_subscriptions` (PM APP)

### `strategist-failure-response.ts`
- **Lines:** 51
- **Role:** utility
- **Purpose:** Generates structured failure message when Strategist's primary run produces no usable response. Lists successful/failed tools, project-pinning hint, follow-up instruction.

### `task-feedback-types.ts`
- **Lines:** 123
- **Role:** type-defs
- **Purpose:** Enumerated feedback reason categories (9 values): trivial, too_vague, wrong_assignee, wrong_due_date, wrong_priority, duplicate, not_actionable, missing_context, other. `summarizeTaskFeedbackReasonCategories`, `TaskSnapshot`, `FewShotTask`.

### `task-source-review.ts`
- **Lines:** 372
- **Role:** data-fetcher
- **Purpose:** Loads task source review packets for "which meeting did this task come from?" questions. `detectTaskSourceReviewRequest(message)`, `loadTaskSourceReviewPacket` (joins `tasks` + `document_metadata`, scores token overlap threshold 0.55).
- **Data sources touched:** `supabase_table:tasks`, `supabase_table:document_metadata`

### `langfuse-trace.ts`
- **Lines:** 97
- **Role:** trace/observability
- **Purpose:** Lazily initializes `Langfuse` client when `LANGFUSE_SECRET_KEY` set. `traceChatCompletion` creates trace tagged with intent, retry status, quality score; adds generation span with model, usage, step count, tool call names. No-ops when key absent.
- **Data sources touched:** `external_api:langfuse`

---

## 2. `agents/` Directory Deep-Dive

All agent files export a single system prompt string and live in `frontend/src/lib/ai/agents/`.

### `agents/types.ts`
- **Lines:** 113
- **Purpose:** Shared C-Suite agent types. `AGENT_NAMES` (7 agents: strategist, cfo, coo, chro, cro, vpbd, cmo), `AgentName`, `AGENT_LABELS`, `AGENT_DESCRIPTIONS`. Also `RoutingDecision`, `ConfidenceLevel`, `AgentAlert`, `AgentResponse`, `SynthesizedResponse`.

### `agents/strategist.ts`
- **Lines:** 216
- **Role:** prompt
- **Purpose:** Exports `strategistSystemPrompt` — Chief Strategist operating instructions. Routing logic (when to call specialists vs direct answer), mandatory first steps for project queries (`searchEmails` + `searchTeamsMessages` + `searchMeetingsByTopic` in parallel before any specialist), task write protocol (`createGeneratedTask`), Outlook operations protocol, "One Voice" response contract.
- **Is sub-agent of main orchestrator?** No — this IS the main orchestrator's persona
- **Tools:** All from `createStrategistTools`
- **Model:** `openai/gpt-5.4`

### `agents/cfo.ts`
- **Lines:** ~130
- **Purpose:** `cfoSystemPrompt` — 5 analytical lenses: margin protection, cash position, exposure, change order lifecycle, billing & collections.
- **Is sub-agent?** Yes — invoked via `consultCFO`
- **Tools:** `getProjectBudgetSummary`, `getFinancialAnalysis`, `getBudgetLineItems`, `getCostTrends`, `getMarginAnalysis`, `getCashFlowProjection`, `getCommitmentsOverview`, `getChangeOrderDetails`, `getDirectCostsSummary`, `getInvoiceStatus`, `getRetentionSummary`, `getForecastComparison`, `getPortfolioOverview`, `getProjectsWithRisks`, `getProjectRiskAnalysis`, plus 9 Acumatica ERP tools, plus web search
- **Model:** `openai/gpt-5.4-mini`

### `agents/coo.ts`
- **Lines:** ~100
- **Purpose:** `cooSystemPrompt` — 5 lenses: schedule health, procurement (RFI/submittals), subcontractor execution, action item accountability, field issues. Mandates `searchEmails` + `searchTeamsMessages` as ABSOLUTE FIRST tool calls when any project mentioned.
- **Is sub-agent?** Yes — invoked via `consultCOO`
- **Model:** `openai/gpt-5.4-mini`

### `agents/cro.ts`
- **Lines:** ~100
- **Purpose:** `croSystemPrompt` — 6 risk lenses: financial exposure, schedule, procurement (RFI/submittal aging), contract (change order lifecycle gaps), operational (recurring patterns), claim signals.
- **Is sub-agent?** Yes — invoked via `consultCRO`
- **Model:** `openai/gpt-5.4-mini`

### `agents/chro.ts`
- **Lines:** ~100
- **Purpose:** `chroSystemPrompt` — 4 lenses: team coverage, capacity/spread, commitment follow-through, institutional knowledge.
- **Is sub-agent?** Yes — invoked via `consultCHRO`
- **Model:** `openai/gpt-5.4-mini`

### `agents/vpbd.ts`
- **Lines:** ~90
- **Purpose:** `vpbdSystemPrompt` — 4 lenses: pipeline/revenue, client relationship health, competitive positioning, past performance.
- **Is sub-agent?** Yes — invoked via `consultVPBD`
- **Tools:** `createProjectTools` + `createWebSearchTools` (explicit custom factory)
- **Model:** `openai/gpt-5.4-mini`

### `agents/cmo.ts`
- **Lines:** ~90
- **Purpose:** `cmoSystemPrompt` — brand positioning, project proof sourcing, audience-native content, campaign continuity. Weekly content calendar workflow.
- **Is sub-agent?** Yes — invoked via `consultCMO`
- **Tools:** `createMarketingTools` + `createProjectTools` + `createWebSearchTools` + `createDocumentIntelligenceTools`
- **Model:** `openai/gpt-5.4-mini`

---

## 3. `retrieval/` Directory Deep-Dive

### `retrieval/types.ts`
- **Lines:** 49
- **Purpose:** `RetrievalPlan` (intent, responseFormat, sources object: intelligencePacket / projectSnapshot / semanticVectorSearch / externalSources / recentEmails / sourceSpecificRag / reusePriorBriefing / brandonDailyUpdate, preconsult sub-agents, selectedProjectId, reason) and `RetrievalContext` (accumulates results with warnings + duration).

### `retrieval/planner.ts`
- **Lines:** 153
- **Role:** intent-classifier
- **Purpose:** `planRetrieval(input)` — runs `classifyAssistantIntent` + detection helpers and returns `RetrievalPlan`. Priority routing: Brandon daily → app_help → recent email inbox → follow-up to prior briefing → source-specific RAG → source_lookup → packet-first intents → conversational fallback.

### `retrieval/executor.ts`
- **Lines:** ~200
- **Role:** data-fetcher
- **Purpose:** `executeRetrievalPlan(plan, deps, ctx)` — dispatches concurrent tasks based on `sources` flags. Per-source timeouts (default 3s) for external sources. Populates `RetrievalContext`.

### `retrieval/deps.ts`
- **Lines:** 230
- **Role:** data-fetcher
- **Purpose:** `buildExecutorDeps({ supabase, userId })` — wires abstract `ExecutorDeps` interface to real tool implementations. Maps `loadIntelligencePacket` → `resolveIntelligenceTarget` + `loadCurrentIntelligencePacket`; `loadProjectSnapshot` → `projectTools.getProjectBriefingSnapshot.execute`; `runSemanticSearch` → `operationalTools.semanticSearch.execute`; `runRecentEmails` → `operationalTools.getRecentEmails.execute`; `runSourceSpecificRag` → `buildSourceSpecificRagAnswer`; `buildBrandonDaily` → `generateDailyBrief`.

### `retrieval/system-prompt.ts`
- **Lines:** 296
- **Role:** prompt
- **Purpose:** `assembleSystemPromptFromContext(plan, ctx, basePrompt)` — prepends retrieval context sections to base prompt. Renders intelligence packet (with staleness warning if >8h old), project briefing snapshot, semantic vector results (up to 8 results, 1200 chars each), executive briefing retrieval, recent email inbox, source-specific RAG answer, warnings.

### `retrieval/reusable-briefing.ts`
- **Lines:** 136
- **Role:** data-fetcher
- **Purpose:** `loadReusableBriefingContext` — looks up 5 most recent assistant messages in `chat_history`, extracts cached project_briefing_snapshot / executive_briefing_retrieval from metadata JSON. Validates project name match before reusing.

### `retrieval/source-specific-rag.ts`
- **Lines:** 471
- **Role:** data-fetcher
- **Purpose:** Newer version of source-specific RAG (used by `deps.ts`). Like `preflights.ts` but adds a **live Microsoft Graph Teams path**: for `recent_teams_discussions`, calls `fetchRecentTeamsMessagesFromGraph` (live API) first, merges with stored `document_metadata` rows deduplicating by title+date+content prefix. Live rows formatted as synthetic rows with `source: "microsoft_graph_live"`.
- **Data sources touched:** `supabase_table:document_metadata`, `microsoft_graph_live`

> ⚠️ **AUDIT FLAG:** This file already implements the live-Graph-first pattern that the email operator audit (prior conversation) said `getRecentEmails` should follow. Worth comparing how each does it.

### `retrieval/retrieval-weight-scoring.ts`
- **Lines:** 56
- **Role:** utility
- **Purpose:** Per-document/per-chunk weight multipliers for retrieval results. Bounds [0.65, 1.5]. Used to boost or downrank specific sources based on user feedback signals from `ai_retrieval_weights`.

---

## 4. `services/` Directory Deep-Dive

### `services/conversation-memory.ts`
- **Lines:** ~150
- **Role:** data-fetcher
- **Purpose:** Post-response service. `generateConversationMemory(sessionId, userId)` — fetches up to 40 messages from `chat_history`, summarizes with `gpt-4.1-nano`, embeds with `text-embedding-3-large` (3072 dims), upserts to `memories` table. Runs in `waitUntil` post-response hook.
- **Data sources touched:** `supabase_table:chat_history`, `supabase_table:memories`

### `services/memory-extraction.ts`
- **Lines:** ~120
- **Role:** data-fetcher
- **Purpose:** Post-response. `extractAndStoreMemories(sessionId, userId)` — uses `generateText` with `Output.object(extractedMemorySchema)` on `gpt-4.1-nano` to extract up to 5 typed memories (fact/preference/lesson/commitment/context) with importance ≥ 0.3. Minimum 4 messages required.
- **Data sources touched:** `supabase_table:chat_history`, `supabase_table:ai_memories`

### `services/ai-memory-service.ts`
- **Lines:** ~200
- **Role:** data-fetcher
- **Purpose:** Core read/write for `ai_memories`. `writeMemory` checks near-duplicate (similarity > 0.88) before inserting; for `commitment` type also creates `ai_insights` action item; supports `visibility` (private/team). `getMemoriesForSession` via `search_ai_memories` RPC. Also writes to AI Database `document_chunks` for cross-session search.
- **Data sources touched:** `supabase_table:ai_memories`, `supabase_rpc:search_ai_memories`, `supabase_table:ai_insights`, `document_chunks_rag`

### `services/agent-learning-service.ts`
- **Lines:** ~200
- **Role:** data-fetcher
- **Purpose:** Reads/writes `agent_learnings` table in RAG Database. `upsertAgentLearning` (SHA-1 content hash dedup). `getRelevantAgentLearnings` via semantic search. `buildAgentLearningContextBlock` renders up to 4 relevant learnings as prevention prompts.
- **Data sources touched:** `supabase_table:agent_learnings` (RAG), `supabase_table:agent_learning_usages` (RAG)

### `services/task-training-service.ts`
- **Lines:** ~150
- **Role:** data-fetcher
- **Purpose:** Builds few-shot task generation training blocks. Queries `ai_task_feedback` for recent "good" examples. `recordTaskFeedback` → `upsertAgentLearning` + `recordAiFeedbackEvent`.
- **Data sources touched:** `supabase_table:ai_task_feedback`

### `services/project-intelligence-summary.ts`
- **Lines:** ~200
- **Role:** data-fetcher
- **Purpose:** `summarizeProjectIntelligence(sources, options)` — uses `generateObject` on `gpt-5.4-mini` to produce structured `ProjectIntelligenceSummary` with headline, context, risks (with severity + recommendedAction + sourceIds), decisions, actionItems, openQuestions — all with mandatory source citations.

### `services/workspace-artifact-service.ts`
- **Lines:** ~180
- **Role:** data-fetcher
- **Purpose:** CRUD + semantic search for `workspace_artifacts` (work-in-progress owner updates, risk reports, meeting prep). Syncs embedding to AI Database `document_chunks`.
- **Data sources touched:** `supabase_table:workspace_artifacts` (PM APP), `document_chunks_rag` (AI DB)

### `services/marketing-service.ts`
- **Lines:** ~300
- **Role:** data-fetcher
- **Purpose:** CRUD for `marketing_intelligence_items`, `marketing_content_calendar_items`, `marketing_content_assets`. `createWeeklyMarketingContentWorkflow` orchestrates source finding → intelligence persistence → calendar/asset records.

### `services/feedback-event-service.ts`
- **Lines:** ~250
- **Role:** data-fetcher
- **Purpose:** Comprehensive feedback event recording. Multiple feedback families: retrieval, attribution, assistant_response, tool_action, task_generation. Manages `ai_feedback_events`, `ai_learning_promotions`, `ai_retrieval_feedback`, `ai_retrieval_weights`, `intelligence_reviews`, `document_attribution_candidates`.

### `services/source-sync-summary.ts`
- **Lines:** ~200
- **Role:** data-fetcher
- **Purpose:** Builds structured AI brief snapshots from sync run data. Queries `source_sync_runs` (RAG DB). Uses `summarizeProjectIntelligence` for structured output.

### `services/project-operating-summary-sources.ts`
- **Lines:** ~200
- **Role:** data-fetcher
- **Purpose:** Loads source coverage metadata for operating summaries. Reports availability per category: meetings, emails, Teams, documents, Acumatica, RFIs, submittals, drawings, specs, daily reports, tasks, risks.

---

## 5. `intelligence/` Brief Overview

### `intelligence/types.ts`
TypeScript types for the intelligence packet pipeline: `IntelligenceTargetType`, `PacketFreshnessStatus`, `InsightCardType` (14 types), `ConfidenceLevel`, row types for `intelligence_targets`/`intelligence_packets`/`insight_cards`/`insight_card_evidence`/`intelligence_packet_cards`, `ClientProjectIntelligencePacket`, `PACKET_STALE_AFTER_HOURS = 8`.

### `intelligence/packet-service.ts`
`resolveIntelligenceTarget` tries 3 resolution strategies: selectedProjectId → name/slug → project name prefix. `loadCurrentIntelligencePacket` fetches most recent non-failed packet with all cards + evidence.
- **Data sources touched:** `supabase_table:intelligence_targets`, `intelligence_packets`, `insight_cards`, `insight_card_evidence`, `intelligence_packet_cards`

### `intelligence/advisor-synthesis.ts`
Pure formatting — renders `ClientProjectIntelligencePacket` into LLM-ready narrative. `synthesizeAdvisorResponse` routes by intent (risk_review → risk cards, financial_analysis → financial exposure cards, etc.).

---

## 6. `insight-cards/` Brief Overview

### `insight-cards/index.ts`
Central helper for `insight_cards` queries and project↔intelligence-target resolution. Card type bucket constants (`RISK_CARD_TYPES`, `DECISION_CARD_TYPES`, etc.). `resolveTargetIdsForProjects`.
- **Data sources touched:** `supabase_table:insight_cards`, `intelligence_targets`, `insight_card_evidence`

---

## 7. `prompts/` Brief Overview

### `prompts/meeting-prep.ts`
`buildMeetingPrepSystemPrompt()` — system prompt for meeting prep document generation. Specific section structure (review of last meeting, suggested agenda, financial status, schedule health, open items, action items, project risks).

### `prompts/progress-report.ts`
`PROGRESS_REPORT_SYSTEM_PROMPT` constant + `buildProgressReportUserMessage`. 20-year-veteran PM voice: active voice, specific trade/floor/zone/RFI details, concise bullets. Strict JSON schema: `past_week_highlights`, `upcoming_week_activities`, `open_items`.

---

## 8. Architecture Map

### Entry Points

**Primary entry point for web UI:** `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`

This handler receives `{ user, sessionId, messages, selectedProjectId, activeModel, supabase }` and orchestrates the full request flow.

### What Calls `handler-v2.ts`

`frontend/src/app/api/ai-assistant/chat/route.ts` calls `handler-v2.ts` after auth + rate-limit checks.

For bot channels (Teams, Slack): `lib/bot/index.ts` and `lib/bot/teams-chat.ts` call `generateBotResponse` / `streamBotResponse` from `bot-core.ts` directly, **bypassing `handler-v2.ts`**.

### What `handler-v2.ts` Wires Together

1. **Intent classification** — `classifyAssistantIntent` (deterministic) → `planAssistantIntent` (model-based, with deterministic override fallback)
2. **Source-specific detection** — `detectSourceSpecificRagRequest` / `detectRecentEmailInboxRequest`
3. **Deep agent bridge check** — `shouldUseDeepAgentProjectStatusBridge` / `shouldUseDeepAgentExecutiveBridge` / `shouldUseDeepAgentResearchBridge` (routes to Python backend when enabled)
4. **Retrieval planning** — `planRetrieval` → `executeRetrievalPlan` (via `buildExecutorDeps`)
5. **System prompt assembly** — `assembleSystemPrompt` (from `bot-core`) + `assembleSystemPromptFromContext` (from `retrieval/system-prompt`)
6. **Tool creation** — `createStrategistTools` (from `orchestrator`) → includes all 6 consult tools + project/operational/web/action/workspace/marketing/document intelligence tools
7. **Generation** — `streamText` with Strategist model + assembled tools + up to 7 step iterations
8. **Post-generation** — `scoreResponseQuality`, `traceChatCompletion` (Langfuse), persist metadata to `chat_history`, `waitUntil` for `generateConversationMemory` + `extractAndStoreMemories`

### One Request Flow ("What's the latest on Vermillion Rise?")

1. `route.ts` → `handler-v2.ts`
2. `classifyAssistantIntent` → `latest_status`
3. `planAssistantIntent` → model confirms `latest_status`, `responseMode: build_project_packet`
4. `shouldUseDeepAgentProjectStatusBridge` → if env enabled, POST to Python backend and return
5. Otherwise: `planRetrieval` → `{ intent: latest_status, responseFormat: briefing_template, sources: { intelligencePacket: additive, projectSnapshot: intent, semanticVectorSearch: query } }`
6. `executeRetrievalPlan` → parallel: load packet from `intelligence_packets` + `getProjectBriefingSnapshot` + `semanticSearch`
7. `assembleSystemPromptFromContext` → prepends packet + snapshot + vector results
8. `assembleSystemPrompt` (bot-core) → adds soul + identity + memories + learnings + workspace artifacts + pinned project
9. `createStrategistTools` → Strategist gets `consultCFO`, `consultCOO`, `consultCRO`, etc. + all direct project tools
10. `streamText(model: gpt-5.4, ...)` → Strategist calls `searchEmails` + `searchTeamsMessages` + `searchMeetingsByTopic` in parallel per strategist prompt, then `consultCOO` which internally runs `ToolLoopAgent(gpt-5.4-mini, coo tools, max 5 steps, 15s timeout)`
11. Strategist synthesizes and streams text + widget data parts
12. Post-stream: `scoreResponseQuality` → `chat_history.metadata`; `traceChatCompletion` → Langfuse; `waitUntil` → memory tasks

---

## Audit-pass summary

The orchestration layer contains **~60 TypeScript files** across the top level and 4 subdirectories.

**Sub-agents:** 6 specialist agents (CFO, COO, CRO, CHRO, VP BD, CMO), each on `gpt-5.4-mini` in a `ToolLoopAgent` (max 5 steps, 15s timeout), invoked via consult tools that the Strategist calls during its own tool loop.

**Cross-cutting flags for synthesis pass:**
1. `preflights.ts` (older path, used by legacy chat route) and `retrieval/source-specific-rag.ts` (newer path) overlap significantly. The newer file already implements live-Microsoft-Graph-first reads for Teams — pattern that prior audit said `getRecentEmails` should also follow.
2. Two prompt files (`rag-assistant-prompt.ts` and `agents/strategist.ts`) both define "main assistant" instructions, but only `agents/strategist.ts` (via `getStrategistSystemPrompt` in `orchestrator.ts`) is in the active path used by `handler-v2.ts`. `rag-assistant-prompt.ts` is referenced only by legacy chat route paths.
3. Two parallel chat paths exist: `app/api/ai-assistant/chat/route.ts` (uses `handler-v2.ts` and bot-core) and `app/api/chat/route.ts` (uses `prompts.ts` generic prompts and a simpler `streamText` call). Synthesis should determine whether both are still needed.
