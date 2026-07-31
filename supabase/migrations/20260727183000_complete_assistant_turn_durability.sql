alter table public.durable_ai_turns
  add column if not exists payload_identity text,
  add column if not exists command_payload jsonb,
  add column if not exists runtime_kind text,
  add column if not exists runtime_locator text,
  add column if not exists terminal_outcome text,
  add column if not exists source_receipts jsonb not null default '[]'::jsonb,
  add column if not exists warning_messages jsonb not null default '[]'::jsonb,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists version bigint not null default 0;

update public.durable_ai_turns
set payload_identity = 'legacy:' || id::text
where payload_identity is null;

alter table public.durable_ai_turns
  alter column payload_identity set not null;

alter table public.durable_ai_turns
  drop constraint if exists durable_ai_turns_runtime_kind_check,
  add constraint durable_ai_turns_runtime_kind_check
    check (runtime_kind is null or runtime_kind in ('legacy', 'eve')),
  drop constraint if exists durable_ai_turns_terminal_outcome_check,
  add constraint durable_ai_turns_terminal_outcome_check
    check (
      terminal_outcome is null
      or terminal_outcome in (
        'completed',
        'completed_with_warnings',
        'needs_user_input',
        'canceled',
        'failed'
      )
    ),
  drop constraint if exists durable_ai_turns_source_receipts_array_check,
  add constraint durable_ai_turns_source_receipts_array_check
    check (jsonb_typeof(source_receipts) = 'array'),
  drop constraint if exists durable_ai_turns_warning_messages_array_check,
  add constraint durable_ai_turns_warning_messages_array_check
    check (jsonb_typeof(warning_messages) = 'array');

create table if not exists public.durable_ai_turn_events (
  id bigint generated always as identity primary key,
  turn_id uuid not null
    references public.durable_ai_turns(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null,
  durability text not null default 'durable'
    check (durability = 'durable'),
  data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (turn_id, sequence)
);

create index if not exists durable_ai_turn_events_turn_sequence_idx
  on public.durable_ai_turn_events (turn_id, sequence);

create table if not exists public.durable_ai_turn_approvals (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null
    references public.durable_ai_turns(id) on delete cascade,
  request_id text not null,
  payload_identity text not null,
  prompt text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  decision_by uuid references public.user_profiles(id) on delete set null,
  decision_at timestamptz,
  created_at timestamptz not null default now(),
  unique (turn_id, request_id)
);

create unique index if not exists durable_ai_turn_one_pending_approval_idx
  on public.durable_ai_turn_approvals (turn_id)
  where status = 'pending';

create or replace function public.guard_durable_ai_turn_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.payload_identity is distinct from new.payload_identity then
    raise exception 'durable AI turn payload identity is immutable';
  end if;
  if old.command_payload is distinct from new.command_payload then
    raise exception 'durable AI turn command payload is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_durable_ai_turn_identity
  on public.durable_ai_turns;
create trigger guard_durable_ai_turn_identity
before update on public.durable_ai_turns
for each row execute function public.guard_durable_ai_turn_identity();

create or replace function public.guard_durable_ai_turn_approval_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  turn_identity text;
begin
  select payload_identity
  into turn_identity
  from public.durable_ai_turns
  where id = new.turn_id;

  if turn_identity is distinct from new.payload_identity then
    raise exception 'approval payload identity does not match its durable AI turn';
  end if;

  if tg_op = 'UPDATE' and (
    old.turn_id is distinct from new.turn_id
    or old.request_id is distinct from new.request_id
    or old.payload_identity is distinct from new.payload_identity
    or old.prompt is distinct from new.prompt
  ) then
    raise exception 'durable AI turn approval request identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_durable_ai_turn_approval_identity
  on public.durable_ai_turn_approvals;
create trigger guard_durable_ai_turn_approval_identity
before insert or update on public.durable_ai_turn_approvals
for each row execute function public.guard_durable_ai_turn_approval_identity();

alter table public.durable_ai_turn_events enable row level security;
alter table public.durable_ai_turn_approvals enable row level security;

drop policy if exists "Users can view their own durable AI turn events"
  on public.durable_ai_turn_events;
create policy "Users can view their own durable AI turn events"
  on public.durable_ai_turn_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.durable_ai_turns turns
      where turns.id = turn_id
        and turns.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can view their own durable AI turn approvals"
  on public.durable_ai_turn_approvals;
create policy "Users can view their own durable AI turn approvals"
  on public.durable_ai_turn_approvals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.durable_ai_turns turns
      where turns.id = turn_id
        and turns.user_id = (select auth.uid())
    )
  );

revoke all privileges
  on table public.durable_ai_turn_events
  from public, anon, authenticated;
revoke all privileges
  on table public.durable_ai_turn_approvals
  from public, anon, authenticated;

grant select
  on table public.durable_ai_turn_events
  to authenticated;
grant select
  on table public.durable_ai_turn_approvals
  to authenticated;
grant select, insert
  on table public.durable_ai_turn_events
  to service_role;
grant select, insert, update
  on table public.durable_ai_turn_approvals
  to service_role;

comment on column public.durable_ai_turns.payload_identity is
  'Immutable digest of the accepted command payload.';
comment on column public.durable_ai_turns.command_payload is
  'Immutable accepted command payload used for durable resume.';
comment on table public.durable_ai_turn_events is
  'Ordered durable replay ledger for AssistantTurn lifecycle, runtime, source, tool, artifact, and warning receipts.';
comment on table public.durable_ai_turn_approvals is
  'Immutable approval requests and single authenticated decisions for AssistantTurn effects.';
