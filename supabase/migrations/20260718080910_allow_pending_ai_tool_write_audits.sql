-- Reserve approved AI writes before their side effects begin.
-- A pending reservation is replayable and prevents duplicate financial writes
-- until the same row is finalized as success or failed as error.

alter table public.ai_tool_write_audits
  drop constraint if exists ai_tool_write_audits_status_check;

alter table public.ai_tool_write_audits
  add constraint ai_tool_write_audits_status_check
  check (status in ('pending', 'success', 'error'));

drop index if exists public.uq_ai_tool_write_audits_idempotency;

create unique index uq_ai_tool_write_audits_idempotency
  on public.ai_tool_write_audits (user_id, tool_name, idempotency_key)
  where status in ('pending', 'success');
