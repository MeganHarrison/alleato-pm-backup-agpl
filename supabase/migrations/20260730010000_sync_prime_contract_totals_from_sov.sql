-- Keep Prime Contract header totals aligned with their authoritative children.
--
-- The Prime Contracts list reads prime_contracts.original_contract_value,
-- while the detail page independently sums contract_line_items.total_cost.
-- Manual SOV writes previously had no database boundary that synchronized the
-- parent, so the two pages could display different amounts.

create index if not exists idx_contract_line_items_contract_id
  on public.contract_line_items (contract_id);

create index if not exists idx_pcco_canonical_prime_contract_id
  on public.prime_contract_change_orders (
    (coalesce(prime_contract_id, contract_id))
  )
  where coalesce(prime_contract_id, contract_id) is not null;

create or replace function public.prime_contract_approved_change_total(
  p_contract_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    sum(change_order.total_amount) filter (
      where lower(btrim(coalesce(change_order.status, ''))) = 'approved'
    ),
    0
  )::numeric(15, 2)
  from public.prime_contract_change_orders change_order
  -- Application reads give prime_contract_id precedence over the legacy
  -- contract_id field. A row with both populated must belong to only one
  -- Prime Contract.
  where coalesce(
    change_order.prime_contract_id,
    change_order.contract_id
  ) = p_contract_id;
$$;

revoke all on function public.prime_contract_approved_change_total(uuid)
from public, anon, authenticated;

create or replace function public.recalculate_prime_contract_totals(
  p_contract_id uuid,
  p_sync_original boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_original numeric(15, 2);
  v_sov_total numeric(15, 2);
  v_original_total numeric(15, 2);
  v_approved_change_total numeric(15, 2);
begin
  if p_contract_id is null then
    return;
  end if;

  select prime_contract.original_contract_value
  into v_current_original
  from public.prime_contracts prime_contract
  where prime_contract.id = p_contract_id
  for update;

  if not found then
    return;
  end if;

  select coalesce(sum(line_item.total_cost), 0)::numeric(15, 2)
  into v_sov_total
  from public.contract_line_items line_item
  where line_item.contract_id = p_contract_id;

  v_original_total := case
    when p_sync_original then v_sov_total
    else v_current_original
  end;

  v_approved_change_total :=
    public.prime_contract_approved_change_total(p_contract_id);

  update public.prime_contracts prime_contract
  set original_contract_value = v_original_total,
      revised_contract_value = v_original_total + v_approved_change_total,
      updated_at = now()
  where prime_contract.id = p_contract_id
    and (
      prime_contract.original_contract_value is distinct from v_original_total
      or prime_contract.revised_contract_value
        is distinct from v_original_total + v_approved_change_total
    );
end;
$$;

revoke all on function public.recalculate_prime_contract_totals(uuid, boolean)
from public, anon, authenticated;

create or replace function public.sync_prime_contract_totals_from_sov()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_id uuid;
begin
  for v_contract_id in
    select distinct candidates.contract_id
    from (
      select case when tg_op <> 'INSERT' then old.contract_id end as contract_id
      union all
      select case when tg_op <> 'DELETE' then new.contract_id end as contract_id
    ) candidates
    where candidates.contract_id is not null
    order by candidates.contract_id
  loop
    perform public.recalculate_prime_contract_totals(v_contract_id, true);
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.sync_prime_contract_totals_from_sov()
from public, anon, authenticated;

drop trigger if exists contract_line_items_sync_prime_contract_totals
on public.contract_line_items;

create trigger contract_line_items_sync_prime_contract_totals
after insert or update of contract_id, quantity, unit_cost, total_cost or delete
on public.contract_line_items
for each row execute function public.sync_prime_contract_totals_from_sov();

create or replace function public.sync_prime_contract_totals_from_change_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_id uuid;
begin
  for v_contract_id in
    select distinct candidates.contract_id
    from (
      select case
        when tg_op <> 'INSERT'
        then coalesce(old.prime_contract_id, old.contract_id)
      end as contract_id
      union all
      select case
        when tg_op <> 'DELETE'
        then coalesce(new.prime_contract_id, new.contract_id)
      end as contract_id
    ) candidates
    where candidates.contract_id is not null
    order by candidates.contract_id
  loop
    -- A change-order mutation must preserve header-only contracts. It owns the
    -- revised total, but it does not manufacture an SOV where none exists.
    perform public.recalculate_prime_contract_totals(v_contract_id, false);
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.sync_prime_contract_totals_from_change_order()
from public, anon, authenticated;

drop trigger if exists prime_contract_change_orders_sync_contract_totals
on public.prime_contract_change_orders;

create trigger prime_contract_change_orders_sync_contract_totals
after insert
  or update of prime_contract_id, contract_id, status, total_amount
  or delete
on public.prime_contract_change_orders
for each row
execute function public.sync_prime_contract_totals_from_change_order();

create or replace function public.enforce_prime_contract_header_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sov_total numeric(15, 2);
begin
  -- SOV-backed contracts cannot be overwritten by another writer with a
  -- stale header value. Header-only contracts remain valid.
  if exists (
    select 1
    from public.contract_line_items line_item
    where line_item.contract_id = new.id
  ) then
    select coalesce(sum(line_item.total_cost), 0)::numeric(15, 2)
    into v_sov_total
    from public.contract_line_items line_item
    where line_item.contract_id = new.id;

    new.original_contract_value := v_sov_total;
  end if;

  new.revised_contract_value := new.original_contract_value
    + public.prime_contract_approved_change_total(new.id);

  return new;
end;
$$;

revoke all on function public.enforce_prime_contract_header_totals()
from public, anon, authenticated;

drop trigger if exists prime_contracts_enforce_header_totals_on_insert
on public.prime_contracts;
drop trigger if exists prime_contracts_enforce_header_totals_on_update
on public.prime_contracts;

create trigger prime_contracts_enforce_header_totals_on_insert
before insert on public.prime_contracts
for each row execute function public.enforce_prime_contract_header_totals();

create trigger prime_contracts_enforce_header_totals_on_update
before update of original_contract_value, revised_contract_value
on public.prime_contracts
for each row execute function public.enforce_prime_contract_header_totals();

-- This legacy trigger reads contract_change_orders, which is now a
-- commitment-only table. It must not write Prime Contract totals.
drop trigger if exists trg_sync_revised_value
on public.contract_change_orders;

-- Repair original values only where an SOV exists. Header-only contracts keep
-- their intentional amount.
with sov_totals as (
  select
    line_item.contract_id,
    coalesce(sum(line_item.total_cost), 0)::numeric(15, 2) as sov_total
  from public.contract_line_items line_item
  group by line_item.contract_id
)
update public.prime_contracts prime_contract
set original_contract_value = sov.sov_total,
    revised_contract_value = sov.sov_total
      + public.prime_contract_approved_change_total(prime_contract.id),
    updated_at = now()
from sov_totals sov
where prime_contract.id = sov.contract_id
  and (
    prime_contract.original_contract_value is distinct from sov.sov_total
    or prime_contract.revised_contract_value is distinct from (
      sov.sov_total
      + public.prime_contract_approved_change_total(prime_contract.id)
    )
  );

-- Reconcile revised values for header-only contracts as well.
update public.prime_contracts prime_contract
set revised_contract_value = prime_contract.original_contract_value
    + public.prime_contract_approved_change_total(prime_contract.id),
    updated_at = now()
where prime_contract.revised_contract_value is distinct from (
  prime_contract.original_contract_value
  + public.prime_contract_approved_change_total(prime_contract.id)
);

-- Retire the last read path that still treated commitment-only change orders
-- as Prime Contract revenue. Keep the existing view shape so all API and AI
-- consumers receive the corrected canonical PCCO totals without code changes.
create or replace view public.prime_contract_financial_summary
with (security_invoker = true) as
with change_order_totals as (
  select
    coalesce(
      change_order.prime_contract_id,
      change_order.contract_id
    ) as contract_id,
    coalesce(
      sum(change_order.total_amount) filter (
        where lower(btrim(coalesce(change_order.status, ''))) = 'approved'
      ),
      0
    ) as approved_change_orders,
    coalesce(
      sum(change_order.total_amount) filter (
        where lower(btrim(coalesce(change_order.status, ''))) = 'pending'
      ),
      0
    ) as pending_change_orders,
    coalesce(
      sum(change_order.total_amount) filter (
        where lower(btrim(coalesce(change_order.status, ''))) = 'draft'
      ),
      0
    ) as draft_change_orders
  from public.prime_contract_change_orders change_order
  where coalesce(
    change_order.prime_contract_id,
    change_order.contract_id
  ) is not null
  group by coalesce(
    change_order.prime_contract_id,
    change_order.contract_id
  )
)
select
  prime_contract.id as contract_id,
  prime_contract.project_id,
  prime_contract.contract_number,
  prime_contract.title,
  prime_contract.status,
  prime_contract.erp_status,
  prime_contract.client_id,
  prime_contract.executed,
  prime_contract.is_private as private,
  prime_contract.original_contract_value as original_contract_amount,
  coalesce(change_totals.approved_change_orders, 0)
    as approved_change_orders,
  coalesce(change_totals.pending_change_orders, 0)
    as pending_change_orders,
  coalesce(change_totals.draft_change_orders, 0)
    as draft_change_orders,
  prime_contract.original_contract_value
    + coalesce(change_totals.approved_change_orders, 0)
    as revised_contract_amount,
  prime_contract.original_contract_value
    + coalesce(change_totals.approved_change_orders, 0)
    + coalesce(change_totals.pending_change_orders, 0)
    as pending_revised_contract_amount,
  coalesce((
    select sum(payment_application.amount)
    from public.prime_contract_payment_applications payment_application
    where payment_application.contract_id = prime_contract.id
      and payment_application.status = 'approved'
  ), 0)
    + coalesce((
      select sum(owner_invoice.gross_amount)
      from public.owner_invoices owner_invoice
      where owner_invoice.prime_contract_id = prime_contract.id
        and owner_invoice.payment_application_id is null
        and owner_invoice.status <> 'draft'
    ), 0) as invoiced_amount,
  coalesce((
    select sum(payment.amount)
    from public.prime_contract_payments payment
    where payment.contract_id = prime_contract.id
  ), 0) as payments_received,
  prime_contract.original_contract_value
    + coalesce(change_totals.approved_change_orders, 0)
    - coalesce((
      select sum(payment.amount)
      from public.prime_contract_payments payment
      where payment.contract_id = prime_contract.id
    ), 0) as remaining_balance,
  case
    when (
      prime_contract.original_contract_value
      + coalesce(change_totals.approved_change_orders, 0)
    ) = 0 then 0
    else round(
      coalesce((
        select sum(payment.amount)
        from public.prime_contract_payments payment
        where payment.contract_id = prime_contract.id
      ), 0)
      * 100.0
      / (
        prime_contract.original_contract_value
        + coalesce(change_totals.approved_change_orders, 0)
      ),
      2
    )
  end as percent_paid
from public.prime_contracts prime_contract
left join change_order_totals change_totals
  on change_totals.contract_id = prime_contract.id;
