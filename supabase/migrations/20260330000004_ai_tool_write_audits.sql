-- AI tool write audit log
create table if not exists public.ai_tool_write_audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  tool_name text not null,
  idempotency_key text not null,
  status text not null check (status in ('success', 'error')),
  project_id integer null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb null
);
create index if not exists idx_ai_tool_write_audits_user_tool_created
  on public.ai_tool_write_audits (user_id, tool_name, created_at desc);
create unique index if not exists uq_ai_tool_write_audits_idempotency
  on public.ai_tool_write_audits (user_id, tool_name, idempotency_key)
  where status = 'success';
