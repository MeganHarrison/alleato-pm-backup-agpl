alter table public.daily_logs
  add column if not exists status text not null default 'draft',
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid,
  add column if not exists general_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_logs_status_check'
      and conrelid = 'public.daily_logs'::regclass
  ) then
    alter table public.daily_logs
      add constraint daily_logs_status_check
      check (status in ('draft', 'pending', 'complete'));
  end if;
end $$;

create table if not exists public.daily_log_weather (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references public.daily_logs(id) on delete cascade,
  area text,
  time_observed time,
  delay boolean not null default false,
  location text,
  sky text,
  temperature numeric,
  calamity text,
  average text,
  precipitation text,
  wind text,
  ground_or_sea text,
  comments text,
  attachments_count integer not null default 0,
  related_items_count integer not null default 0,
  created_at timestamptz default now(),
  constraint daily_log_weather_attachments_count_check check (attachments_count >= 0),
  constraint daily_log_weather_related_items_count_check check (related_items_count >= 0)
);

alter table public.daily_log_manpower
  add column if not exists area text,
  add column if not exists location text,
  add column if not exists comments text,
  add column if not exists issue_flag boolean not null default false,
  add column if not exists cost_code text,
  add column if not exists attachments_count integer not null default 0,
  add column if not exists related_items_count integer not null default 0;

alter table public.daily_log_equipment
  add column if not exists area text,
  add column if not exists location text,
  add column if not exists comments text,
  add column if not exists cost_code text,
  add column if not exists inspected boolean not null default false,
  add column if not exists inspection_time time,
  add column if not exists attachments_count integer not null default 0,
  add column if not exists related_items_count integer not null default 0;

alter table public.daily_log_notes
  add column if not exists area text,
  add column if not exists location text,
  add column if not exists issue_flag boolean not null default false,
  add column if not exists attachments_count integer not null default 0,
  add column if not exists related_items_count integer not null default 0;

create index if not exists idx_daily_log_weather_daily_log
  on public.daily_log_weather(daily_log_id);

create index if not exists idx_daily_log_weather_delay
  on public.daily_log_weather(daily_log_id, delay)
  where delay = true;

create index if not exists idx_daily_logs_project_status_date
  on public.daily_logs(project_id, status, log_date desc);

grant all on table public.daily_log_weather to anon;
grant all on table public.daily_log_weather to authenticated;
grant all on table public.daily_log_weather to service_role;
