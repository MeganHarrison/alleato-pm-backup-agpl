-- Migration: Create remaining Pattern C attachment junctions
-- Purpose: Finish the entity attachment model needed to retire legacy
--          cco_attachments, pcco_attachments, prime_contract_pco_attachments,
--          and invoice_attachments writers.

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

    when 'commitment_change_order' then
      select coalesce(cco.project_id, cu.project_id) into v_project_id
      from public.contract_change_orders cco
      left join public.commitments_unified cu on cu.id = cco.contract_id
      where cco.id = entity_id::uuid;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'prime_contract_change_order' then
      select pcco.project_id::integer into v_project_id
      from public.prime_contract_change_orders pcco
      where pcco.id = entity_id::bigint;
      has_access := v_project_id is not null
        and public.current_is_project_member(v_project_id);

    when 'prime_contract_pco' then
      select pco.project_id into v_project_id
      from public.prime_contract_pcos pco
      where pco.id = entity_id::uuid;
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

create table if not exists public.commitment_change_order_documents (
  commitment_change_order_id uuid        not null references public.contract_change_orders(id) on delete cascade,
  document_metadata_id       text        not null references public.document_metadata(id) on delete cascade,
  document_type              text        references public.document_type_taxonomy(type_key),
  attached_at                timestamptz not null default now(),
  attached_by                uuid        references auth.users(id),
  primary key (commitment_change_order_id, document_metadata_id)
);

create index if not exists idx_commitment_change_order_documents_doc
  on public.commitment_change_order_documents (document_metadata_id);

alter table public.commitment_change_order_documents enable row level security;

drop policy if exists "commitment_change_order_documents_select" on public.commitment_change_order_documents;
create policy "commitment_change_order_documents_select" on public.commitment_change_order_documents
  for select to authenticated
  using (public.user_can_access_entity('commitment_change_order', commitment_change_order_id::text));

drop policy if exists "commitment_change_order_documents_insert" on public.commitment_change_order_documents;
create policy "commitment_change_order_documents_insert" on public.commitment_change_order_documents
  for insert to authenticated
  with check (public.user_can_access_entity('commitment_change_order', commitment_change_order_id::text));

drop policy if exists "commitment_change_order_documents_update" on public.commitment_change_order_documents;
create policy "commitment_change_order_documents_update" on public.commitment_change_order_documents
  for update to authenticated
  using (public.user_can_access_entity('commitment_change_order', commitment_change_order_id::text))
  with check (public.user_can_access_entity('commitment_change_order', commitment_change_order_id::text));

drop policy if exists "commitment_change_order_documents_delete" on public.commitment_change_order_documents;
create policy "commitment_change_order_documents_delete" on public.commitment_change_order_documents
  for delete to authenticated
  using (public.user_can_access_entity('commitment_change_order', commitment_change_order_id::text));

comment on table public.commitment_change_order_documents is
  'Pattern C junction: links document_metadata records to commitment change orders.';

create table if not exists public.prime_contract_change_order_documents (
  prime_contract_change_order_id bigint      not null references public.prime_contract_change_orders(id) on delete cascade,
  document_metadata_id           text        not null references public.document_metadata(id) on delete cascade,
  document_type                  text        references public.document_type_taxonomy(type_key),
  attached_at                    timestamptz not null default now(),
  attached_by                    uuid        references auth.users(id),
  primary key (prime_contract_change_order_id, document_metadata_id)
);

create index if not exists idx_prime_contract_change_order_documents_doc
  on public.prime_contract_change_order_documents (document_metadata_id);

alter table public.prime_contract_change_order_documents enable row level security;

drop policy if exists "prime_contract_change_order_documents_select" on public.prime_contract_change_order_documents;
create policy "prime_contract_change_order_documents_select" on public.prime_contract_change_order_documents
  for select to authenticated
  using (public.user_can_access_entity('prime_contract_change_order', prime_contract_change_order_id::text));

drop policy if exists "prime_contract_change_order_documents_insert" on public.prime_contract_change_order_documents;
create policy "prime_contract_change_order_documents_insert" on public.prime_contract_change_order_documents
  for insert to authenticated
  with check (public.user_can_access_entity('prime_contract_change_order', prime_contract_change_order_id::text));

drop policy if exists "prime_contract_change_order_documents_update" on public.prime_contract_change_order_documents;
create policy "prime_contract_change_order_documents_update" on public.prime_contract_change_order_documents
  for update to authenticated
  using (public.user_can_access_entity('prime_contract_change_order', prime_contract_change_order_id::text))
  with check (public.user_can_access_entity('prime_contract_change_order', prime_contract_change_order_id::text));

drop policy if exists "prime_contract_change_order_documents_delete" on public.prime_contract_change_order_documents;
create policy "prime_contract_change_order_documents_delete" on public.prime_contract_change_order_documents
  for delete to authenticated
  using (public.user_can_access_entity('prime_contract_change_order', prime_contract_change_order_id::text));

comment on table public.prime_contract_change_order_documents is
  'Pattern C junction: links document_metadata records to prime contract change orders.';

create table if not exists public.prime_contract_pco_documents (
  pco_id               uuid        not null references public.prime_contract_pcos(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  document_type        text        references public.document_type_taxonomy(type_key),
  attached_at          timestamptz not null default now(),
  attached_by          uuid        references auth.users(id),
  primary key (pco_id, document_metadata_id)
);

create index if not exists idx_prime_contract_pco_documents_doc
  on public.prime_contract_pco_documents (document_metadata_id);

alter table public.prime_contract_pco_documents enable row level security;

drop policy if exists "prime_contract_pco_documents_select" on public.prime_contract_pco_documents;
create policy "prime_contract_pco_documents_select" on public.prime_contract_pco_documents
  for select to authenticated
  using (public.user_can_access_entity('prime_contract_pco', pco_id::text));

drop policy if exists "prime_contract_pco_documents_insert" on public.prime_contract_pco_documents;
create policy "prime_contract_pco_documents_insert" on public.prime_contract_pco_documents
  for insert to authenticated
  with check (public.user_can_access_entity('prime_contract_pco', pco_id::text));

drop policy if exists "prime_contract_pco_documents_update" on public.prime_contract_pco_documents;
create policy "prime_contract_pco_documents_update" on public.prime_contract_pco_documents
  for update to authenticated
  using (public.user_can_access_entity('prime_contract_pco', pco_id::text))
  with check (public.user_can_access_entity('prime_contract_pco', pco_id::text));

drop policy if exists "prime_contract_pco_documents_delete" on public.prime_contract_pco_documents;
create policy "prime_contract_pco_documents_delete" on public.prime_contract_pco_documents
  for delete to authenticated
  using (public.user_can_access_entity('prime_contract_pco', pco_id::text));

comment on table public.prime_contract_pco_documents is
  'Pattern C junction: links document_metadata records to prime contract PCOs.';

create table if not exists public.subcontractor_invoice_documents (
  subcontractor_invoice_id bigint      not null references public.subcontractor_invoices(id) on delete cascade,
  document_metadata_id     text        not null references public.document_metadata(id) on delete cascade,
  document_type            text        references public.document_type_taxonomy(type_key),
  attached_at              timestamptz not null default now(),
  attached_by              uuid        references auth.users(id),
  primary key (subcontractor_invoice_id, document_metadata_id)
);

create index if not exists idx_subcontractor_invoice_documents_doc
  on public.subcontractor_invoice_documents (document_metadata_id);

alter table public.subcontractor_invoice_documents enable row level security;

drop policy if exists "subcontractor_invoice_documents_select" on public.subcontractor_invoice_documents;
create policy "subcontractor_invoice_documents_select" on public.subcontractor_invoice_documents
  for select to authenticated
  using (public.user_can_access_entity('subcontractor_invoice', subcontractor_invoice_id::text));

drop policy if exists "subcontractor_invoice_documents_insert" on public.subcontractor_invoice_documents;
create policy "subcontractor_invoice_documents_insert" on public.subcontractor_invoice_documents
  for insert to authenticated
  with check (public.user_can_access_entity('subcontractor_invoice', subcontractor_invoice_id::text));

drop policy if exists "subcontractor_invoice_documents_update" on public.subcontractor_invoice_documents;
create policy "subcontractor_invoice_documents_update" on public.subcontractor_invoice_documents
  for update to authenticated
  using (public.user_can_access_entity('subcontractor_invoice', subcontractor_invoice_id::text))
  with check (public.user_can_access_entity('subcontractor_invoice', subcontractor_invoice_id::text));

drop policy if exists "subcontractor_invoice_documents_delete" on public.subcontractor_invoice_documents;
create policy "subcontractor_invoice_documents_delete" on public.subcontractor_invoice_documents
  for delete to authenticated
  using (public.user_can_access_entity('subcontractor_invoice', subcontractor_invoice_id::text));

comment on table public.subcontractor_invoice_documents is
  'Pattern C junction: links document_metadata records to subcontractor invoices.';

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
  'cco-att-' || a.id::text,
  a.file_name,
  a.file_name,
  a.file_path,
  'project-files',
  'manual_upload',
  a.id::text,
  'Current',
  coalesce(cco.project_id, cu.project_id),
  'document',
  'manual_upload',
  'attachment',
  a.file_size,
  a.uploaded_at,
  a.uploaded_at::timestamp,
  a.uploaded_at,
  jsonb_build_object(
    'migrated_from', 'legacy_attachment_table',
    'legacy_table', 'cco_attachments',
    'legacy_attachment_id', a.id,
    'legacy_uploaded_by', a.uploaded_by,
    'migrated_at', now()
  )
from public.cco_attachments a
join public.contract_change_orders cco on cco.id = a.cco_id
left join public.commitments_unified cu on cu.id = cco.contract_id
on conflict (id) do nothing;

insert into public.commitment_change_order_documents (
  commitment_change_order_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  a.cco_id,
  'cco-att-' || a.id::text,
  coalesce(a.uploaded_at, now()),
  a.uploaded_by
from public.cco_attachments a
on conflict (commitment_change_order_id, document_metadata_id) do nothing;

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
  'pcco-att-' || a.id::text,
  a.file_name,
  a.file_name,
  a.file_path,
  'project-files',
  'manual_upload',
  a.id::text,
  'Current',
  pcco.project_id::integer,
  'document',
  'manual_upload',
  'attachment',
  a.file_size,
  a.uploaded_at,
  a.uploaded_at::timestamp,
  a.uploaded_at,
  jsonb_build_object(
    'migrated_from', 'legacy_attachment_table',
    'legacy_table', 'pcco_attachments',
    'legacy_attachment_id', a.id,
    'legacy_uploaded_by', a.uploaded_by,
    'migrated_at', now()
  )
from public.pcco_attachments a
join public.prime_contract_change_orders pcco on pcco.id = a.pcco_id
on conflict (id) do nothing;

insert into public.prime_contract_change_order_documents (
  prime_contract_change_order_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  a.pcco_id,
  'pcco-att-' || a.id::text,
  coalesce(a.uploaded_at, now()),
  a.uploaded_by
from public.pcco_attachments a
on conflict (prime_contract_change_order_id, document_metadata_id) do nothing;

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
  'pcpco-att-' || a.id::text,
  a.file_name,
  a.file_name,
  a.file_path,
  'project-files',
  'manual_upload',
  a.id::text,
  'Current',
  pco.project_id,
  'document',
  'manual_upload',
  'attachment',
  a.file_size,
  a.uploaded_at,
  a.uploaded_at::timestamp,
  a.uploaded_at,
  jsonb_build_object(
    'migrated_from', 'legacy_attachment_table',
    'legacy_table', 'prime_contract_pco_attachments',
    'legacy_attachment_id', a.id,
    'legacy_uploaded_by', a.uploaded_by,
    'migrated_at', now()
  )
from public.prime_contract_pco_attachments a
join public.prime_contract_pcos pco on pco.id = a.pco_id
on conflict (id) do nothing;

insert into public.prime_contract_pco_documents (
  pco_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  a.pco_id,
  'pcpco-att-' || a.id::text,
  coalesce(a.uploaded_at, now()),
  a.uploaded_by
from public.prime_contract_pco_attachments a
on conflict (pco_id, document_metadata_id) do nothing;

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
  'inv-att-' || a.id::text,
  a.file_name,
  a.file_name,
  a.file_path,
  'project-files',
  'manual_upload',
  a.id::text,
  'Current',
  coalesce(pc.project_id::integer, si.project_id),
  'document',
  'manual_upload',
  'attachment',
  a.file_size,
  a.created_at,
  a.created_at::timestamp,
  a.created_at,
  jsonb_build_object(
    'migrated_from', 'legacy_attachment_table',
    'legacy_table', 'invoice_attachments',
    'legacy_attachment_id', a.id,
    'legacy_uploaded_by', a.uploaded_by,
    'migrated_at', now()
  )
from public.invoice_attachments a
left join public.owner_invoices oi on oi.id = a.owner_invoice_id
left join public.prime_contracts pc on pc.id = oi.prime_contract_id
left join public.subcontractor_invoices si on si.id = a.subcontractor_invoice_id
where a.owner_invoice_id is not null
   or a.subcontractor_invoice_id is not null
on conflict (id) do nothing;

insert into public.owner_invoice_documents (
  owner_invoice_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  a.owner_invoice_id,
  'inv-att-' || a.id::text,
  coalesce(a.created_at, now()),
  a.uploaded_by
from public.invoice_attachments a
where a.owner_invoice_id is not null
on conflict (owner_invoice_id, document_metadata_id) do nothing;

insert into public.subcontractor_invoice_documents (
  subcontractor_invoice_id,
  document_metadata_id,
  attached_at,
  attached_by
)
select
  a.subcontractor_invoice_id,
  'inv-att-' || a.id::text,
  coalesce(a.created_at, now()),
  a.uploaded_by
from public.invoice_attachments a
where a.subcontractor_invoice_id is not null
on conflict (subcontractor_invoice_id, document_metadata_id) do nothing;

do $$
declare
  cco_count integer;
  pcco_count integer;
  pco_count integer;
  invoice_count integer;
begin
  select count(*) into cco_count from public.commitment_change_order_documents;
  select count(*) into pcco_count from public.prime_contract_change_order_documents;
  select count(*) into pco_count from public.prime_contract_pco_documents;
  select count(*) into invoice_count from public.owner_invoice_documents;

  raise notice 'Pattern C remaining attachment reconciliation counts: commitment_change_orders=%, prime_contract_change_orders=%, prime_contract_pcos=%, owner_invoices=%',
    cco_count,
    pcco_count,
    pco_count,
    invoice_count;
end $$;
