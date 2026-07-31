-- Safe one-time repair: source-link and reconcile only normal editable,
-- unsynced invoices. Submitted/accounting history is intentionally untouched.

select set_config('alleato.invoice_sov_sync', 'on', true);

with invoice_lines as (
  select
    li.id,
    li.invoice_id,
    li.budget_code,
    li.description,
    count(*) over (partition by li.invoice_id) as line_count
  from public.subcontractor_invoice_line_items li
  join public.subcontractor_invoices i on i.id = li.invoice_id
  where public.is_editable_unsynced_subcontractor_invoice(i)
    and coalesce(li.line_item_type, 'SOV') not ilike '%change%'
),
commitment_sources as (
  select
    i.id as invoice_id,
    s.id as source_id,
    s.budget_code,
    s.description,
    count(*) over (partition by i.id) as source_count
  from public.subcontractor_invoices i
  join public.subcontract_sov_items s on s.subcontract_id = i.subcontract_id
  where public.is_editable_unsynced_subcontractor_invoice(i)
  union all
  select
    i.id,
    s.id,
    s.budget_code,
    s.description,
    count(*) over (partition by i.id)
  from public.subcontractor_invoices i
  join public.purchase_order_sov_items s
    on s.purchase_order_id = i.purchase_order_id
  where public.is_editable_unsynced_subcontractor_invoice(i)
),
candidate_matches as (
  select
    lines.id as line_id,
    lines.invoice_id,
    sources.source_id
  from invoice_lines lines
  join commitment_sources sources
    on sources.invoice_id = lines.invoice_id
   and (
     (
       lower(trim(coalesce(sources.budget_code, '')))
         = lower(trim(coalesce(lines.budget_code, '')))
       and lower(trim(coalesce(sources.description, '')))
         = lower(trim(coalesce(lines.description, '')))
     )
     or (
       lines.line_count = 1
       and sources.source_count = 1
     )
   )
),
unique_matches as (
  select line_id, source_id
  from (
    select
      candidate_matches.*,
      count(*) over (partition by line_id) as sources_for_line,
      count(*) over (
        partition by invoice_id, source_id
      ) as lines_for_source
    from candidate_matches
  ) counted
  where sources_for_line = 1
    and lines_for_source = 1
)
update public.subcontractor_invoice_line_items li
set source_sov_item_id = matches.source_id
from unique_matches matches
where li.id = matches.line_id
  and li.source_sov_item_id is null
  and li.source_change_order_id is null;

with invoice_lines as (
  select
    li.id,
    li.invoice_id,
    li.budget_code,
    li.scheduled_value
  from public.subcontractor_invoice_line_items li
  join public.subcontractor_invoices i on i.id = li.invoice_id
  where public.is_editable_unsynced_subcontractor_invoice(i)
    and li.line_item_type ilike '%change%'
),
change_sources as (
  select
    i.id as invoice_id,
    c.id as source_id,
    c.change_order_number,
    c.amount
  from public.subcontractor_invoices i
  join public.contract_change_orders c
    on c.contract_id = coalesce(i.subcontract_id, i.purchase_order_id)
   and lower(coalesce(c.status, '')) = 'approved'
  where public.is_editable_unsynced_subcontractor_invoice(i)
),
candidate_matches as (
  select
    lines.id as line_id,
    lines.invoice_id,
    sources.source_id
  from invoice_lines lines
  join change_sources sources
    on sources.invoice_id = lines.invoice_id
   and lower(trim(coalesce(sources.change_order_number, '')))
     = lower(trim(coalesce(lines.budget_code, '')))
   and coalesce(sources.amount, 0) = coalesce(lines.scheduled_value, 0)
),
unique_matches as (
  select line_id, source_id
  from (
    select
      candidate_matches.*,
      count(*) over (partition by line_id) as sources_for_line,
      count(*) over (
        partition by invoice_id, source_id
      ) as lines_for_source
    from candidate_matches
  ) counted
  where sources_for_line = 1
    and lines_for_source = 1
)
update public.subcontractor_invoice_line_items li
set source_change_order_id = matches.source_id
from unique_matches matches
where li.id = matches.line_id
  and li.source_sov_item_id is null
  and li.source_change_order_id is null;

insert into public.subcontractor_invoice_line_items (
  invoice_id,
  source_sov_item_id,
  description,
  budget_code,
  scheduled_value,
  commitment_value,
  change_value,
  line_item_type,
  sort_order
)
select
  i.id,
  sources.id,
  sources.description,
  sources.budget_code,
  coalesce(sources.amount, 0),
  coalesce(sources.amount, 0),
  0,
  'SOV',
  coalesce(sources.sort_order, sources.line_number, 0)
from public.subcontractor_invoices i
join lateral (
  select id, description, budget_code, amount, sort_order, line_number
  from public.subcontract_sov_items s
  where s.subcontract_id = i.subcontract_id
  union all
  select id, description, budget_code, amount, sort_order, line_number
  from public.purchase_order_sov_items s
  where s.purchase_order_id = i.purchase_order_id
) sources on true
where public.is_editable_unsynced_subcontractor_invoice(i)
on conflict (invoice_id, source_sov_item_id)
  where source_sov_item_id is not null
do nothing;

insert into public.subcontractor_invoice_line_items (
  invoice_id,
  source_change_order_id,
  description,
  budget_code,
  scheduled_value,
  commitment_value,
  change_value,
  line_item_type,
  sort_order
)
select
  i.id,
  c.id,
  coalesce(c.title, c.description),
  c.change_order_number,
  coalesce(c.amount, 0),
  0,
  coalesce(c.amount, 0),
  'Change Order',
  coalesce(
    (
      select max(li.sort_order) + 1
      from public.subcontractor_invoice_line_items li
      where li.invoice_id = i.id
    ),
    1
  )
from public.subcontractor_invoices i
join public.contract_change_orders c
  on c.contract_id = coalesce(i.subcontract_id, i.purchase_order_id)
 and lower(coalesce(c.status, '')) = 'approved'
where public.is_editable_unsynced_subcontractor_invoice(i)
on conflict (invoice_id, source_change_order_id)
  where source_change_order_id is not null
do nothing;

delete from public.subcontractor_invoice_line_items li
using public.subcontractor_invoices i
where li.invoice_id = i.id
  and public.is_editable_unsynced_subcontractor_invoice(i)
  and li.source_sov_item_id is null
  and li.source_change_order_id is null
  and coalesce(li.work_completed_previous, 0) = 0
  and coalesce(li.work_completed_period, 0) = 0
  and coalesce(li.materials_stored, 0) = 0
  and coalesce(li.previous_work_retainage, 0) = 0
  and coalesce(li.previous_materials_retainage, 0) = 0
  and coalesce(li.retainage_amount, 0) = 0
  and coalesce(li.materials_retainage_amount, 0) = 0
  and coalesce(li.work_retainage_released, 0) = 0
  and coalesce(li.materials_retainage_released, 0) = 0
  and coalesce(li.retainage_released, 0) = 0;

do $$
declare
  v_ambiguous_count integer;
begin
  select count(*)
  into v_ambiguous_count
  from public.subcontractor_invoice_line_items li
  join public.subcontractor_invoices i on i.id = li.invoice_id
  where public.is_editable_unsynced_subcontractor_invoice(i)
    and li.source_sov_item_id is null
    and li.source_change_order_id is null;

  if v_ambiguous_count > 0 then
    raise notice
      'Left % ambiguous editable invoice line(s) unchanged; submission guard will block review until corrected',
      v_ambiguous_count;
  end if;
end;
$$;
