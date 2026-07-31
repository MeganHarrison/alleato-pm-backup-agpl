create extension if not exists pgcrypto;

create table if not exists public.graph_subscriptions (
  id uuid primary key default gen_random_uuid(),
  graph_subscription_id text null,
  resource text not null,
  source text not null,
  resource_id text not null,
  resource_name text null,
  change_type text not null,
  notification_url text null,
  client_state_hash text null,
  lifecycle_notification_url text null,
  status text not null default 'pending',
  expiration_at timestamptz null,
  last_notification_at timestamptz null,
  last_lifecycle_event_at timestamptz null,
  last_renewed_at timestamptz null,
  last_error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists graph_subscriptions_source_resource_idx
  on public.graph_subscriptions(source, resource_id);

create index if not exists graph_subscriptions_status_expiration_idx
  on public.graph_subscriptions(status, expiration_at);

alter table public.graph_subscriptions enable row level security;

drop policy if exists graph_subscriptions_admin_select on public.graph_subscriptions;
create policy graph_subscriptions_admin_select
  on public.graph_subscriptions
  for select
  using (auth.role() = 'service_role');

drop policy if exists graph_subscriptions_service_write on public.graph_subscriptions;
create policy graph_subscriptions_service_write
  on public.graph_subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
