-- Close the remaining invoice-source integrity gaps:
--   * preserve signed completion percentages for deductive change orders,
--   * reconcile sources whenever an unsynced invoice is reopened for editing,
--   * reject direct authenticated line deletion so it cannot race submission.

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

  if tg_op = 'INSERT'
    and current_setting('alleato.invoice_sov_sync', true) is distinct from 'on'
  then
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
    when new.scheduled_value <> 0 then
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

create or replace function public.reconcile_subcontractor_invoice_sources(
  p_invoice_id bigint
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subcontractor_invoices%rowtype;
begin
  select *
  into v_invoice
  from public.subcontractor_invoices
  where id = p_invoice_id;

  if not found
    or coalesce(v_invoice.is_retainage_release, false)
    or v_invoice.acumatica_ref_nbr is not null
    or v_invoice.acumatica_doc_type is not null
    or v_invoice.acumatica_sync_at is not null
    or v_invoice.acumatica_ap_bill_id is not null
  then
    return;
  end if;

  perform set_config('alleato.invoice_sov_sync', 'on', true);

  if v_invoice.subcontract_id is not null then
    delete from public.subcontractor_invoice_line_items li
    where li.invoice_id = p_invoice_id
      and li.source_sov_item_id is not null
      and not exists (
        select 1
        from public.subcontract_sov_items s
        where s.id = li.source_sov_item_id
          and s.subcontract_id = v_invoice.subcontract_id
      );

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
      p_invoice_id,
      s.id,
      s.description,
      s.budget_code,
      coalesce(s.amount, 0),
      coalesce(s.amount, 0),
      0,
      'SOV',
      coalesce(s.sort_order, s.line_number, 0)
    from public.subcontract_sov_items s
    where s.subcontract_id = v_invoice.subcontract_id
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
  else
    delete from public.subcontractor_invoice_line_items li
    where li.invoice_id = p_invoice_id
      and li.source_sov_item_id is not null
      and not exists (
        select 1
        from public.purchase_order_sov_items s
        where s.id = li.source_sov_item_id
          and s.purchase_order_id = v_invoice.purchase_order_id
      );

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
      p_invoice_id,
      s.id,
      s.description,
      s.budget_code,
      coalesce(s.amount, 0),
      coalesce(s.amount, 0),
      0,
      'SOV',
      coalesce(s.sort_order, s.line_number, 0)
    from public.purchase_order_sov_items s
    where s.purchase_order_id = v_invoice.purchase_order_id
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
  end if;

  delete from public.subcontractor_invoice_line_items li
  where li.invoice_id = p_invoice_id
    and li.source_change_order_id is not null
    and not exists (
      select 1
      from public.contract_change_orders c
      where c.id = li.source_change_order_id
        and c.contract_id = coalesce(
          v_invoice.subcontract_id,
          v_invoice.purchase_order_id
        )
        and lower(coalesce(c.status, '')) = 'approved'
    );

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
    p_invoice_id,
    c.id,
    coalesce(c.title, c.description),
    c.change_order_number,
    coalesce(c.amount, 0),
    0,
    coalesce(c.amount, 0),
    'Change Order',
    (row_number() over (
      order by c.created_at, c.id
    ))::integer + coalesce(
      (
        select max(li.sort_order)
        from public.subcontractor_invoice_line_items li
        where li.invoice_id = p_invoice_id
          and li.source_sov_item_id is not null
      ),
      0
    )
  from public.contract_change_orders c
  where c.contract_id = coalesce(
      v_invoice.subcontract_id,
      v_invoice.purchase_order_id
    )
    and lower(coalesce(c.status, '')) = 'approved'
  on conflict (invoice_id, source_change_order_id)
    where source_change_order_id is not null
  do update set
    scheduled_value = excluded.scheduled_value,
    commitment_value = 0,
    change_value = excluded.change_value,
    description = excluded.description,
    budget_code = excluded.budget_code,
    line_item_type = 'Change Order',
    sort_order = excluded.sort_order,
    updated_at = now();
end;
$$;

revoke all on function public.reconcile_subcontractor_invoice_sources(bigint)
from public, anon, authenticated;

create or replace function public.reconcile_subcontractor_invoice_on_reopen()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status
    and new.status::text in (
      'draft',
      'invited',
      'revise_and_resubmit'
    )
    and old.status::text not in (
      'draft',
      'invited',
      'revise_and_resubmit'
    )
    and new.acumatica_ref_nbr is null
    and new.acumatica_doc_type is null
    and new.acumatica_sync_at is null
    and new.acumatica_ap_bill_id is null
  then
    perform public.reconcile_subcontractor_invoice_sources(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.reconcile_subcontractor_invoice_on_reopen()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_reconcile_on_reopen
on public.subcontractor_invoices;
create trigger trg_subcontractor_invoice_reconcile_on_reopen
before update of status
on public.subcontractor_invoices
for each row
execute function public.reconcile_subcontractor_invoice_on_reopen();

create or replace function public.reject_direct_subcontractor_invoice_line_delete()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if coalesce((select auth.role()) = 'service_role', false)
    or current_setting('alleato.invoice_sov_sync', true) = 'on'
    or current_setting(
      'alleato.subcontractor_invoice_parent_delete',
      true
    ) = old.invoice_id::text
  then
    return old;
  end if;

  perform 1
  from public.subcontractor_invoices
  where id = old.invoice_id
  for update;

  raise exception using
    errcode = '42501',
    message = 'Invoice line items cannot be deleted directly';
end;
$$;

revoke all on function public.reject_direct_subcontractor_invoice_line_delete()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_line_delete_guard
on public.subcontractor_invoice_line_items;
create trigger trg_subcontractor_invoice_line_delete_guard
before delete
on public.subcontractor_invoice_line_items
for each row
execute function public.reject_direct_subcontractor_invoice_line_delete();
