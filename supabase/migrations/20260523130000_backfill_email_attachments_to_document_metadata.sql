-- Migration: Backfill email_attachments → document_metadata
-- Purpose: Promote legacy email_attachments rows into document_metadata so they
--          can be embedded, searched, and linked via Pattern C junctions.
-- Affects: INSERT into public.document_metadata (PM APP project)
-- Note: email_attachments has 471 rows, all with graph_attachment_id.
--       Idempotency: uses source_system='email_attachment_legacy' + source_item_id=graph_attachment_id.
--       Conflict clause: on conflict (source_system, source_item_id) do nothing.
-- Note: The Outlook Graph sync pipeline promotes email bodies but NOT attachments.
--       This migration fills that gap. email_attachments is NOT deleted (read-only legacy).
-- Note: document_metadata.id is TEXT — we generate a stable id from source_system + attachment id.
-- Note: document_metadata.phase is NOT NULL — defaulting to 'active'.
-- Note: document_metadata.source_metadata is NOT NULL — defaulting to '{}'.

-- First: verify the conflict constraint exists on document_metadata
-- (source_system, source_item_id unique constraint added in prior migration or exists already)
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'document_metadata'
      and c.contype = 'u'
      and array_to_string(c.conkey::int[], ',') in (
        select array_to_string(array_agg(a.attnum order by a.attnum)::int[], ',')
        from pg_attribute a
        where a.attrelid = t.oid
          and a.attname in ('source_system', 'source_item_id')
      )
  ) then
    -- Create the unique constraint so ON CONFLICT clause works
    alter table public.document_metadata
      add constraint uq_document_metadata_source
      unique (source_system, source_item_id);
  end if;
end $$;

-- Backfill: one document_metadata row per email attachment
insert into public.document_metadata (
  id,
  title,
  file_name,
  url,
  category,
  document_type,
  source_system,
  source_item_id,
  phase,
  source_metadata,
  created_at,
  captured_at
)
select
  -- Stable deterministic id: 'ea-' prefix + graph_attachment_id
  'ea-' || ea.graph_attachment_id                         as id,
  ea.file_name                                            as title,
  ea.file_name                                            as file_name,
  ea.file_url                                             as url,
  'email_attachment'                                      as category,
  'email_attachment'                                      as document_type,
  'email_attachment_legacy'                               as source_system,
  ea.graph_attachment_id                                  as source_item_id,
  'active'                                                as phase,
  jsonb_build_object(
    'email_id',         ea.email_id,
    'attachment_id',    ea.id,
    'content_type',     ea.content_type,
    'file_size',        ea.file_size,
    'attachment_type',  ea.attachment_type,
    'attachment_category', ea.attachment_category,
    'checksum_sha256',  ea.checksum_sha256
  )                                                       as source_metadata,
  ea.created_at                                           as created_at,
  ea.created_at                                           as captured_at
from public.email_attachments ea
where ea.graph_attachment_id is not null
on conflict (source_system, source_item_id) do nothing;

-- Report how many were inserted
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.document_metadata
  where source_system = 'email_attachment_legacy';
  raise notice 'email_attachment_legacy rows in document_metadata: %', v_count;
end $$;
