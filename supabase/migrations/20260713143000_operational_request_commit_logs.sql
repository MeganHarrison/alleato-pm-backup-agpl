-- Operational observability logs
--
-- Captures request-level traffic and GitHub push commits for owner/admin
-- inspection. These are append-only operational ledgers, separate from the
-- business-row db_audit_log trigger ledger.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.app_request_log (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  method text not null,
  path text not null,
  query_string text,
  status_code integer,
  duration_ms integer,
  user_id uuid,
  user_email text,
  client_ip_hash text,
  user_agent text,
  referrer text,
  source text not null default 'middleware',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.app_request_log is
  'Append-only application request log captured by Next.js middleware.';

create index if not exists idx_app_request_log_created_at
  on public.app_request_log (created_at desc);

create index if not exists idx_app_request_log_path_created_at
  on public.app_request_log (path, created_at desc);

create index if not exists idx_app_request_log_user_created_at
  on public.app_request_log (user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_app_request_log_status_created_at
  on public.app_request_log (status_code, created_at desc)
  where status_code is not null;

create table if not exists public.developer_commit_log (
  id uuid primary key default gen_random_uuid(),
  repository_full_name text not null,
  branch text not null,
  commit_sha text not null,
  commit_message text,
  commit_url text,
  compare_url text,
  commit_author_name text,
  commit_author_email text,
  commit_committer_name text,
  commit_committer_email text,
  pushed_by_username text,
  pushed_by_name text,
  pushed_by_email text,
  webhook_delivery_id text,
  event_type text not null default 'push',
  pushed_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  unique (repository_full_name, commit_sha)
);

comment on table public.developer_commit_log is
  'Append-only GitHub push commit log showing commit author, committer, and pusher.';

create index if not exists idx_developer_commit_log_received_at
  on public.developer_commit_log (received_at desc);

create index if not exists idx_developer_commit_log_repo_branch_received
  on public.developer_commit_log (repository_full_name, branch, received_at desc);

create index if not exists idx_developer_commit_log_pusher_received
  on public.developer_commit_log (pushed_by_username, received_at desc)
  where pushed_by_username is not null;

alter table public.app_request_log enable row level security;
alter table public.developer_commit_log enable row level security;

drop policy if exists app_request_log_service_role_all on public.app_request_log;
create policy app_request_log_service_role_all
  on public.app_request_log
  as permissive
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists developer_commit_log_service_role_all on public.developer_commit_log;
create policy developer_commit_log_service_role_all
  on public.developer_commit_log
  as permissive
  for all
  to service_role
  using (true)
  with check (true);

commit;
