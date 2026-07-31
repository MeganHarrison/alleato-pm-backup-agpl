-- AI Agent Registry
-- Tracks every agent/pipeline component in the Alleato AI system:
-- definition (human-authored), prioritization, and runtime health state.

-- ─── Agent definitions ────────────────────────────────────────────────────────

create table if not exists ai_agents (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,

  -- Categorization
  domain      text,   -- 'pipeline' | 'chat' | 'write' | 'planned'
  layer       text,   -- 'backend' | 'frontend' | 'hybrid'
  status      text not null default 'planned'
                check (status in ('planned','building','beta','production','deprecated')),

  -- How it runs
  trigger_type   text, -- 'scheduled' | 'event' | 'on-demand' | 'pipeline-step'
  trigger_detail text, -- e.g. 'every 15 min', 'after transcript sync', 'user message'

  -- What it does
  purpose          text,
  data_sources     jsonb default '[]',   -- string[]
  output_type      text,
  output_destination text,

  -- Trust model
  approval_required     boolean default true,
  confidence_threshold  numeric(4,3),    -- e.g. 0.750
  failure_behavior      text,

  -- Measurement
  success_metric   text,

  -- Relationships
  dependencies     text[] default '{}',  -- array of slug references
  blockers         text,

  -- Prioritization
  priority_score    integer check (priority_score between 1 and 100),
  estimated_effort  text check (estimated_effort in ('S','M','L','XL')),
  estimated_impact  text check (estimated_impact in ('low','medium','high','critical')),
  data_freshness_requirement text,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Runtime state (written by system on every invocation) ───────────────────

create table if not exists ai_agent_runs (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references ai_agents(id) on delete cascade,
  project_id  integer references projects(id) on delete set null,

  started_at    timestamptz,
  completed_at  timestamptz,
  status        text check (status in ('success','failure','partial','skipped')),

  confidence_score  numeric(4,3),
  output_count      integer default 0,
  tokens_used       integer,
  error_message     text,
  metadata          jsonb default '{}',

  created_at  timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists ai_agents_status_idx    on ai_agents(status);
create index if not exists ai_agents_domain_idx    on ai_agents(domain);
create index if not exists ai_agent_runs_agent_idx on ai_agent_runs(agent_id);
create index if not exists ai_agent_runs_status_idx on ai_agent_runs(status);
create index if not exists ai_agent_runs_created_idx on ai_agent_runs(created_at desc);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

create or replace function update_ai_agents_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ai_agents_updated_at
  before update on ai_agents
  for each row execute function update_ai_agents_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table ai_agents enable row level security;
alter table ai_agent_runs enable row level security;

-- Admin/authenticated users can read; writes restricted to service role
create policy "ai_agents_read" on ai_agents
  for select to authenticated using (true);

create policy "ai_agent_runs_read" on ai_agent_runs
  for select to authenticated using (true);

-- ─── Seed: agent inventory (20 agents from inventory draft v1) ───────────────

insert into ai_agents (
  name, slug, domain, layer, status,
  trigger_type, trigger_detail,
  purpose, data_sources, output_type, output_destination,
  approval_required, confidence_threshold, failure_behavior, success_metric,
  dependencies, blockers,
  priority_score, estimated_effort, estimated_impact,
  data_freshness_requirement, notes
) values

-- PIPELINE AGENTS
(
  'Fireflies Transcript Sync',
  'fireflies-transcript-sync',
  'pipeline', 'backend', 'production',
  'scheduled', 'Every 15 min (FIREFLIES_SYNC_INTERVAL_MINUTES)',
  'Pulls new meeting transcripts from Fireflies API, stores raw content for downstream extraction.',
  '["Fireflies API"]',
  'Raw transcript records',
  'document_metadata, rag_document_metadata (AI DB)',
  false, null,
  'Retries on transient failures; removes job if auth fails permanently.',
  null,
  '{}', null,
  70, 'S', 'high',
  'Near real-time — 15 min lag acceptable',
  'No alert fires if 0 transcripts processed in 24h. No schema-change detection on Fireflies API.'
),

(
  'Meeting Extractor (Deep Stage-3)',
  'meeting-extractor',
  'pipeline', 'backend', 'production',
  'event', 'After transcript sync; backlog drain every N min',
  'Reads full transcript + project state, extracts structured signals: decisions, risks, tasks, opportunities, blockers.',
  '["document_metadata (transcript)", "project_current_state", "RAG chunks (prior context)"]',
  'Structured signals (decisions, risks, tasks, opportunities)',
  'insights, tasks, source_signal_candidates, document_chunks (embeddings)',
  false, 0.600,
  'Backlog drain re-queues stale items; logs extraction errors.',
  null,
  '{"fireflies-transcript-sync"}', null,
  90, 'M', 'critical',
  'Same-session: should run within minutes of transcript arriving',
  'No human review queue for low-confidence signals. No accuracy feedback loop. Confidence computed per-signal but not surfaced in UI.'
),

(
  'Graph Sync (Outlook + Teams + OneDrive)',
  'graph-sync',
  'pipeline', 'backend', 'production',
  'scheduled', 'Every 60 min (GRAPH_SYNC_INTERVAL_MINUTES)',
  'Syncs emails, Teams DMs, and OneDrive files from Microsoft Graph into the platform.',
  '["Microsoft Graph API (Outlook, Teams, OneDrive)"]',
  'Email records, Teams message records, file metadata',
  'outlook_email_intake, document_metadata',
  false, 0.700,
  '10 permanent 403s on cross-tenant/meeting chats — known hard limit. Transient failures retry.',
  null,
  '{}', null,
  80, 'S', 'critical',
  'Within 60 min of message sent/received',
  'Low-confidence project attributions go to document_attribution_candidates — no UI to review. No alert on low attribution rate.'
),

(
  'Document Embedder',
  'document-embedder',
  'pipeline', 'backend', 'production',
  'pipeline-step', 'Runs at end of every Graph sync (embed_pending_graph_documents)',
  'Converts documents and transcripts to vector embeddings for semantic search.',
  '["document_metadata (text content)", "OpenAI text-embedding-3-large"]',
  'Vector embeddings (halfvec 3072)',
  'document_chunks (AI DB)',
  false, null,
  'RAG health cron monitors counts and fires Slack alert on failure.',
  'RAG health check passes (no Slack alert). Embedding count grows with sync.',
  '{"graph-sync"}', null,
  85, 'S', 'critical',
  'Same sync session — runs synchronously at end of Graph sync',
  'Backend uses direct OpenAI (quota risk). Caused June 14 silent failure where quota exhausted and all extraction failed for days.'
),

(
  'Teams / Comms Compiler',
  'comms-compiler',
  'pipeline', 'backend', 'production',
  'scheduled', 'Every 10 min (INTELLIGENCE_COMPILER_INTERVAL_MINUTES)',
  'Synthesizes embedded communications into per-project intelligence: what changed, decisions, risks, financial signals, schedule signals.',
  '["document_metadata", "document_chunks", "project state"]',
  'Project intelligence packets',
  'intelligence_targets, source_signal_candidates, source_syntheses, project_daily_deltas, project_operating_snapshots, change_event_candidates, insight_cards, project_report_suggestions',
  false, null,
  null,
  null,
  '{"document-embedder", "graph-sync"}', null,
  75, 'M', 'critical',
  'Within 10 min of new communication arriving',
  'Writes to 8+ tables with no approval gate. Confidence threshold not defined for compiler output. No success metric. Highest-risk agent in the system.'
),

(
  'Acumatica Financial Sync',
  'acumatica-financial-sync',
  'pipeline', 'backend', 'production',
  'scheduled', 'Daily at 00:15 UTC (ACUMATICA_FINANCIAL_SYNC_CRON)',
  'Pulls AP bills, change orders, subcontracts, POs, checks from Acumatica ERP.',
  '["Acumatica REST API (cookie auth)"]',
  'Financial transaction records',
  'acumatica_ap_bills, acumatica_change_orders, acumatica_subcontracts, acumatica_purchase_orders, acumatica_project_budgets',
  false, null,
  null,
  null,
  '{}', null,
  85, 'M', 'high',
  'Daily — financial data 24h stale acceptable',
  'cost_to_complete and EAC = 0 for all 6,647 rows (unsynced). WIP/margin data cannot be trusted. No monitoring or alerting on sync failures.'
),

(
  'Daily Digest',
  'daily-digest',
  'pipeline', 'backend', 'production',
  'scheduled', 'Configurable UTC hour/minute',
  'Generates aggregated daily executive briefing: risks, decisions, blockers, commitments, wins, client sentiment, schedule status.',
  '["document_metadata (meeting transcripts from past 24h)"]',
  'Structured JSON briefing',
  null,
  null, null,
  null,
  null,
  '{"fireflies-transcript-sync", "meeting-extractor"}', null,
  60, 'S', 'medium',
  'Previous 24h of meetings',
  'Output destination unconfirmed. Delivery mechanism unknown. Approval and success metric both undefined.'
),

(
  'RAG Health Monitor',
  'rag-health-monitor',
  'pipeline', 'backend', 'production',
  'scheduled', 'Daily at 12:15 UTC (Render cron)',
  'Checks embedding pipeline health — ensures documents are being vectorized correctly.',
  '["document_chunks (AI DB)"]',
  'Health status + Slack alert on failure',
  'Slack',
  false, null,
  'Sends Slack alert on failure.',
  'No Slack alert fired.',
  '{"document-embedder"}', null,
  50, 'S', 'medium',
  'Daily check on cumulative state',
  'Only monitors embedding count — does not check whether embedded content is accurate or stale.'
),

-- CHAT AGENTS (frontend, on-demand)
(
  'Strategist (Chat Orchestrator)',
  'strategist',
  'chat', 'frontend', 'production',
  'on-demand', 'User message in chat UI',
  'Main AI chat interface — routes questions to executive agents and tools, synthesizes responses, orchestrates multi-tool calls.',
  '["All tools: RAG chunks, financial data, Acumatica, operational, schedule, forecast"]',
  'Natural language response with cited sources',
  'Chat UI',
  false, null,
  'strategist-failure-response.ts handles graceful degradation.',
  null,
  '{"meeting-extractor", "document-embedder", "graph-sync", "acumatica-financial-sync"}', null,
  95, 'L', 'critical',
  'All upstream data — freshness depends on sync cadences',
  'No structured confidence score on chat responses. Success metric is entirely qualitative.'
),

(
  'CFO Agent',
  'cfo',
  'chat', 'frontend', 'production',
  'on-demand', 'User routes to CFO in chat',
  'Financial analysis in chat — budgets, commitments, change orders, cash flow, margin. Always calls tools first, never fabricates numbers.',
  '["financial.ts tools", "acumatica.ts tools"]',
  'Financial analysis with cited sources',
  'Chat UI',
  false, null,
  'Falls back to Strategist failure response.',
  null,
  '{"acumatica-financial-sync"}', null,
  85, 'M', 'critical',
  'Same as Acumatica sync — daily',
  'WIP/margin data untrustworthy (Acumatica EAC/cost-to-complete gap). No structured accuracy tracking.'
),

(
  'COO Agent',
  'coo',
  'chat', 'frontend', 'production',
  'on-demand', 'User routes to COO in chat',
  'Operational analysis — tasks, dates, people, accountability, execution blockers across projects.',
  '["operational.ts tools", "meeting data", "Teams/email via Graph"]',
  'Operational analysis with action items',
  'Chat UI',
  false, null,
  null,
  null,
  '{"graph-sync", "meeting-extractor"}', null,
  75, 'M', 'high',
  'Within sync cadence (60 min)',
  'Tasks/schedule data mid-migration — status not reliably current. Avoid task-status queries in demos.'
),

(
  'CRO Agent (Risk)',
  'cro',
  'chat', 'frontend', 'production',
  'on-demand', 'User routes to CRO in chat',
  'Cross-project risk identification — surfaces what can go wrong before it does, flags systemic patterns.',
  '["operational.ts tools", "financial.ts tools", "RAG semantic search"]',
  'Risk analysis with mitigation paths',
  'Chat UI',
  false, null,
  null,
  null,
  '{"meeting-extractor", "document-embedder", "acumatica-financial-sync"}', null,
  70, 'M', 'high',
  'Within sync cadence',
  'No persistent risk tracking — risk identified in chat is not stored or monitored over time.'
),

(
  'VP of Business Development Agent',
  'vpbd',
  'chat', 'frontend', 'production',
  'on-demand', 'User routes to VPBD in chat',
  'Revenue generation, client relationship health, pipeline health, connecting project execution to future work wins.',
  '["operational.ts tools (unconfirmed)", "RAG (unconfirmed)"]',
  'BD and growth analysis',
  'Chat UI',
  false, null,
  null,
  null,
  '{}', null,
  55, 'M', 'medium',
  'Within sync cadence',
  'No CRM or pipeline data source confirmed. Agent may produce analysis without real BD data behind it.'
),

-- WRITE TOOLS
(
  'Draft Outlook Email',
  'draft-outlook-email',
  'write', 'frontend', 'production',
  'on-demand', 'User request in chat',
  'Drafts an email in Brandon''s voice using a preview-then-confirm gate before writing to Outlook draft folder.',
  '["Brandon voice profile docs", "project context via RAG"]',
  'Email draft',
  'Outlook draft folder (Brandon''s mailbox)',
  true, null,
  null,
  null,
  '{"strategist"}', null,
  65, 'S', 'medium',
  'On-demand — freshness of project context depends on RAG sync',
  'No sendOutlookEmail tool — human must send from Outlook. Intentional policy, not documented as such. Urgent escalation path unclear.'
),

(
  'Send Teams Message',
  'send-teams-message',
  'write', 'frontend', 'production',
  'on-demand', 'User request in chat',
  'Sends a Teams DM via Archon bot to recipients with linked accounts. Preview-then-confirm gate.',
  '["teams_conversation_refs (recipient lookup)"]',
  'Delivered Teams DM',
  'Microsoft Teams',
  true, null,
  '403 on cross-tenant/meeting chat recipients — known permanent limit.',
  null,
  '{"strategist"}', null,
  60, 'S', 'medium',
  'On-demand',
  'Urgent escalations should skip confirm gate per planned policy — not yet built.'
),

(
  'Deep Project Intelligence',
  'deep-project-intelligence',
  'pipeline', 'backend', 'beta',
  'on-demand', 'API endpoint or manual invoke',
  'Deep Agents harness — multi-step project status analysis using tools, memory, and subagents.',
  '["All Alleato AI tools", "Deep Agents memory store", "RAG"]',
  'Deep project intelligence packet',
  null,
  null, null,
  'Fails loudly on missing env vars by design.',
  'G1–G5 pass on project 1009 (commit abb4cc600)',
  '{"meeting-extractor", "document-embedder", "acumatica-financial-sync", "graph-sync"}', null,
  80, 'L', 'critical',
  'All upstream data',
  'Output destination uncertain — likely project_intelligence_synthesis_v1 but not confirmed. Not integrated into main app UI.'
),

-- PLANNED AGENTS
(
  'Proactive Risk Alert',
  'proactive-risk-alert',
  'pipeline', 'hybrid', 'planned',
  'event', 'On new compiler output crossing risk threshold',
  'Monitors project signals continuously, pushes alerts when a risk threshold is crossed — without the user asking.',
  '["comms-compiler output", "financial data"]',
  'Alert notification',
  null,
  true, null,
  null,
  null,
  '{"comms-compiler", "send-teams-message"}',
  'Trigger condition, confidence threshold, and delivery channel all undefined.',
  65, 'M', 'high',
  'Near real-time — same session as compiler',
  'Entirely undefined. Needs trigger condition, confidence threshold, and delivery channel before buildable.'
),

(
  'Budget Variance Alert',
  'budget-variance-alert',
  'pipeline', 'backend', 'planned',
  'scheduled', 'After Acumatica sync (daily)',
  'Detects meaningful budget overruns or forecast drift, surfaces to PM without waiting for a meeting.',
  '["acumatica_project_budgets", "project_budgets"]',
  'Variance report',
  null,
  true, null,
  null,
  null,
  '{"acumatica-financial-sync"}',
  'Acumatica cost_to_complete and EAC are 0 for all records. Cannot build until that sync is fixed.',
  70, 'M', 'high',
  'Same day as Acumatica sync',
  'BLOCKED: Acumatica EAC/cost-to-complete data untrustworthy. No approval UI designed.'
),

(
  'Change Event Candidate Auto-Promotion',
  'change-event-auto-promotion',
  'pipeline', 'backend', 'planned',
  'event', 'After compiler writes to change_event_candidates',
  'Reviews AI-generated change event candidates and promotes confirmed ones into actual change events.',
  '["change_event_candidates"]',
  'New change event records',
  'change_events table',
  true, null,
  null,
  null,
  '{"comms-compiler"}',
  'No approval UI built. No confidence scoring on candidates.',
  60, 'M', 'high',
  'Same session as compiler',
  'BLOCKED: Mandatory approval gate required (financial write). No UI for reviewing candidates.'
),

(
  'Portfolio Executive Brief',
  'portfolio-executive-brief',
  'pipeline', 'backend', 'planned',
  'scheduled', 'Weekly cron',
  'Weekly C-suite brief across all projects — portfolio health, risks, wins, financial snapshot.',
  '["comms-compiler outputs", "acumatica-financial-sync", "meeting-extractor outputs"]',
  'Formatted executive brief',
  null,
  null, null,
  null,
  null,
  '{"comms-compiler", "acumatica-financial-sync", "meeting-extractor"}',
  'Depends on WIP/margin data being trustworthy (Acumatica gap). Delivery format not decided.',
  55, 'L', 'high',
  'Weekly — can tolerate up to 24h stale data',
  'BLOCKED: WIP/margin data untrustworthy. Output delivery format (email/PDF/in-app) not decided.'
);
