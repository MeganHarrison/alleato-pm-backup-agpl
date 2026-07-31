-- Email thread compiler infrastructure.
--
-- 1. Index for thread lookup: every compile_thread() call joins by the Outlook
--    conversation_id stored at source_metadata->>'conversation_id'. Without an
--    index this falls back to a sequential scan over all email rows.
--
-- 2. Index for batch claim: run_email_compiler_batch() pulls pending threads
--    whose latest message has source_metadata->email_compiler->>'status' != 'compiled'.
--    A partial index on uncompiled outlook emails ordered by date keeps that
--    query bounded as compiled rows accumulate.
--
-- 3. RPC analogous to get_teams_compiler_status() for monitoring.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create index if not exists idx_document_metadata_email_conversation_id
  on public.document_metadata ((source_metadata->>'conversation_id'))
  where category = 'email'
    and source_system = 'outlook_email'
    and source_metadata ? 'conversation_id';

create index if not exists idx_document_metadata_email_pending
  on public.document_metadata (date desc)
  where category = 'email'
    and source_system = 'outlook_email'
    and (
      source_metadata->'email_compiler' is null
      or source_metadata->'email_compiler'->>'status' is distinct from 'compiled'
    );

create or replace function public.get_email_compiler_status()
returns jsonb
language sql
stable
as $$
  with email_rows as (
    select
      id,
      source_metadata,
      source_metadata->>'conversation_id' as conversation_id,
      source_metadata->'email_compiler'->>'status' as compiler_status
    from public.document_metadata
    where category = 'email'
      and source_system = 'outlook_email'
  ),
  thread_status as (
    select
      conversation_id,
      coalesce(bool_or(compiler_status = 'compiled'), false) as has_compiled,
      coalesce(bool_or(compiler_status = 'error'), false) as has_error,
      coalesce(
        bool_or(compiler_status is null or compiler_status not in ('compiled','error','skipped_low_content')),
        true
      ) as has_pending,
      count(*) as message_count
    from email_rows
    where conversation_id is not null
    group by conversation_id
  )
  select jsonb_build_object(
    'total_email_rows', (select count(*) from email_rows),
    'rows_compiled',
      (select count(*) from email_rows where compiler_status = 'compiled'),
    'rows_pending',
      (select count(*) from email_rows
       where compiler_status is null
          or compiler_status not in ('compiled','error','skipped_low_content')),
    'rows_failed',
      (select count(*) from email_rows where compiler_status = 'error'),
    'rows_skipped_low_content',
      (select count(*) from email_rows where compiler_status = 'skipped_low_content'),
    'distinct_threads', (select count(*) from thread_status),
    'threads_compiled', (select count(*) from thread_status where has_compiled),
    'threads_pending', (select count(*) from thread_status where has_pending and not has_compiled),
    'threads_failed', (select count(*) from thread_status where has_error and not has_compiled),
    'last_successful_run',
      (select max(captured_at) from public.document_metadata
       where category = 'email'
         and source_system = 'outlook_email'
         and source_metadata->'email_compiler'->>'status' = 'compiled'),
    'avg_thread_message_count',
      (select round(avg(message_count)::numeric, 2) from thread_status)
  );
$$;

grant execute on function public.get_email_compiler_status() to anon, authenticated, service_role;

commit;
