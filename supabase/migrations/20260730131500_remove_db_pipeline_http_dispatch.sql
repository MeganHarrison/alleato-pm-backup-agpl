-- Retire the database-owned HTTP pipeline dispatcher.
--
-- Vercel Workflow is the sole ordering/retry owner. The database retains only
-- ingestion-job bookkeeping so operational queues and health checks continue
-- to observe new real documents without initiating network work.

drop trigger if exists trg_enqueue_document_metadata_rag_job
on public.document_metadata;

drop function if exists public.enqueue_document_metadata_rag_job();

create or replace function public.record_document_metadata_ingestion_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_id text;
begin
  if new.type in ('meeting_agenda_task') then
    return new;
  end if;

  job_id := coalesce(new.fireflies_id, new.id::text);

  insert into public.fireflies_ingestion_jobs (
    fireflies_id,
    metadata_id,
    stage
  )
  values (job_id, new.id::text, 'raw_ingested')
  on conflict (fireflies_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_record_document_metadata_ingestion_job
on public.document_metadata;

create trigger trg_record_document_metadata_ingestion_job
after insert on public.document_metadata
for each row
execute function public.record_document_metadata_ingestion_job();

delete from public.pipeline_config
where key = 'pipeline_url';

comment on function public.record_document_metadata_ingestion_job() is
  'Records ingestion queue state only. Network dispatch and pipeline ordering are owned by Vercel Workflow.';
