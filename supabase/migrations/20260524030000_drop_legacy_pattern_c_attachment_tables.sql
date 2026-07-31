-- Pattern C attachment consolidation closeout.
--
-- This migration preserves orphaned generic attachment rows as project-level
-- Pattern C documents, moves legacy attachment-count views onto Pattern C
-- junctions, asserts all entity-scoped legacy rows are reconciled, then drops
-- the retired per-entity attachment tables.

-- Preserve generic attachment rows that never had an entity target. These rows
-- cannot have an entity junction, so attach them at the project document level.
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
  a.uploaded_at,
  a.uploaded_at::timestamp,
  a.uploaded_at,
  jsonb_build_object(
    'migrated_from', 'attachments_orphan',
    'legacy_table', 'attachments',
    'legacy_attachment_id', a.id,
    'legacy_attached_to_table', a.attached_to_table,
    'legacy_attached_to_id', a.attached_to_id,
    'legacy_uploaded_by', a.uploaded_by,
    'migrated_at', now()
  )
from public.attachments a
where (a.attached_to_table is null or a.attached_to_id is null)
  and a.project_id is not null
on conflict (id) do nothing;

insert into public.project_documents_v2 (
  project_id,
  document_metadata_id,
  document_type,
  attached_at,
  attached_by
)
select
  a.project_id::integer,
  'att-' || a.id::text,
  null,
  coalesce(a.uploaded_at, now()),
  a.uploaded_by
from public.attachments a
join public.projects p on p.id = a.project_id::integer
where (a.attached_to_table is null or a.attached_to_id is null)
  and a.project_id is not null
on conflict (project_id, document_metadata_id) do nothing;

-- Move legacy attachment-count views to Pattern C junctions before dropping
-- retired tables. Keep column names and types stable.
drop materialized view if exists public.change_events_summary;

create materialized view public.change_events_summary as
select
  ce.id,
  ce.project_id,
  ce.number,
  ce.title,
  ce.type,
  ce.status,
  ce.origin,
  ce.expecting_revenue,
  coalesce(sum(cel.revenue_rom), 0::numeric) as total_revenue_rom,
  coalesce(sum(cel.cost_rom), 0::numeric) as total_cost_rom,
  coalesce(sum(cel.non_committed_cost), 0::numeric) as total_non_committed_cost,
  count(distinct cel.id) as line_item_count,
  count(distinct ced.document_metadata_id) as attachment_count,
  count(distinct cer.id) as rfq_count,
  coalesce(sum(cer.estimated_total_amount), 0::numeric) as total_rfq_amount,
  ce.created_at,
  ce.created_by
from public.change_events ce
left join public.change_event_line_items cel on ce.id = cel.change_event_id
left join public.change_event_documents ced on ce.id = ced.change_event_id
left join public.change_event_rfqs cer on ce.id = cer.change_event_id
where ce.deleted_at is null
group by ce.id;

create index if not exists idx_change_events_summary_project
  on public.change_events_summary using btree (project_id);

create index if not exists idx_change_events_summary_status
  on public.change_events_summary using btree (status);

create or replace view public.subcontracts_with_totals as
select
  s.id,
  s.contract_number,
  s.contract_company_id,
  s.title,
  s.status,
  s.executed,
  s.default_retainage_percent,
  s.description,
  s.inclusions,
  s.exclusions,
  s.start_date,
  s.estimated_completion_date,
  s.actual_completion_date,
  s.contract_date,
  s.signed_contract_received_date,
  s.issued_on_date,
  s.is_private,
  s.non_admin_user_ids,
  s.allow_non_admin_view_sov_items,
  s.invoice_contact_ids,
  s.project_id,
  s.created_by,
  s.created_at,
  s.updated_at,
  coalesce(sov_totals.total_amount, 0::numeric) as total_sov_amount,
  coalesce(sov_totals.total_billed, 0::numeric) as total_billed_to_date,
  coalesce(sov_totals.total_amount, 0::numeric) - coalesce(sov_totals.total_billed, 0::numeric) as total_amount_remaining,
  coalesce(sov_totals.line_item_count, 0::bigint) as sov_line_count,
  coalesce(att_count.count, 0::bigint) as attachment_count,
  c.name as company_name,
  c.type as company_type
from public.subcontracts s
left join (
  select
    subcontract_sov_items.subcontract_id,
    sum(subcontract_sov_items.amount) as total_amount,
    sum(subcontract_sov_items.billed_to_date) as total_billed,
    count(*) as line_item_count
  from public.subcontract_sov_items
  group by subcontract_sov_items.subcontract_id
) sov_totals on s.id = sov_totals.subcontract_id
left join (
  select
    subcontract_documents.subcontract_id,
    count(*) as count
  from public.subcontract_documents
  group by subcontract_documents.subcontract_id
) att_count on s.id = att_count.subcontract_id
left join public.companies c on s.contract_company_id = c.id;

do $$
declare
  unreconciled_count integer;
begin
  with legacy_attachments as (
    select
      a.id,
      a.attached_to_table,
      a.attached_to_id,
      case
        when a.attached_to_table = 'commitments' and s.id is not null then exists (
          select 1
          from public.document_metadata dm
          join public.subcontract_documents sd on sd.document_metadata_id = dm.id
          where dm.id = 'att-' || a.id::text
            and sd.subcontract_id = s.id
        )
        when a.attached_to_table = 'commitments' and po.id is not null then exists (
          select 1
          from public.document_metadata dm
          join public.purchase_order_documents pod on pod.document_metadata_id = dm.id
          where dm.id = 'att-' || a.id::text
            and pod.purchase_order_id = po.id
        )
        when a.attached_to_table = 'prime_contracts' then exists (
          select 1
          from public.document_metadata dm
          join public.prime_contract_documents pcd on pcd.document_metadata_id = dm.id
          where dm.id = 'att-' || a.id::text
            and pcd.prime_contract_id::text = a.attached_to_id
        )
        when a.attached_to_table is null or a.attached_to_id is null then exists (
          select 1
          from public.document_metadata dm
          join public.project_documents_v2 pd on pd.document_metadata_id = dm.id
          where dm.id = 'att-' || a.id::text
            and pd.project_id = a.project_id::integer
        )
        else false
      end as reconciled
    from public.attachments a
    left join public.subcontracts s on s.id::text = a.attached_to_id and a.attached_to_table = 'commitments'
    left join public.purchase_orders po on po.id::text = a.attached_to_id and a.attached_to_table = 'commitments'
  )
  select count(*) into unreconciled_count
  from legacy_attachments
  where not reconciled;

  if unreconciled_count > 0 then
    raise exception 'Cannot drop public.attachments: % legacy rows are not reconciled into Pattern C.', unreconciled_count;
  end if;

  select count(*) into unreconciled_count
  from public.change_event_attachments cea
  where not exists (
    select 1
    from public.document_metadata dm
    join public.change_event_documents ced on ced.document_metadata_id = dm.id
    where dm.id = 'cea-' || cea.id::text
      and ced.change_event_id = cea.change_event_id
  );

  if unreconciled_count > 0 then
    raise exception 'Cannot drop public.change_event_attachments: % legacy rows are not reconciled into Pattern C.', unreconciled_count;
  end if;

  select count(*) into unreconciled_count
  from public.submittal_attachments sa
  where not exists (
    select 1
    from public.document_metadata dm
    join public.submittal_doc_links sdl on sdl.document_metadata_id = dm.id
    where dm.id = 'sa-' || sa.id::text
      and sdl.submittal_id = sa.submittal_id
  );

  if unreconciled_count > 0 then
    raise exception 'Cannot drop public.submittal_attachments: % legacy rows are not reconciled into Pattern C.', unreconciled_count;
  end if;

  select count(*) into unreconciled_count
  from public.cco_attachments a
  where not exists (
    select 1
    from public.commitment_change_order_documents d
    where d.commitment_change_order_id = a.cco_id
      and d.document_metadata_id = 'cco-att-' || a.id::text
  );

  if unreconciled_count > 0 then
    raise exception 'Cannot drop public.cco_attachments: % legacy rows are not reconciled into Pattern C.', unreconciled_count;
  end if;

  select count(*) into unreconciled_count
  from public.pcco_attachments a
  where not exists (
    select 1
    from public.prime_contract_change_order_documents d
    where d.prime_contract_change_order_id = a.pcco_id
      and d.document_metadata_id = 'pcco-att-' || a.id::text
  );

  if unreconciled_count > 0 then
    raise exception 'Cannot drop public.pcco_attachments: % legacy rows are not reconciled into Pattern C.', unreconciled_count;
  end if;

  select count(*) into unreconciled_count
  from public.prime_contract_pco_attachments a
  where not exists (
    select 1
    from public.prime_contract_pco_documents d
    where d.pco_id = a.pco_id
      and d.document_metadata_id = 'pcpco-att-' || a.id::text
  );

  if unreconciled_count > 0 then
    raise exception 'Cannot drop public.prime_contract_pco_attachments: % legacy rows are not reconciled into Pattern C.', unreconciled_count;
  end if;

  select count(*) into unreconciled_count
  from public.invoice_attachments a
  where not (
    (
      a.owner_invoice_id is not null
      and exists (
        select 1
        from public.owner_invoice_documents d
        where d.owner_invoice_id = a.owner_invoice_id
          and d.document_metadata_id = 'inv-att-' || a.id::text
      )
    )
    or (
      a.subcontractor_invoice_id is not null
      and exists (
        select 1
        from public.subcontractor_invoice_documents d
        where d.subcontractor_invoice_id = a.subcontractor_invoice_id
          and d.document_metadata_id = 'inv-att-' || a.id::text
      )
    )
  );

  if unreconciled_count > 0 then
    raise exception 'Cannot drop public.invoice_attachments: % legacy rows are not reconciled into Pattern C.', unreconciled_count;
  end if;
end $$;

drop table if exists public.cco_attachments restrict;
drop table if exists public.pcco_attachments restrict;
drop table if exists public.prime_contract_pco_attachments restrict;
drop table if exists public.invoice_attachments restrict;
drop table if exists public.change_event_attachments restrict;
drop table if exists public.submittal_attachments restrict;
drop table if exists public.subcontract_attachments restrict;
drop table if exists public.purchase_order_attachments restrict;
drop table if exists public.attachments restrict;
