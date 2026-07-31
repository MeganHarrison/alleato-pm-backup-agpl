-- Atomic, concurrency-safe boundary for Alleato AI edits to an existing
-- draft Commitment (Subcontract or Purchase Order) Schedule of Values.
--
-- Mirrors public.ai_edit_draft_prime_contract_sov (migration 20260722173000)
-- but adapted to the two commitment shapes:
--   * subcontracts       -> subcontract_sov_items       (fk subcontract_id,    uom col: unit_of_measure)
--   * purchase_orders    -> purchase_order_sov_items    (fk purchase_order_id, uom col: uom)
-- Differences from Prime Contracts:
--   * status label is capitalized ('Draft', not 'draft')
--   * privacy allow-list column is non_admin_user_ids (not allowed_user_ids)
--   * SOV rows store `amount` directly (there is no generated total_cost column)
--   * the parent has NO stored contract-sum column (totals are view-derived),
--     so we only bump the parent updated_at; we never write a parent value.
--
-- The application still enforces project + Commitments module permissions in
-- the tool layer. These service-role-only RPCs add defense in depth (privacy,
-- draft gate, stale-preview check) and keep the parent lock, row upserts, and
-- total computation inside one database transaction.

-- All SOV writers must share the parent-commitment lock the AI RPC uses, so a
-- manual child-row write cannot race between the AI snapshot comparison and the
-- upsert.
create or replace function public.lock_subcontract_for_sov_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  for v_id in
    select candidates.subcontract_id
    from (
      select case when tg_op <> 'INSERT' then old.subcontract_id end as subcontract_id
      union
      select case when tg_op <> 'DELETE' then new.subcontract_id end as subcontract_id
    ) candidates
    where candidates.subcontract_id is not null
    order by candidates.subcontract_id
  loop
    perform 1 from public.subcontracts where id = v_id for update;
    if not found then
      -- ON DELETE CASCADE removes child rows after the parent is already gone;
      -- that path needs no competing-writer lock and must not fail a deletion.
      if tg_op = 'DELETE' and v_id = old.subcontract_id then
        continue;
      end if;
      raise exception using errcode = '23503', message = 'COMMITMENT_SOV_PARENT_UNAVAILABLE';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.lock_subcontract_for_sov_write()
from public, anon, authenticated;

drop trigger if exists subcontract_sov_items_parent_write_lock
on public.subcontract_sov_items;

create trigger subcontract_sov_items_parent_write_lock
before insert or update or delete on public.subcontract_sov_items
for each row execute function public.lock_subcontract_for_sov_write();

create or replace function public.lock_purchase_order_for_sov_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  for v_id in
    select candidates.purchase_order_id
    from (
      select case when tg_op <> 'INSERT' then old.purchase_order_id end as purchase_order_id
      union
      select case when tg_op <> 'DELETE' then new.purchase_order_id end as purchase_order_id
    ) candidates
    where candidates.purchase_order_id is not null
    order by candidates.purchase_order_id
  loop
    perform 1 from public.purchase_orders where id = v_id for update;
    if not found then
      if tg_op = 'DELETE' and v_id = old.purchase_order_id then
        continue;
      end if;
      raise exception using errcode = '23503', message = 'COMMITMENT_SOV_PARENT_UNAVAILABLE';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.lock_purchase_order_for_sov_write()
from public, anon, authenticated;

drop trigger if exists purchase_order_sov_items_parent_write_lock
on public.purchase_order_sov_items;

create trigger purchase_order_sov_items_parent_write_lock
before insert or update or delete on public.purchase_order_sov_items
for each row execute function public.lock_purchase_order_for_sov_write();

-- ---------------------------------------------------------------------------
-- Subcontract SOV atomic edit
-- ---------------------------------------------------------------------------
create or replace function public.ai_edit_draft_subcontract_sov(
  p_project_id bigint,
  p_contract_id uuid,
  p_user_id uuid,
  p_is_admin boolean,
  p_expected_contract_updated_at timestamptz,
  p_expected_sov_rows jsonb,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.subcontracts%rowtype;
  v_current_sov_rows jsonb;
  v_sov_total numeric(15, 2);
  v_updated_rows integer;
  v_appended_rows integer;
begin
  if p_user_id is null
    or p_project_id is null
    or p_contract_id is null
    or p_expected_contract_updated_at is null
    or jsonb_typeof(coalesce(p_expected_sov_rows, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_rows) < 1
    or jsonb_array_length(p_rows) > 500
  then
    raise exception using errcode = '22023', message = 'AI_SOV_INVALID_REQUEST';
  end if;

  if not exists (
    select 1 from public.users_auth ua
    join public.people p on p.id = ua.person_id
    where ua.auth_user_id = p_user_id and p.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'AI_SOV_USER_UNAVAILABLE';
  end if;

  select * into v_contract
  from public.subcontracts
  where id = p_contract_id and project_id = p_project_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_UNAVAILABLE';
  end if;

  if v_contract.is_private
    and not coalesce(p_is_admin, false)
    and v_contract.created_by is distinct from p_user_id
    and not (p_user_id = any(coalesce(v_contract.non_admin_user_ids, '{}'::uuid[])))
  then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_UNAVAILABLE';
  end if;

  if lower(coalesce(v_contract.status, '')) <> 'draft' or coalesce(v_contract.executed, false) then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_NOT_DRAFT';
  end if;

  if v_contract.updated_at is distinct from p_expected_contract_updated_at then
    raise exception using errcode = 'P0001', message = 'AI_SOV_STATE_CHANGED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'subcontract_id', s.subcontract_id,
        'line_number', s.line_number,
        'description', s.description,
        'budget_code', s.budget_code,
        'project_budget_code_id', s.project_budget_code_id,
        'quantity', s.quantity,
        'unit_cost', s.unit_cost,
        'amount', s.amount,
        'unit_of_measure', s.unit_of_measure,
        'updated_at', s.updated_at
      ) order by s.line_number, s.id
    ),
    '[]'::jsonb
  )
  into v_current_sov_rows
  from public.subcontract_sov_items s
  where s.subcontract_id = p_contract_id;

  if v_current_sov_rows <> p_expected_sov_rows then
    raise exception using errcode = 'P0001', message = 'AI_SOV_STATE_CHANGED';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(
      id uuid, line_number integer, description text,
      budget_code text, project_budget_code_id uuid,
      quantity numeric, unit_cost numeric, amount numeric, unit_of_measure text
    )
    where r.id is null
      or r.line_number is null or r.line_number < 1
      or r.description is null or btrim(r.description) = '' or char_length(r.description) > 500
      or r.project_budget_code_id is null
      or r.amount is null or r.amount < 0
      or r.amount <> round(r.amount, 2) or r.amount >= 10000000000000
      or (r.quantity is not null and (r.quantity <= 0 or r.quantity <> round(r.quantity, 4) or r.quantity >= 100000000000))
      or (r.unit_cost is not null and (r.unit_cost < 0 or r.unit_cost <> round(r.unit_cost, 2) or r.unit_cost >= 10000000000000))
      or char_length(coalesce(r.unit_of_measure, '')) > 50
  ) then
    raise exception using errcode = '22023', message = 'AI_SOV_INVALID_ROWS';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(id uuid) group by r.id having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(p_rows) as r(line_number integer) group by r.line_number having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'AI_SOV_DUPLICATE_ROWS';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(id uuid)
    join public.subcontract_sov_items s on s.id = r.id
    where s.subcontract_id <> p_contract_id
  ) then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_UNAVAILABLE';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(project_budget_code_id uuid)
    left join public.project_budget_codes pbc
      on pbc.id = r.project_budget_code_id
      and pbc.project_id = p_project_id
      and pbc.is_active = true
    where pbc.id is null
  ) then
    raise exception using errcode = '22023', message = 'AI_SOV_INVALID_BUDGET_CODE';
  end if;

  select count(*) filter (where s.id is not null),
         count(*) filter (where s.id is null)
  into v_updated_rows, v_appended_rows
  from jsonb_to_recordset(p_rows) as r(id uuid)
  left join public.subcontract_sov_items s on s.id = r.id and s.subcontract_id = p_contract_id;

  insert into public.subcontract_sov_items (
    id, subcontract_id, line_number, description, budget_code,
    project_budget_code_id, quantity, unit_cost, amount, unit_of_measure, updated_at
  )
  select
    r.id, p_contract_id, r.line_number, btrim(r.description), r.budget_code,
    r.project_budget_code_id, r.quantity, r.unit_cost,
    r.amount::numeric(15, 2), nullif(btrim(r.unit_of_measure), ''), now()
  from jsonb_to_recordset(p_rows) as r(
    id uuid, line_number integer, description text,
    budget_code text, project_budget_code_id uuid,
    quantity numeric, unit_cost numeric, amount numeric, unit_of_measure text
  )
  on conflict (id) do update
  set line_number = excluded.line_number,
      description = excluded.description,
      budget_code = excluded.budget_code,
      project_budget_code_id = excluded.project_budget_code_id,
      quantity = excluded.quantity,
      unit_cost = excluded.unit_cost,
      amount = excluded.amount,
      unit_of_measure = excluded.unit_of_measure,
      updated_at = now()
  where subcontract_sov_items.subcontract_id = p_contract_id;

  select coalesce(sum(s.amount), 0)::numeric(15, 2)
  into v_sov_total
  from public.subcontract_sov_items s
  where s.subcontract_id = p_contract_id;

  update public.subcontracts set updated_at = now()
  where id = p_contract_id and project_id = p_project_id;

  return jsonb_build_object(
    'sovTotal', v_sov_total,
    'updatedRows', v_updated_rows,
    'appendedRows', v_appended_rows,
    'contractUpdatedAt', now()
  );
exception
  when numeric_value_out_of_range then
    raise exception using errcode = '22003', message = 'AI_SOV_NUMERIC_OUT_OF_RANGE';
  when unique_violation then
    raise exception using errcode = '23505', message = 'AI_SOV_STATE_CHANGED';
end;
$$;

revoke all on function public.ai_edit_draft_subcontract_sov(
  bigint, uuid, uuid, boolean, timestamptz, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.ai_edit_draft_subcontract_sov(
  bigint, uuid, uuid, boolean, timestamptz, jsonb, jsonb
) to service_role;
comment on function public.ai_edit_draft_subcontract_sov(
  bigint, uuid, uuid, boolean, timestamptz, jsonb, jsonb
) is 'Atomically applies an approved Alleato AI SOV preview to an accessible unexecuted draft Subcontract.';

-- ---------------------------------------------------------------------------
-- Purchase Order SOV atomic edit
-- ---------------------------------------------------------------------------
create or replace function public.ai_edit_draft_purchase_order_sov(
  p_project_id bigint,
  p_contract_id uuid,
  p_user_id uuid,
  p_is_admin boolean,
  p_expected_contract_updated_at timestamptz,
  p_expected_sov_rows jsonb,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.purchase_orders%rowtype;
  v_current_sov_rows jsonb;
  v_sov_total numeric(15, 2);
  v_updated_rows integer;
  v_appended_rows integer;
begin
  if p_user_id is null
    or p_project_id is null
    or p_contract_id is null
    or p_expected_contract_updated_at is null
    or jsonb_typeof(coalesce(p_expected_sov_rows, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_rows) < 1
    or jsonb_array_length(p_rows) > 500
  then
    raise exception using errcode = '22023', message = 'AI_SOV_INVALID_REQUEST';
  end if;

  if not exists (
    select 1 from public.users_auth ua
    join public.people p on p.id = ua.person_id
    where ua.auth_user_id = p_user_id and p.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'AI_SOV_USER_UNAVAILABLE';
  end if;

  select * into v_contract
  from public.purchase_orders
  where id = p_contract_id and project_id = p_project_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_UNAVAILABLE';
  end if;

  if v_contract.is_private
    and not coalesce(p_is_admin, false)
    and v_contract.created_by is distinct from p_user_id
    and not (p_user_id = any(coalesce(v_contract.non_admin_user_ids, '{}'::uuid[])))
  then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_UNAVAILABLE';
  end if;

  if lower(coalesce(v_contract.status, '')) <> 'draft' or coalesce(v_contract.executed, false) then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_NOT_DRAFT';
  end if;

  if v_contract.updated_at is distinct from p_expected_contract_updated_at then
    raise exception using errcode = 'P0001', message = 'AI_SOV_STATE_CHANGED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'purchase_order_id', s.purchase_order_id,
        'line_number', s.line_number,
        'description', s.description,
        'budget_code', s.budget_code,
        'project_budget_code_id', s.project_budget_code_id,
        'quantity', s.quantity,
        'unit_cost', s.unit_cost,
        'amount', s.amount,
        'uom', s.uom,
        'updated_at', s.updated_at
      ) order by s.line_number, s.id
    ),
    '[]'::jsonb
  )
  into v_current_sov_rows
  from public.purchase_order_sov_items s
  where s.purchase_order_id = p_contract_id;

  if v_current_sov_rows <> p_expected_sov_rows then
    raise exception using errcode = 'P0001', message = 'AI_SOV_STATE_CHANGED';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(
      id uuid, line_number integer, description text,
      budget_code text, project_budget_code_id uuid,
      quantity numeric, unit_cost numeric, amount numeric, uom text
    )
    where r.id is null
      or r.line_number is null or r.line_number < 1
      or r.description is null or btrim(r.description) = '' or char_length(r.description) > 500
      or r.project_budget_code_id is null
      or r.amount is null or r.amount < 0
      or r.amount <> round(r.amount, 2) or r.amount >= 10000000000000
      or (r.quantity is not null and (r.quantity <= 0 or r.quantity <> round(r.quantity, 4) or r.quantity >= 100000000000))
      or (r.unit_cost is not null and (r.unit_cost < 0 or r.unit_cost <> round(r.unit_cost, 2) or r.unit_cost >= 10000000000000))
      or char_length(coalesce(r.uom, '')) > 50
  ) then
    raise exception using errcode = '22023', message = 'AI_SOV_INVALID_ROWS';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(id uuid) group by r.id having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(p_rows) as r(line_number integer) group by r.line_number having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'AI_SOV_DUPLICATE_ROWS';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(id uuid)
    join public.purchase_order_sov_items s on s.id = r.id
    where s.purchase_order_id <> p_contract_id
  ) then
    raise exception using errcode = 'P0001', message = 'AI_SOV_CONTRACT_UNAVAILABLE';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(project_budget_code_id uuid)
    left join public.project_budget_codes pbc
      on pbc.id = r.project_budget_code_id
      and pbc.project_id = p_project_id
      and pbc.is_active = true
    where pbc.id is null
  ) then
    raise exception using errcode = '22023', message = 'AI_SOV_INVALID_BUDGET_CODE';
  end if;

  select count(*) filter (where s.id is not null),
         count(*) filter (where s.id is null)
  into v_updated_rows, v_appended_rows
  from jsonb_to_recordset(p_rows) as r(id uuid)
  left join public.purchase_order_sov_items s on s.id = r.id and s.purchase_order_id = p_contract_id;

  insert into public.purchase_order_sov_items (
    id, purchase_order_id, line_number, description, budget_code,
    project_budget_code_id, quantity, unit_cost, amount, uom, updated_at
  )
  select
    r.id, p_contract_id, r.line_number, btrim(r.description), r.budget_code,
    r.project_budget_code_id, r.quantity, r.unit_cost,
    r.amount::numeric(15, 2), nullif(btrim(r.uom), ''), now()
  from jsonb_to_recordset(p_rows) as r(
    id uuid, line_number integer, description text,
    budget_code text, project_budget_code_id uuid,
    quantity numeric, unit_cost numeric, amount numeric, uom text
  )
  on conflict (id) do update
  set line_number = excluded.line_number,
      description = excluded.description,
      budget_code = excluded.budget_code,
      project_budget_code_id = excluded.project_budget_code_id,
      quantity = excluded.quantity,
      unit_cost = excluded.unit_cost,
      amount = excluded.amount,
      uom = excluded.uom,
      updated_at = now()
  where purchase_order_sov_items.purchase_order_id = p_contract_id;

  select coalesce(sum(s.amount), 0)::numeric(15, 2)
  into v_sov_total
  from public.purchase_order_sov_items s
  where s.purchase_order_id = p_contract_id;

  update public.purchase_orders set updated_at = now()
  where id = p_contract_id and project_id = p_project_id;

  return jsonb_build_object(
    'sovTotal', v_sov_total,
    'updatedRows', v_updated_rows,
    'appendedRows', v_appended_rows,
    'contractUpdatedAt', now()
  );
exception
  when numeric_value_out_of_range then
    raise exception using errcode = '22003', message = 'AI_SOV_NUMERIC_OUT_OF_RANGE';
  when unique_violation then
    raise exception using errcode = '23505', message = 'AI_SOV_STATE_CHANGED';
end;
$$;

revoke all on function public.ai_edit_draft_purchase_order_sov(
  bigint, uuid, uuid, boolean, timestamptz, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.ai_edit_draft_purchase_order_sov(
  bigint, uuid, uuid, boolean, timestamptz, jsonb, jsonb
) to service_role;
comment on function public.ai_edit_draft_purchase_order_sov(
  bigint, uuid, uuid, boolean, timestamptz, jsonb, jsonb
) is 'Atomically applies an approved Alleato AI SOV preview to an accessible unexecuted draft Purchase Order.';
