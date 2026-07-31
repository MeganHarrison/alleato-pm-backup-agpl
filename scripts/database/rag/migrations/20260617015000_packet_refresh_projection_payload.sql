-- RAG/AI Database migration.
--
-- Adds PM-app projection staging fields to the existing RAG-owned
-- packet_refresh_jobs queue. High-churn compiler work stays in the AI database;
-- a separate projection worker can then apply the final bounded packet rows to
-- PM APP through enforce_pm_app_final_projection_guard().

set statement_timeout = 0;
set lock_timeout = '5min';

alter table if exists public.packet_refresh_jobs
  add column if not exists projection_status text not null default 'not_staged',
  add column if not exists projection_payload jsonb not null default '{}'::jsonb,
  add column if not exists projection_error text,
  add column if not exists projection_attempt_count integer not null default 0,
  add column if not exists projected_output_packet_id text,
  add column if not exists projected_at timestamptz;

do $$
begin
  alter table public.packet_refresh_jobs
    add constraint packet_refresh_jobs_projection_status_check
    check (
      projection_status in (
        'not_staged',
        'staged',
        'projecting',
        'projected',
        'failed',
        'skipped'
      )
    );
exception
  when duplicate_object then null;
end $$;

create index if not exists packet_refresh_jobs_projection_status_idx
  on public.packet_refresh_jobs(projection_status, priority desc, queued_at);

comment on column public.packet_refresh_jobs.projection_status is
  'RAG-side PM projection state. Final PM writes must drain through the bounded projection worker.';

comment on column public.packet_refresh_jobs.projection_payload is
  'JSON payload for bounded final PM APP packet/card projection. High-churn synthesis remains in AI/RAG.';
