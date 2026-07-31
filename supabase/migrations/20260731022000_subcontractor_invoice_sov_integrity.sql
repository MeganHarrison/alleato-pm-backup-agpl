-- Give every normal subcontractor-invoice schedule line a stable financial
-- source, keep editable unsynced invoices synchronized, and fail closed before
-- review when the invoice no longer matches its commitment.

alter table public.subcontractor_invoice_line_items
  add column if not exists source_sov_item_id uuid,
  add column if not exists source_change_order_id uuid
    references public.contract_change_orders(id) on delete restrict;

create unique index if not exists
  subcontractor_invoice_line_items_invoice_sov_source_uidx
on public.subcontractor_invoice_line_items(invoice_id, source_sov_item_id)
where source_sov_item_id is not null;

create unique index if not exists
  subcontractor_invoice_line_items_invoice_change_source_uidx
on public.subcontractor_invoice_line_items(invoice_id, source_change_order_id)
where source_change_order_id is not null;

create or replace function public.is_editable_unsynced_subcontractor_invoice(
  p_invoice public.subcontractor_invoices
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    p_invoice.status::text in (
      'draft',
      'not_invited',
      'invited',
      'revise_and_resubmit'
    )
    and p_invoice.acumatica_ref_nbr is null
    and p_invoice.acumatica_doc_type is null
    and p_invoice.acumatica_sync_at is null
    and p_invoice.acumatica_ap_bill_id is null
    and not coalesce(p_invoice.is_retainage_release, false);
$$;

revoke all on function public.is_editable_unsynced_subcontractor_invoice(
  public.subcontractor_invoices
) from public, anon, authenticated;

create or replace function public.subcontractor_invoice_billing_is_within_schedule(
  p_scheduled numeric,
  p_previous numeric,
  p_current numeric,
  p_materials numeric
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(p_scheduled, 0) >= 0 then
      coalesce(p_previous, 0) >= 0
      and coalesce(p_current, 0) >= 0
      and coalesce(p_materials, 0) >= 0
      and (
        coalesce(p_previous, 0)
        + coalesce(p_current, 0)
        + coalesce(p_materials, 0)
      ) <= coalesce(p_scheduled, 0)
    else
      coalesce(p_previous, 0) <= 0
      and coalesce(p_current, 0) <= 0
      and coalesce(p_materials, 0) <= 0
      and (
        coalesce(p_previous, 0)
        + coalesce(p_current, 0)
        + coalesce(p_materials, 0)
      ) >= coalesce(p_scheduled, 0)
  end;
$$;

revoke all on function public.subcontractor_invoice_billing_is_within_schedule(
  numeric,
  numeric,
  numeric,
  numeric
) from public, anon, authenticated;

create or replace function public.canonicalize_subcontractor_invoice_line_source()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subcontractor_invoices%rowtype;
  v_amount numeric;
  v_description text;
  v_budget_code text;
  v_sort_order integer;
begin
  select *
  into v_invoice
  from public.subcontractor_invoices
  where id = new.invoice_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Invoice line source cannot be resolved without its invoice';
  end if;

  if coalesce(v_invoice.is_retainage_release, false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(
      hashtextextended(
        coalesce(
          v_invoice.subcontract_id,
          v_invoice.purchase_order_id
        )::text,
        846276
      )
    );
  end if;

  if num_nonnulls(new.source_sov_item_id, new.source_change_order_id) <> 1 then
    raise exception using
      errcode = '23514',
      message = 'Normal invoice lines require exactly one commitment SOV or approved change-order source';
  end if;

  if new.source_sov_item_id is not null then
    if v_invoice.subcontract_id is not null then
      select
        s.amount,
        s.description,
        s.budget_code,
        coalesce(s.sort_order, s.line_number, 0)
      into
        v_amount,
        v_description,
        v_budget_code,
        v_sort_order
      from public.subcontract_sov_items s
      where s.id = new.source_sov_item_id
        and s.subcontract_id = v_invoice.subcontract_id;
    else
      select
        s.amount,
        s.description,
        s.budget_code,
        coalesce(s.sort_order, s.line_number, 0)
      into
        v_amount,
        v_description,
        v_budget_code,
        v_sort_order
      from public.purchase_order_sov_items s
      where s.id = new.source_sov_item_id
        and s.purchase_order_id = v_invoice.purchase_order_id;
    end if;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'Invoice SOV source does not belong to this commitment';
    end if;

    new.scheduled_value := coalesce(v_amount, 0);
    new.commitment_value := coalesce(v_amount, 0);
    new.change_value := 0;
    new.line_item_type := 'SOV';
    new.description := coalesce(v_description, new.description);
    new.budget_code := coalesce(v_budget_code, new.budget_code);
    new.sort_order := v_sort_order;
  else
    select
      c.amount,
      coalesce(c.title, c.description),
      c.change_order_number
    into
      v_amount,
      v_description,
      v_budget_code
    from public.contract_change_orders c
    where c.id = new.source_change_order_id
      and c.contract_id = coalesce(
        v_invoice.subcontract_id,
        v_invoice.purchase_order_id
      )
      and lower(coalesce(c.status, '')) = 'approved';

    if not found then
      raise exception using
        errcode = '23514',
        message = 'Invoice change source must be an approved change order on this commitment';
    end if;

    new.scheduled_value := coalesce(v_amount, 0);
    new.commitment_value := 0;
    new.change_value := coalesce(v_amount, 0);
    new.line_item_type := 'Change Order';
    new.description := coalesce(v_description, new.description);
    new.budget_code := coalesce(v_budget_code, new.budget_code);
  end if;

  if not public.subcontractor_invoice_billing_is_within_schedule(
    new.scheduled_value,
    new.work_completed_previous,
    new.work_completed_period,
    new.materials_stored
  ) then
    raise exception using
      errcode = '23514',
      message = 'Invoice billing must stay within its signed canonical scheduled value';
  end if;

  new.work_completed_pct := case
    when new.scheduled_value > 0 then
      (
        coalesce(new.work_completed_previous, 0)
        + coalesce(new.work_completed_period, 0)
        + coalesce(new.materials_stored, 0)
      ) / new.scheduled_value * 100
    else 0
  end;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.canonicalize_subcontractor_invoice_line_source()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_line_source_canonical
on public.subcontractor_invoice_line_items;
create trigger trg_subcontractor_invoice_line_source_canonical
before insert or update
on public.subcontractor_invoice_line_items
for each row
execute function public.canonicalize_subcontractor_invoice_line_source();

create or replace function public.subcontractor_invoice_schedule_is_valid(
  p_invoice_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with invoice as (
    select *
    from public.subcontractor_invoices
    where id = p_invoice_id
  ),
  expected as (
    select
      'sov'::text as source_type,
      s.id as source_id,
      coalesce(s.amount, 0)::numeric as scheduled_value,
      coalesce(s.amount, 0)::numeric as commitment_value,
      0::numeric as change_value
    from invoice i
    join public.subcontract_sov_items s
      on s.subcontract_id = i.subcontract_id
    union all
    select
      'sov',
      s.id,
      coalesce(s.amount, 0),
      coalesce(s.amount, 0),
      0::numeric
    from invoice i
    join public.purchase_order_sov_items s
      on s.purchase_order_id = i.purchase_order_id
    union all
    select
      'change',
      c.id,
      coalesce(c.amount, 0),
      0::numeric,
      coalesce(c.amount, 0)
    from invoice i
    join public.contract_change_orders c
      on c.contract_id = coalesce(i.subcontract_id, i.purchase_order_id)
     and lower(coalesce(c.status, '')) = 'approved'
  ),
  actual as (
    select
      case
        when li.source_sov_item_id is not null then 'sov'
        when li.source_change_order_id is not null then 'change'
        else 'missing'
      end as source_type,
      coalesce(li.source_sov_item_id, li.source_change_order_id) as source_id,
      count(*) as source_count,
      sum(li.scheduled_value)::numeric as scheduled_value,
      sum(coalesce(li.commitment_value, 0))::numeric as commitment_value,
      sum(coalesce(li.change_value, 0))::numeric as change_value,
      bool_and(
        public.subcontractor_invoice_billing_is_within_schedule(
          li.scheduled_value,
          li.work_completed_previous,
          li.work_completed_period,
          li.materials_stored
        )
      ) as billing_is_valid
    from public.subcontractor_invoice_line_items li
    where li.invoice_id = p_invoice_id
    group by 1, 2
  ),
  mismatch as (
    select 1
    from expected e
    full join actual a
      on a.source_type = e.source_type
     and a.source_id = e.source_id
    where e.source_id is null
       or a.source_id is null
       or a.source_count <> 1
       or a.scheduled_value is distinct from e.scheduled_value
       or a.commitment_value is distinct from e.commitment_value
       or a.change_value is distinct from e.change_value
       or not coalesce(a.billing_is_valid, false)
  )
  select case
    when not exists (select 1 from invoice) then false
    when coalesce(
      (select is_retainage_release from invoice),
      false
    ) then true
    else not exists (select 1 from mismatch)
  end;
$$;

revoke all on function public.subcontractor_invoice_schedule_is_valid(bigint)
from public, anon, authenticated;

create or replace function public.guard_subcontractor_invoice_schedule_submission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status
    and new.status::text = 'under_review'
    and not public.subcontractor_invoice_schedule_is_valid(new.id)
  then
    raise exception using
      errcode = '23514',
      message = 'Invoice schedule is out of sync with the commitment SOV or approved change orders';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_subcontractor_invoice_schedule_submission()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_schedule_submission_guard
on public.subcontractor_invoices;
create trigger trg_subcontractor_invoice_schedule_submission_guard
before update of status
on public.subcontractor_invoices
for each row
execute function public.guard_subcontractor_invoice_schedule_submission();

create or replace function public.guard_subcontractor_invoice_initial_status()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not coalesce((select auth.role()) = 'service_role', false)
    and new.status::text not in ('draft', 'not_invited', 'invited')
  then
    raise exception using
      errcode = '23514',
      message = 'New invoices must start in an editable intake status and use the guarded submission transition';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_subcontractor_invoice_initial_status()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_initial_status_guard
on public.subcontractor_invoices;
create trigger trg_subcontractor_invoice_initial_status_guard
before insert
on public.subcontractor_invoices
for each row
execute function public.guard_subcontractor_invoice_initial_status();

create or replace function public.guard_commitment_sov_invoice_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_commitment_id uuid;
  v_source_id uuid;
  v_next_amount numeric;
  v_invoice public.subcontractor_invoices%rowtype;
begin
  if tg_op = 'DELETE' then
    v_commitment_id := coalesce(
      (to_jsonb(old) ->> 'subcontract_id')::uuid,
      (to_jsonb(old) ->> 'purchase_order_id')::uuid
    );
  else
    v_commitment_id := coalesce(
      (to_jsonb(new) ->> 'subcontract_id')::uuid,
      (to_jsonb(new) ->> 'purchase_order_id')::uuid
    );
  end if;

  if tg_op = 'UPDATE' and coalesce(
    (to_jsonb(old) ->> 'subcontract_id')::uuid,
    (to_jsonb(old) ->> 'purchase_order_id')::uuid
  ) is distinct from v_commitment_id then
    raise exception using
      errcode = '23514',
      message = 'A commitment SOV source cannot be moved to another commitment';
  end if;
  v_source_id := case when tg_op = 'DELETE' then old.id else new.id end;
  v_next_amount := case when tg_op = 'DELETE' then 0 else coalesce(new.amount, 0) end;

  perform pg_advisory_xact_lock(
    hashtextextended(v_commitment_id::text, 846276)
  );

  for v_invoice in
    select i.*
    from public.subcontractor_invoices i
    where coalesce(i.subcontract_id, i.purchase_order_id) = v_commitment_id
      and not coalesce(i.is_retainage_release, false)
    order by i.id
    for update
  loop
    if not public.is_editable_unsynced_subcontractor_invoice(v_invoice) then
      raise exception using
        errcode = '23514',
        message = 'Commitment SOV is locked because an invoice has entered review or accounting';
    end if;
  end loop;

  if exists (
    select 1
    from public.subcontractor_invoice_line_items li
    join public.subcontractor_invoices i on i.id = li.invoice_id
    where li.source_sov_item_id = v_source_id
      and public.is_editable_unsynced_subcontractor_invoice(i)
      and (
        (
          tg_op = 'DELETE'
          and coalesce(li.total_completed_stored, 0) <> 0
        )
        or (
          tg_op <> 'DELETE'
          and v_next_amount >= 0
          and coalesce(li.total_completed_stored, 0) > v_next_amount
        )
        or (
          tg_op <> 'DELETE'
          and v_next_amount < 0
          and coalesce(li.total_completed_stored, 0) < v_next_amount
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Commitment SOV cannot be reduced below the amount already billed on an editable invoice';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.guard_commitment_sov_invoice_history()
from public, anon, authenticated;

create or replace function public.sync_editable_invoices_from_commitment_sov()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_commitment_id uuid;
begin
  perform set_config('alleato.invoice_sov_sync', 'on', true);
  if tg_op = 'DELETE' then
    v_commitment_id := coalesce(
      (to_jsonb(old) ->> 'subcontract_id')::uuid,
      (to_jsonb(old) ->> 'purchase_order_id')::uuid
    );
  else
    v_commitment_id := coalesce(
      (to_jsonb(new) ->> 'subcontract_id')::uuid,
      (to_jsonb(new) ->> 'purchase_order_id')::uuid
    );
  end if;

  if tg_op = 'DELETE' then
    delete from public.subcontractor_invoice_line_items li
    using public.subcontractor_invoices i
    where li.invoice_id = i.id
      and li.source_sov_item_id = old.id
      and public.is_editable_unsynced_subcontractor_invoice(i);
    return old;
  end if;

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
    new.id,
    new.description,
    new.budget_code,
    coalesce(new.amount, 0),
    coalesce(new.amount, 0),
    0,
    'SOV',
    coalesce(new.sort_order, new.line_number, 0)
  from public.subcontractor_invoices i
  where coalesce(i.subcontract_id, i.purchase_order_id) = v_commitment_id
    and public.is_editable_unsynced_subcontractor_invoice(i)
  on conflict (invoice_id, source_sov_item_id)
    where source_sov_item_id is not null
  do update set
    scheduled_value = excluded.scheduled_value,
    commitment_value = excluded.commitment_value,
    change_value = 0,
    description = excluded.description,
    budget_code = excluded.budget_code,
    line_item_type = 'SOV',
    sort_order = excluded.sort_order,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_editable_invoices_from_commitment_sov()
from public, anon, authenticated;

drop trigger if exists trg_subcontract_sov_invoice_history_guard
on public.subcontract_sov_items;
create trigger trg_subcontract_sov_invoice_history_guard
before insert or update or delete
on public.subcontract_sov_items
for each row execute function public.guard_commitment_sov_invoice_history();

drop trigger if exists trg_purchase_order_sov_invoice_history_guard
on public.purchase_order_sov_items;
create trigger trg_purchase_order_sov_invoice_history_guard
before insert or update or delete
on public.purchase_order_sov_items
for each row execute function public.guard_commitment_sov_invoice_history();

drop trigger if exists trg_subcontract_sov_sync_editable_invoices
on public.subcontract_sov_items;
create trigger trg_subcontract_sov_sync_editable_invoices
after insert or update or delete
on public.subcontract_sov_items
for each row execute function public.sync_editable_invoices_from_commitment_sov();

drop trigger if exists trg_purchase_order_sov_sync_editable_invoices
on public.purchase_order_sov_items;
create trigger trg_purchase_order_sov_sync_editable_invoices
after insert or update or delete
on public.purchase_order_sov_items
for each row execute function public.sync_editable_invoices_from_commitment_sov();

create or replace function public.guard_editable_invoice_change_source()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next_amount numeric := case
    when tg_op = 'DELETE' then 0
    when lower(coalesce(new.status, '')) = 'approved'
      then coalesce(new.amount, 0)
    else 0
  end;
  v_source_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  v_contract_id uuid := case when tg_op = 'DELETE' then old.contract_id else new.contract_id end;
  v_invoice public.subcontractor_invoices%rowtype;
begin
  if tg_op = 'UPDATE'
    and old.contract_id is distinct from new.contract_id
  then
    raise exception using
      errcode = '23514',
      message = 'A change-order source cannot be moved to another commitment';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_contract_id::text, 846276)
  );

  for v_invoice in
    select i.*
    from public.subcontractor_invoices i
    where coalesce(i.subcontract_id, i.purchase_order_id) = v_contract_id
      and not coalesce(i.is_retainage_release, false)
    order by i.id
    for update
  loop
    continue;
  end loop;

  if exists (
    select 1
    from public.subcontractor_invoice_line_items li
    join public.subcontractor_invoices i on i.id = li.invoice_id
    where li.source_change_order_id = v_source_id
      and public.is_editable_unsynced_subcontractor_invoice(i)
      and (
        (
          tg_op = 'DELETE'
          and coalesce(li.total_completed_stored, 0) <> 0
        )
        or (
          tg_op <> 'DELETE'
          and v_next_amount >= 0
          and coalesce(li.total_completed_stored, 0) > v_next_amount
        )
        or (
          tg_op <> 'DELETE'
          and v_next_amount < 0
          and coalesce(li.total_completed_stored, 0) < v_next_amount
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Approved change order cannot be reduced below the amount billed on an editable invoice';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.guard_editable_invoice_change_source()
from public, anon, authenticated;

create or replace function public.sync_editable_invoices_from_change_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  v_contract_id uuid := case
    when tg_op = 'DELETE' then old.contract_id else new.contract_id end;
begin
  perform set_config('alleato.invoice_sov_sync', 'on', true);

  if tg_op = 'DELETE' or lower(coalesce(new.status, '')) <> 'approved' then
    delete from public.subcontractor_invoice_line_items li
    using public.subcontractor_invoices i
    where li.invoice_id = i.id
      and li.source_change_order_id = v_source_id
      and public.is_editable_unsynced_subcontractor_invoice(i);
    return case when tg_op = 'DELETE' then old else new end;
  end if;

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
    new.id,
    coalesce(new.title, new.description),
    new.change_order_number,
    coalesce(new.amount, 0),
    0,
    coalesce(new.amount, 0),
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
  where coalesce(i.subcontract_id, i.purchase_order_id) = v_contract_id
    and public.is_editable_unsynced_subcontractor_invoice(i)
  on conflict (invoice_id, source_change_order_id)
    where source_change_order_id is not null
  do update set
    scheduled_value = excluded.scheduled_value,
    commitment_value = 0,
    change_value = excluded.change_value,
    description = excluded.description,
    budget_code = excluded.budget_code,
    line_item_type = 'Change Order',
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_editable_invoices_from_change_order()
from public, anon, authenticated;

drop trigger if exists trg_change_order_editable_invoice_guard
on public.contract_change_orders;
create trigger trg_change_order_editable_invoice_guard
before insert or update or delete
on public.contract_change_orders
for each row execute function public.guard_editable_invoice_change_source();

drop trigger if exists trg_change_order_sync_editable_invoices
on public.contract_change_orders;
create trigger trg_change_order_sync_editable_invoices
after insert or update or delete
on public.contract_change_orders
for each row execute function public.sync_editable_invoices_from_change_order();

-- Permit only the two private synchronization trigger functions to update
-- canonical source fields through the existing line-item mutation boundary.
create or replace function public.enforce_subcontractor_invoice_line_item_boundary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subcontractor_invoices%rowtype;
begin
  if coalesce((select auth.role()) = 'service_role', false)
    or current_setting('alleato.invoice_sov_sync', true) = 'on'
  then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE'
    and current_setting(
      'alleato.subcontractor_invoice_parent_delete',
      true
    ) = old.invoice_id::text
  then
    return old;
  end if;

  if tg_op = 'UPDATE'
    and coalesce(
      current_setting(
        'alleato.subcontractor_invoice_line_item_rpc',
        true
      ),
      ''
    ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'Invoice line items must be updated through the guarded RPC';
  end if;

  if tg_op = 'UPDATE'
    and (
      old.id is distinct from new.id
      or old.invoice_id is distinct from new.invoice_id
      or old.created_at is distinct from new.created_at
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Invoice line-item identity cannot be changed';
  end if;

  if tg_op = 'UPDATE'
    and (
      to_jsonb(old) - array[
        'work_completed_period',
        'materials_stored',
        'retainage_pct',
        'retainage_amount',
        'materials_retainage_pct',
        'materials_retainage_amount',
        'work_retainage_released',
        'materials_retainage_released',
        'work_completed_pct',
        'net_amount_this_period',
        'balance_to_finish',
        'total_completed_stored',
        'updated_at'
      ]::text[]
    ) is distinct from (
      to_jsonb(new) - array[
        'work_completed_period',
        'materials_stored',
        'retainage_pct',
        'retainage_amount',
        'materials_retainage_pct',
        'materials_retainage_amount',
        'work_retainage_released',
        'materials_retainage_released',
        'work_completed_pct',
        'net_amount_this_period',
        'balance_to_finish',
        'total_completed_stored',
        'updated_at'
      ]::text[]
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Invoice line-item source values are read-only';
  end if;

  select si.*
  into v_invoice
  from public.subcontractor_invoices si
  where si.id = case
    when tg_op = 'DELETE' then old.invoice_id
    else new.invoice_id
  end;

  if not found
    or v_invoice.status::text not in (
      'draft',
      'invited',
      'revise_and_resubmit'
    )
    or v_invoice.acumatica_ref_nbr is not null
    or v_invoice.acumatica_doc_type is not null
    or v_invoice.acumatica_sync_at is not null
    or v_invoice.acumatica_ap_bill_id is not null
  then
    raise exception using
      errcode = '23514',
      message = 'Invoice line items are locked in the current workflow state';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.enforce_subcontractor_invoice_line_item_boundary()
from public, anon, authenticated;

create or replace function public.update_subcontractor_invoice_line_item(
  p_project_id bigint,
  p_invoice_id bigint,
  p_line_item_id bigint,
  p_work_completed_period numeric,
  p_materials_stored numeric,
  p_retainage_pct numeric,
  p_materials_retainage_pct numeric,
  p_work_retainage_released numeric,
  p_materials_retainage_released numeric
)
returns public.subcontractor_invoice_line_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subcontractor_invoices%rowtype;
  v_line public.subcontractor_invoice_line_items%rowtype;
  v_work numeric;
  v_materials numeric;
  v_work_pct numeric;
  v_materials_pct numeric;
  v_work_released numeric;
  v_materials_released numeric;
  v_work_retainage numeric;
  v_materials_retainage numeric;
  v_total_completed numeric;
begin
  if not public.current_can_access_subcontractor_invoice(
    p_invoice_id,
    true
  ) then
    raise exception using
      errcode = '42501',
      message = 'Invoice line-item update is not permitted';
  end if;

  select si.*
  into v_invoice
  from public.subcontractor_invoices si
  where si.id = p_invoice_id
    and si.project_id = p_project_id
  for update;

  if not found
    or v_invoice.status::text not in (
      'draft',
      'invited',
      'revise_and_resubmit'
    )
    or v_invoice.acumatica_ref_nbr is not null
    or v_invoice.acumatica_doc_type is not null
    or v_invoice.acumatica_sync_at is not null
    or v_invoice.acumatica_ap_bill_id is not null
  then
    raise exception using
      errcode = '23514',
      message = 'Invoice line items are locked in the current workflow state';
  end if;

  select li.*
  into v_line
  from public.subcontractor_invoice_line_items li
  where li.id = p_line_item_id
    and li.invoice_id = p_invoice_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Invoice line item was not found';
  end if;

  v_work := coalesce(
    p_work_completed_period,
    v_line.work_completed_period,
    0
  );
  v_materials := coalesce(
    p_materials_stored,
    v_line.materials_stored,
    0
  );
  v_work_pct := coalesce(p_retainage_pct, v_line.retainage_pct, 0);
  v_materials_pct := coalesce(
    p_materials_retainage_pct,
    v_line.materials_retainage_pct,
    0
  );
  v_work_released := greatest(
    coalesce(
      p_work_retainage_released,
      v_line.work_retainage_released,
      0
    ),
    0
  );
  v_materials_released := greatest(
    coalesce(
      p_materials_retainage_released,
      v_line.materials_retainage_released,
      0
    ),
    0
  );

  if v_work_pct < 0 or v_work_pct > 100
    or v_materials_pct < 0 or v_materials_pct > 100
  then
    raise exception using
      errcode = '22003',
      message = 'Retainage percentages must be between 0 and 100';
  end if;

  if not public.subcontractor_invoice_billing_is_within_schedule(
    v_line.scheduled_value,
    v_line.work_completed_previous,
    v_work,
    v_materials
  ) then
    raise exception using
      errcode = '23514',
      message = 'Invoice billing must stay within its signed scheduled value';
  end if;

  v_work_retainage := v_work * v_work_pct / 100;
  v_materials_retainage := v_materials * v_materials_pct / 100;

  if v_work_released
    > greatest(
      coalesce(v_line.previous_work_retainage, 0)
        + v_work_retainage,
      0
    )
    or v_materials_released
      > greatest(
        coalesce(v_line.previous_materials_retainage, 0)
          + v_materials_retainage,
        0
      )
  then
    raise exception using
      errcode = '23514',
      message = 'Retainage release exceeds the amount withheld';
  end if;

  v_total_completed :=
    coalesce(v_line.work_completed_previous, 0)
    + v_work
    + v_materials;

  perform set_config(
    'alleato.subcontractor_invoice_line_item_rpc',
    'on',
    true
  );

  update public.subcontractor_invoice_line_items
  set
    work_completed_period = v_work,
    materials_stored = v_materials,
    retainage_pct = v_work_pct,
    retainage_amount = v_work_retainage,
    materials_retainage_pct = v_materials_pct,
    materials_retainage_amount = v_materials_retainage,
    work_retainage_released = v_work_released,
    materials_retainage_released = v_materials_released,
    work_completed_pct = case
      when coalesce(v_line.scheduled_value, 0) <> 0
        then v_total_completed / v_line.scheduled_value * 100
      else 0
    end,
    updated_at = now()
  where id = p_line_item_id
    and invoice_id = p_invoice_id
  returning * into v_line;

  return v_line;
end;
$$;
