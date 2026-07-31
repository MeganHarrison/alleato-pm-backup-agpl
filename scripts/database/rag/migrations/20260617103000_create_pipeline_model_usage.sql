-- RAG/AI Database migration.
--
-- Durable model usage ledger for background source-processing, embedding, and
-- intelligence jobs. This table intentionally lives in the AI/RAG database so
-- high-volume telemetry does not add write pressure to the PM APP database.

set statement_timeout = 0;
set lock_timeout = '5min';

create table if not exists public.pipeline_model_usage (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  usage_date date generated always as ((occurred_at at time zone 'UTC')::date) stored,
  provider text not null default 'openai',
  model text not null,
  stage text not null,
  operation text not null,
  source_system text,
  source_item_id text,
  project_id bigint,
  request_id text,
  status text not null default 'succeeded',
  prompt_tokens integer not null default 0,
  cached_prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  input_items integer not null default 0,
  output_items integer not null default 0,
  estimated_cost_usd numeric(12, 6),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pipeline_model_usage_status_check check (
    status in ('succeeded', 'failed', 'skipped', 'budget_blocked')
  ),
  constraint pipeline_model_usage_token_counts_check check (
    prompt_tokens >= 0
    and cached_prompt_tokens >= 0
    and completion_tokens >= 0
    and total_tokens >= 0
    and input_items >= 0
    and output_items >= 0
  )
);

create index if not exists pipeline_model_usage_date_stage_idx
  on public.pipeline_model_usage(usage_date, stage, model);

create index if not exists pipeline_model_usage_occurred_idx
  on public.pipeline_model_usage(occurred_at desc);

create index if not exists pipeline_model_usage_source_idx
  on public.pipeline_model_usage(source_system, source_item_id)
  where source_system is not null and source_item_id is not null;

create index if not exists pipeline_model_usage_project_idx
  on public.pipeline_model_usage(project_id, usage_date)
  where project_id is not null;

grant select, insert, update, delete on public.pipeline_model_usage to service_role;

comment on table public.pipeline_model_usage is
  'RAG-side model usage and estimated-cost ledger for source-processing, embeddings, and intelligence jobs.';

comment on column public.pipeline_model_usage.estimated_cost_usd is
  'Best-effort cost estimate based on configured model pricing. Exact billing remains provider-owned.';
