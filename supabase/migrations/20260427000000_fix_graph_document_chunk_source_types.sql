-- Repair Microsoft Graph chunk source_type drift.
--
-- Graph documents were sometimes embedded through paths that left
-- document_chunks.source_type as generic "document" or meeting-derived values.
-- Source-specific RAG depends on source_type matching the Graph category.

-- This migration touches a hot table. Supabase CLI sets a short lock_timeout by
-- default; relax it here so we don't fail mid-deploy when ingestion traffic is
-- active.
set statement_timeout = 0;
set lock_timeout = '5min';

-- Prevent future drift: normalize Graph chunk source_type based on the
-- owning document_metadata row. This avoids migration-time backfills that can
-- hit statement timeouts on large tables.

create or replace function public.normalize_graph_document_chunk_source_type()
returns trigger
language plpgsql
as $$
declare
  v_source text;
  v_category text;
begin
  select dm.source, dm.category
    into v_source, v_category
  from public.document_metadata dm
  where dm.id = new.document_id;

  if v_source = 'microsoft_graph' then
    new.source_type := case
      when v_category = 'teams_message' then 'teams_message'
      when v_category = 'email' then 'email'
      when v_category = 'document' then 'onedrive_document'
      else 'microsoft_graph'
    end;
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
