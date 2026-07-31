create extension if not exists pgcrypto;

create table if not exists public.graph_sync_state (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  resource_id text not null,
  resource_name text null,
  delta_token text null,
  last_sync_at timestamptz null,
  sync_status text not null default 'pending',
  error_message text null,
  items_synced integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists graph_sync_state_source_resource_idx
  on public.graph_sync_state(source, resource_id);

create index if not exists graph_sync_state_last_sync_idx
  on public.graph_sync_state(last_sync_at);

alter table public.graph_sync_state enable row level security;

drop policy if exists graph_sync_state_admin_select on public.graph_sync_state;
create policy graph_sync_state_admin_select
  on public.graph_sync_state
  for select
  using (auth.role() = 'service_role');

drop policy if exists graph_sync_state_service_write on public.graph_sync_state;
create policy graph_sync_state_service_write
  on public.graph_sync_state
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
