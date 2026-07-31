alter table public.durable_ai_turns
  drop constraint if exists durable_ai_turns_status_check;

alter table public.durable_ai_turns
  add constraint durable_ai_turns_status_check
  check (status in ('accepted', 'running', 'completed', 'failed', 'canceled'));

alter table public.durable_ai_turns enable row level security;

drop policy if exists "Users can view their own durable AI turns"
  on public.durable_ai_turns;

create policy "Users can view their own durable AI turns"
  on public.durable_ai_turns
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all privileges
  on table public.durable_ai_turns
  from public, anon, authenticated;

grant select
  on table public.durable_ai_turns
  to authenticated;

grant select, insert, update
  on table public.durable_ai_turns
  to service_role;

comment on table public.durable_ai_turns is
  'Provider-neutral exactly-once command ledger and reconnect receipt for AI assistant turns.';

comment on column public.durable_ai_turns.status is
  'Turn lifecycle: accepted, running, completed, failed, or canceled.';

comment on column public.durable_ai_turns.workflow_run_id is
  'Legacy nullable execution locator retained for schema compatibility; the AssistantTurn shell does not require Workflow.';
