-- Durable state for resumable Executive Intelligence runs.
-- Existing ai_work_runs remains the canonical ledger; these columns make
-- scheduler retry/resume state queryable without relying on JSON metadata.

begin;

alter table public.ai_work_runs
  add column if not exists business_date date,
  add column if not exists attempt_count integer not null default 0
    check (attempt_count >= 0),
  add column if not exists blocker text,
  add column if not exists next_attempt_at timestamptz;

create index if not exists ai_work_runs_business_date_status_idx
  on public.ai_work_runs(workflow_id, business_date, status, created_at desc);

create index if not exists ai_work_runs_retry_due_idx
  on public.ai_work_runs(next_attempt_at, status)
  where next_attempt_at is not null;

create or replace function public.guard_ai_work_run_terminal_state()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('succeeded', 'partial_success')
     and (new.blocker is not null or new.next_attempt_at is not null) then
    raise exception 'ai_work_runs cannot be promoted while blocked or scheduled for retry';
  end if;
  return new;
end;
$$;

drop trigger if exists ai_work_runs_guard_terminal_state on public.ai_work_runs;
create trigger ai_work_runs_guard_terminal_state
  before insert or update on public.ai_work_runs
  for each row execute function public.guard_ai_work_run_terminal_state();

comment on column public.ai_work_runs.business_date is
  'Business date represented by this intelligence run, independent of wall-clock timestamps.';
comment on column public.ai_work_runs.attempt_count is
  'Monotonic scheduler execution attempt count; resume increments this value.';
comment on column public.ai_work_runs.blocker is
  'Actionable blocker explaining why the run is not complete.';
comment on column public.ai_work_runs.next_attempt_at is
  'Earliest timestamp at which a retry/resume may be attempted.';

commit;
