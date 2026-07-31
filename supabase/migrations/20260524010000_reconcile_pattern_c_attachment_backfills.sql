-- Migration: Reconcile Pattern C attachment backfills
-- Purpose: Replay-safe safety net for legacy attachment rows already migrated
--          remotely by the May 18 out-of-order migrations.
-- Affects:
--   - public.document_metadata
--   - public.subcontract_documents
--   - public.purchase_order_documents
--   - public.prime_contract_documents
--   - public.change_event_documents
--   - public.submittal_doc_links
--
-- This migration is intentionally idempotent. It exists because the linked
-- remote ledger contains two May 18 Pattern C migrations that were not present
-- in the local checkout. The placeholder files preserve ledger visibility; this
-- later migration performs the actual reconciliation after all Pattern C base
-- tables exist in chronological local migration order.

create or replace function public.user_can_access_entity(
  entity_type text,
  entity_id   text
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project_id integer;
  has_access   boolean;
begin
  if public.current_is_app_admin() then
    return true;
  end if;

  case entity_type

    when 'project' then
      return public.current_is_project_member(entity_id::integer);

    when 'commitment' then
      select cu.project_id into v_project_id
      from public.commitments_unified cu
      where cu.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'prime_contract' then
      select pc.project_id::integer into v_project_id
      from public.prime_contracts pc
      where pc.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'change_order' then
      select co.project_id into v_project_id
      from public.change_orders co
      where co.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'change_event' then
      select ce.project_id::integer into v_project_id
      from public.change_events ce
      where ce.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'invoice' then
      select pc.project_id::integer into v_project_id
      from public.owner_invoices oi
      join public.prime_contracts pc on pc.id = oi.prime_contract_id
      where oi.id = entity_id::bigint;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'subcontractor_invoice' then
      select si.project_id into v_project_id
      from public.subcontractor_invoices si
      where si.id = entity_id::bigint;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'submittal' then
      select s.project_id into v_project_id
      from public.submittals s
      where s.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'rfi' then
      select r.project_id::integer into v_project_id
      from public.rfis r
      where r.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'drawing' then
      select d.project_id into v_project_id
      from public.drawings d
      where d.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'company' then
      has_access := (select auth.uid()) is not null;

    else
      has_access := false;

  end case;

  return coalesce(has_access, false);
end;
$$;

comment on function public.user_can_access_entity(text, text) is
  'Shared RLS helper for document junction tables. Returns true if the current user has access to the given entity.';

grant execute on function public.user_can_access_entity(text, text) to authenticated;

create table if not exists public.change_event_documents (
  change_event_id      uuid        not null references public.change_events(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  document_type        text        references public.document_type_taxonomy(type_key),
  attached_at          timestamptz not null default now(),
  attached_by          uuid        references auth.users(id),
  primary key (change_event_id, document_metadata_id)
);

create index if not exists idx_change_event_documents_doc
  on public.change_event_documents (document_metadata_id);

alter table public.change_event_documents enable row level security;

drop policy if exists "change_event_documents_select" on public.change_event_documents;
create policy "change_event_documents_select" on public.change_event_documents
  for select to authenticated
  using (public.user_can_access_entity('change_event', change_event_id::text));

drop policy if exists "change_event_documents_insert" on public.change_event_documents;
create policy "change_event_documents_insert" on public.change_event_documents
  for insert to authenticated
  with check (public.user_can_access_entity('change_event', change_event_id::text));

drop policy if exists "change_event_documents_update" on public.change_event_documents;
create policy "change_event_documents_update" on public.change_event_documents
  for update to authenticated
  using (public.user_can_access_entity('change_event', change_event_id::text))
  with check (public.user_can_access_entity('change_event', change_event_id::text));

drop policy if exists "change_event_documents_delete" on public.change_event_documents;
create policy "change_event_documents_delete" on public.change_event_documents
  for delete to authenticated
  using (public.user_can_access_entity('change_event', change_event_id::text));

comment on table public.change_event_documents is
  'Pattern C junction: links document_metadata records to change_events.';

-- Legacy attachments table -> document_metadata
insert into public.document_metadata (
  id,
  title,
  file_name,
  url,
  file_path,
  storage_bucket,
  source_system,
  source_item_id,
  phase,
  project_id,
  type,
  source,
  category,
  source_size,
  captured_at,
  created_at,
  date,
  source_metadata
)
select
  'att-' || a.id::text,
  a.file_name,
  a.file_name,
  a.url,
  case
    when a.url like '%/storage/v1/object/public/project-files/%'
      then split_part(a.url, '/project-files/', 2)
    else a.url
  end,
  'project-files',
  'manual_upload',
  a.id::text,
  'Current',
  a.project_id,
  'document',
  'manual_upload',
  'attachment',
  null::bigint,
  a.uploaded_at,
  a.uploaded_at::timestamp,
  a.uploaded_at,
  jsonb_build_object(
    'migrated_from', 'attachments_table',
    'legacy_table', a.attached_to_table,
    'legacy_attachment_id', a.id,
    'legacy_uploaded_by', a.uploaded_by,
    'migrated_at', now()
  )
from public.attachments a
where a.attached_to_table in ('commitments', 'prime_contracts')
on conflict (id) do nothing;

-- Commitment attachment links. commitments_unified is a view, so link to the
-- concrete subcontract or purchase order junction table.
insert into public.subcontract_documents (
  subcontract_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  s.id,
  'att-' || a.id::text,
  coalesce(a.uploaded_at, now()),
  a.uploaded_by
from public.attachments a
join public.subcontracts s on s.id::text = a.attached_to_id
where a.attached_to_table = 'commitments'
on conflict (subcontract_id, document_metadata_id) do nothing;

insert into public.purchase_order_documents (
  purchase_order_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  po.id,
  'att-' || a.id::text,
  coalesce(a.uploaded_at, now()),
  a.uploaded_by
from public.attachments a
join public.purchase_orders po on po.id::text = a.attached_to_id
where a.attached_to_table = 'commitments'
on conflict (purchase_order_id, document_metadata_id) do nothing;

insert into public.prime_contract_documents (
  prime_contract_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  pc.id,
  'att-' || a.id::text,
  coalesce(a.uploaded_at, now()),
  a.uploaded_by
from public.attachments a
join public.prime_contracts pc on pc.id::text = a.attached_to_id
where a.attached_to_table = 'prime_contracts'
on conflict (prime_contract_id, document_metadata_id) do nothing;

-- Change event attachments -> document_metadata + change_event_documents
insert into public.document_metadata (
  id,
  title,
  file_name,
  file_path,
  storage_bucket,
  source_system,
  source_item_id,
  phase,
  project_id,
  type,
  source,
  category,
  source_size,
  captured_at,
  created_at,
  date,
  source_metadata
)
select
  'cea-' || cea.id::text,
  cea.file_name,
  cea.file_name,
  cea.file_path,
  'project-files',
  'manual_upload',
  cea.id::text,
  'Current',
  ce.project_id,
  'document',
  'manual_upload',
  'attachment',
  cea.file_size,
  cea.uploaded_at,
  cea.uploaded_at::timestamp,
  cea.uploaded_at,
  jsonb_build_object(
    'migrated_from', 'change_event_attachments',
    'legacy_table', 'change_event_attachments',
    'legacy_attachment_id', cea.id,
    'mime_type', cea.mime_type,
    'legacy_uploaded_by', cea.uploaded_by,
    'migrated_at', now()
  )
from public.change_event_attachments cea
join public.change_events ce on ce.id = cea.change_event_id
on conflict (id) do nothing;

insert into public.change_event_documents (
  change_event_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  cea.change_event_id,
  'cea-' || cea.id::text,
  coalesce(cea.uploaded_at, now()),
  cea.uploaded_by
from public.change_event_attachments cea
on conflict (change_event_id, document_metadata_id) do nothing;

-- Submittal attachments -> document_metadata + submittal_doc_links
insert into public.document_metadata (
  id,
  title,
  file_name,
  url,
  file_path,
  storage_bucket,
  source_system,
  source_item_id,
  phase,
  project_id,
  type,
  source,
  category,
  source_size,
  captured_at,
  created_at,
  date,
  source_metadata
)
select
  'sa-' || sa.id::text,
  sa.file_name,
  sa.file_name,
  sa.file_url,
  case
    when sa.file_url like '%/storage/v1/object/public/project-files/%'
      then split_part(sa.file_url, '/project-files/', 2)
    else sa.file_url
  end,
  'project-files',
  'manual_upload',
  sa.id::text,
  'Current',
  s.project_id,
  'document',
  'manual_upload',
  'attachment',
  sa.file_size::bigint,
  sa.created_at,
  sa.created_at::timestamp,
  sa.created_at,
  jsonb_build_object(
    'migrated_from', 'submittal_attachments',
    'legacy_table', 'submittal_attachments',
    'legacy_attachment_id', sa.id,
    'mime_type', sa.content_type,
    'legacy_uploaded_by', sa.uploaded_by,
    'migrated_at', now()
  )
from public.submittal_attachments sa
join public.submittals s on s.id = sa.submittal_id
on conflict (id) do nothing;

insert into public.submittal_doc_links (
  submittal_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  sa.submittal_id,
  'sa-' || sa.id::text,
  coalesce(sa.created_at, now()),
  sa.uploaded_by
from public.submittal_attachments sa
on conflict (submittal_id, document_metadata_id) do nothing;

do $$
declare
  v_attachment_docs integer;
  v_change_event_docs integer;
  v_submittal_docs integer;
begin
  select count(*) into v_attachment_docs
  from public.document_metadata
  where source_metadata->>'migrated_from' = 'attachments_table';

  select count(*) into v_change_event_docs
  from public.document_metadata
  where source_metadata->>'migrated_from' = 'change_event_attachments';

  select count(*) into v_submittal_docs
  from public.document_metadata
  where source_metadata->>'migrated_from' = 'submittal_attachments';

  raise notice 'Pattern C reconciliation counts: attachments=%, change_events=%, submittals=%',
    v_attachment_docs, v_change_event_docs, v_submittal_docs;
end $$;
