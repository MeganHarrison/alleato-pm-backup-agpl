-- Add batchable cleanup for historical Microsoft Graph RAG source_type drift.
--
-- The previous guardrail prevents new drift, but old document_chunks rows can
-- still be mislabeled as document/meeting_* because they were processed through
-- older pipeline paths. Do not run a single hot-table backfill here; expose a
-- small batch function so operations can repair the table safely.

set statement_timeout = 0;
set lock_timeout = '5min';
create or replace function public.graph_document_chunk_source_type(
  doc_category text,
  doc_type text
)
returns text
language sql
immutable
as $$
  select case
    when doc_category = 'teams_message' and doc_type = 'teams_dm_conversation' then 'teams_dm'
    when doc_category = 'teams_message' and doc_type = 'teams_message' then 'teams_channel'
    when doc_category = 'teams_message' then 'teams_message'
    when doc_category = 'email' then 'email'
    when doc_category = 'document' then 'onedrive_document'
    else 'microsoft_graph'
  end
$$;
create or replace function public.normalize_graph_document_chunk_source_type()
returns trigger
language plpgsql
as $$
declare
  v_source text;
  v_category text;
  v_type text;
begin
  select dm.source, dm.category, dm.type
    into v_source, v_category, v_type
  from public.document_metadata dm
  where dm.id = new.document_id;

  if v_source = 'microsoft_graph' then
    new.source_type := public.graph_document_chunk_source_type(v_category, v_type);
  end if;

  return new;
end;
$$;
drop trigger if exists document_chunks_normalize_graph_source_type on public.document_chunks;
create trigger document_chunks_normalize_graph_source_type
before insert or update of document_id, source_type
on public.document_chunks
for each row
execute function public.normalize_graph_document_chunk_source_type();
create or replace function public.repair_graph_document_chunk_source_types_batch(
  batch_size int default 5000
)
returns table(updated_count int, remaining_count int)
language plpgsql
security definer
set search_path = public
as $$
begin
  with candidates as (
    select
      dc.chunk_id,
      public.graph_document_chunk_source_type(dm.category, dm.type) as expected_source_type
    from public.document_chunks dc
    join public.document_metadata dm
      on dm.id = dc.document_id
    where dm.source = 'microsoft_graph'
      and dc.source_type is distinct from public.graph_document_chunk_source_type(dm.category, dm.type)
    order by dc.created_at nulls first, dc.chunk_id
    limit greatest(batch_size, 1)
    for update of dc skip locked
  ),
  updated as (
    update public.document_chunks dc
       set source_type = candidates.expected_source_type
      from candidates
     where dc.chunk_id = candidates.chunk_id
     returning 1
  )
  select count(*)::int into updated_count from updated;

  select count(*)::int into remaining_count
  from public.document_chunks dc
  join public.document_metadata dm
    on dm.id = dc.document_id
  where dm.source = 'microsoft_graph'
    and dc.source_type is distinct from public.graph_document_chunk_source_type(dm.category, dm.type);

  return next;
end;
$$;
grant execute on function public.graph_document_chunk_source_type(text, text)
  to authenticated, service_role;
grant execute on function public.repair_graph_document_chunk_source_types_batch(int)
  to service_role;
