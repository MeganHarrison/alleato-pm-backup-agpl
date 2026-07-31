create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  category text not null,
  code text not null,
  severity text not null default 'warning',
  source text not null,
  resource_id text not null default '',
  title text not null,
  message text not null,
  status text not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz null,
  project_id integer null references public.projects(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_alerts_severity_check
    check (severity in ('info', 'warning', 'critical')),
  constraint system_alerts_status_check
    check (status in ('active', 'acknowledged', 'resolved'))
);

create index if not exists idx_system_alerts_active
  on public.system_alerts (status, severity, last_seen_at desc);

create index if not exists idx_system_alerts_category
  on public.system_alerts (category, status, last_seen_at desc);

create index if not exists idx_system_alerts_project
  on public.system_alerts (project_id, status, last_seen_at desc)
  where project_id is not null;

drop trigger if exists set_system_alerts_updated_at on public.system_alerts;
create trigger set_system_alerts_updated_at
  before update on public.system_alerts
  for each row
  execute function public.update_updated_at_column();

alter table public.system_alerts enable row level security;

drop policy if exists "Admins can read system alerts" on public.system_alerts;
create policy "Admins can read system alerts"
  on public.system_alerts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.is_admin = true
    )
  );

drop policy if exists "Service role can manage system alerts" on public.system_alerts;
create policy "Service role can manage system alerts"
  on public.system_alerts
  for all
  to service_role
  using (true)
  with check (true);
