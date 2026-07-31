create table if not exists public.durable_ai_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  session_id text not null references public.conversations(session_id) on delete cascade,
  client_message_id text not null,
  workflow_run_id text,
  status text not null default 'accepted'
    check (status in ('accepted', 'running', 'completed', 'failed')),
  stage text not null default 'accepted',
  user_message_id uuid references public.chat_history(id) on delete set null,
  assistant_message_id uuid references public.chat_history(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, session_id, client_message_id),
  unique (workflow_run_id)
);

create index if not exists durable_ai_turns_session_created_idx
  on public.durable_ai_turns (session_id, created_at desc);

alter table public.durable_ai_turns enable row level security;

comment on table public.durable_ai_turns is
  'Exactly-once submission ledger and reconnect locator for the Vercel Workflow AI chat canary.';
