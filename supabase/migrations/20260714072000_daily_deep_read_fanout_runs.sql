create table if not exists public.daily_deep_read_fanout_runs (
  packet_id uuid primary key references public.intelligence_packets(id) on delete cascade,
  business_date date not null,
  source_counts jsonb not null default '{}'::jsonb,
  candidate_count integer not null default 0,
  assigned_candidate_count integer not null default 0,
  task_count integer not null default 0,
  project_intelligence_count integer not null default 0,
  project_intelligence_rich_count integer not null default 0,
  project_intelligence_missing_count integer not null default 0,
  progress_report_count integer not null default 0,
  insight_card_count integer not null default 0,
  output_status jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_deep_read_fanout_runs_business_date_idx
  on public.daily_deep_read_fanout_runs (business_date desc);

alter table public.daily_deep_read_fanout_runs enable row level security;

create policy "authenticated users can read daily deep read fanout runs"
  on public.daily_deep_read_fanout_runs for select
  to authenticated
  using (true);

create policy "service role manages daily deep read fanout runs"
  on public.daily_deep_read_fanout_runs for all
  to service_role
  using (true)
  with check (true);
