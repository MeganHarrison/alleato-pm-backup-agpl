-- ============================================================================
-- Complete the numeric Potential Change Order (potential_change_orders) model
-- ============================================================================
-- The /pcos create+edit form collects eight fields that had no column on
-- potential_change_orders (silently dropped on save) and writes line items to
-- pco_line_items — a uuid-keyed table that belongs to the commitment/prime PCO
-- model, not to this bigint-keyed table (so line items never persisted here).
--
-- This migration makes the numeric PCO model whole:
--   1. Adds the eight missing header columns.
--   2. Adds potential_change_order_line_items (bigint pco_id), the correct
--      line-items child for numeric PCOs, with cascade delete.
--   3. Adds create_pco_with_lines / update_pco_with_lines — transactional
--      functions that write the header + grouped change events + all line items
--      in ONE transaction, so a partial failure leaves no orphaned rows.
--
-- The separate commitment_pcos / prime_contract_pcos features (which require a
-- commitment/contract and use pco_line_items) are untouched.

-- ---------------------------------------------------------------------------
-- 1. Missing header columns (additive, idempotent).
-- ---------------------------------------------------------------------------
alter table public.potential_change_orders
  add column if not exists change_reason          text,
  add column if not exists location               text,
  add column if not exists reference              text,
  add column if not exists request_received_from  text,
  add column if not exists due_date               date,
  add column if not exists is_private             boolean not null default false,
  add column if not exists field_change           boolean not null default false,
  add column if not exists paid_in_full           boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Line-items child table keyed by the numeric PCO id.
-- ---------------------------------------------------------------------------
create table if not exists public.potential_change_order_line_items (
  id                        bigint generated always as identity primary key,
  pco_id                    bigint not null
                              references public.potential_change_orders(id) on delete cascade,
  description               text,
  quantity                  numeric default 1,
  uom                       text,
  unit_cost                 numeric default 0,
  line_amount               numeric generated always as
                              (coalesce(quantity, 0) * coalesce(unit_cost, 0)) stored,
  category                  text,
  change_event_line_item_id uuid references public.change_event_line_items(id),
  sort_order                integer default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists potential_change_order_line_items_pco_id_idx
  on public.potential_change_order_line_items (pco_id);

-- RLS mirrors the sibling pco_line_items table: project-level access is enforced
-- at the API layer (requirePermission); RLS just gates by role.
alter table public.potential_change_order_line_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.potential_change_order_line_items'::regclass
      and polname = 'Authenticated users can manage pco numeric line items'
  ) then
    create policy "Authenticated users can manage pco numeric line items"
      on public.potential_change_order_line_items
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.potential_change_order_line_items'::regclass
      and polname = 'Service role full access to pco numeric line items'
  ) then
    create policy "Service role full access to pco numeric line items"
      on public.potential_change_order_line_items
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3a. create_pco_with_lines — atomic create.
-- ---------------------------------------------------------------------------
create or replace function public.create_pco_with_lines(
  p_project_id       integer,
  p_user_id          uuid,
  p_header           jsonb,
  p_change_event_ids uuid[] default '{}',
  p_line_items       jsonb  default '[]'::jsonb
)
returns public.potential_change_orders
language plpgsql
as $$
declare
  v_max  integer;
  v_pco  public.potential_change_orders;
  v_ce   uuid;
  v_idx  integer := 0;
  v_item jsonb;
begin
  if nullif(trim(coalesce(p_header->>'title', '')), '') is null then
    raise exception 'title is required' using errcode = 'check_violation';
  end if;

  -- Next PCO number for this project (zero-padded, min 3 digits).
  select max((number)::integer) into v_max
  from public.potential_change_orders
  where project_id = p_project_id and number ~ '^[0-9]+$';

  insert into public.potential_change_orders (
    project_id, number, title, description, type, status, current_version,
    estimated_value, markup_percentage, schedule_impact_days,
    schedule_impact_description, rfq_required, root_cause, annotation,
    annotation_note, prime_change_order_id, change_reason, location, reference,
    request_received_from, due_date, is_private, field_change, paid_in_full,
    created_by_id, created_at, updated_at
  ) values (
    p_project_id,
    lpad((coalesce(v_max, 0) + 1)::text, 3, '0'),
    trim(p_header->>'title'),
    p_header->>'description',
    coalesce(nullif(p_header->>'type', ''), 'CLIENT_REQUESTED'),
    coalesce(nullif(p_header->>'status', ''), 'DRAFT'),
    1,
    (p_header->>'estimated_value')::numeric,
    (p_header->>'markup_percentage')::numeric,
    (p_header->>'schedule_impact_days')::integer,
    p_header->>'schedule_impact_description',
    coalesce((p_header->>'rfq_required')::boolean, false),
    p_header->>'root_cause',
    p_header->>'annotation',
    p_header->>'annotation_note',
    (p_header->>'prime_change_order_id')::integer,
    p_header->>'change_reason',
    p_header->>'location',
    p_header->>'reference',
    p_header->>'request_received_from',
    (p_header->>'due_date')::date,
    coalesce((p_header->>'is_private')::boolean, false),
    coalesce((p_header->>'field_change')::boolean, false),
    coalesce((p_header->>'paid_in_full')::boolean, false),
    p_user_id, now(), now()
  )
  returning * into v_pco;

  -- Group change events (validated against the project).
  foreach v_ce in array coalesce(p_change_event_ids, '{}') loop
    v_idx := v_idx + 1;
    if not exists (
      select 1 from public.change_events where id = v_ce and project_id = p_project_id
    ) then
      raise exception 'Change event % not found in project %', v_ce, p_project_id
        using errcode = 'foreign_key_violation';
    end if;
    insert into public.pco_change_events (pco_id, change_event_id, sort_order, added_by_id, added_at)
    values (v_pco.id, v_ce, v_idx, p_user_id, now());
  end loop;

  -- Line items.
  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) loop
    insert into public.potential_change_order_line_items (
      pco_id, description, quantity, uom, unit_cost, category,
      change_event_line_item_id, sort_order
    ) values (
      v_pco.id,
      v_item->>'description',
      coalesce((v_item->>'quantity')::numeric, 1),
      v_item->>'uom',
      coalesce((v_item->>'unit_cost')::numeric, 0),
      nullif(v_item->>'category', ''),
      (v_item->>'change_event_line_item_id')::uuid,
      v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  insert into public.timeline_events (project_id, parent_type, parent_id, event_type, actor_id, summary, created_at)
  values (p_project_id, 'PCO', v_pco.id::text, 'CREATED', p_user_id,
          'PCO "' || v_pco.title || '" created', now());

  return v_pco;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3b. update_pco_with_lines — atomic update (header + CEs + line items).
-- ---------------------------------------------------------------------------
-- p_change_event_ids is the FULL desired set of grouped CE ids.
-- p_line_items is the FULL desired set; each element may carry an "id" (bigint,
-- existing row) or omit it (new row). Rows whose id is absent from the payload
-- are deleted.
create or replace function public.update_pco_with_lines(
  p_project_id       integer,
  p_pco_id           bigint,
  p_user_id          uuid,
  p_header           jsonb,
  p_change_event_ids uuid[] default '{}',
  p_line_items       jsonb  default '[]'::jsonb
)
returns public.potential_change_orders
language plpgsql
as $$
declare
  v_pco        public.potential_change_orders;
  v_ce         uuid;
  v_item       jsonb;
  v_idx        integer := 0;
  v_keep_ids   bigint[];
  v_existing   bigint;
begin
  select * into v_pco
  from public.potential_change_orders
  where id = p_pco_id and project_id = p_project_id;

  if not found then
    raise exception 'PCO % not found in project %', p_pco_id, p_project_id
      using errcode = 'no_data_found';
  end if;

  if nullif(trim(coalesce(p_header->>'title', '')), '') is null then
    raise exception 'title is required' using errcode = 'check_violation';
  end if;

  update public.potential_change_orders set
    title                       = trim(p_header->>'title'),
    description                 = p_header->>'description',
    type                        = coalesce(p_header->>'type', type),
    status                      = coalesce(p_header->>'status', status),
    estimated_value             = (p_header->>'estimated_value')::numeric,
    markup_percentage           = (p_header->>'markup_percentage')::numeric,
    schedule_impact_days        = (p_header->>'schedule_impact_days')::integer,
    schedule_impact_description = p_header->>'schedule_impact_description',
    rfq_required                = coalesce((p_header->>'rfq_required')::boolean, false),
    root_cause                  = p_header->>'root_cause',
    change_reason               = p_header->>'change_reason',
    location                    = p_header->>'location',
    reference                   = p_header->>'reference',
    request_received_from       = p_header->>'request_received_from',
    due_date                    = (p_header->>'due_date')::date,
    is_private                  = coalesce((p_header->>'is_private')::boolean, false),
    field_change                = coalesce((p_header->>'field_change')::boolean, false),
    paid_in_full                = coalesce((p_header->>'paid_in_full')::boolean, false),
    updated_at                  = now()
  where id = p_pco_id
  returning * into v_pco;

  -- Reconcile grouped change events against the desired set.
  delete from public.pco_change_events
  where pco_id = p_pco_id
    and change_event_id <> all (coalesce(p_change_event_ids, '{}'));

  foreach v_ce in array coalesce(p_change_event_ids, '{}') loop
    v_idx := v_idx + 1;
    if not exists (
      select 1 from public.change_events where id = v_ce and project_id = p_project_id
    ) then
      raise exception 'Change event % not found in project %', v_ce, p_project_id
        using errcode = 'foreign_key_violation';
    end if;
    if not exists (
      select 1 from public.pco_change_events where pco_id = p_pco_id and change_event_id = v_ce
    ) then
      insert into public.pco_change_events (pco_id, change_event_id, sort_order, added_by_id, added_at)
      values (p_pco_id, v_ce, v_idx, p_user_id, now());
    else
      update public.pco_change_events set sort_order = v_idx
      where pco_id = p_pco_id and change_event_id = v_ce;
    end if;
  end loop;

  -- Reconcile line items.
  select coalesce(array_agg((elem->>'id')::bigint), '{}')
  into v_keep_ids
  from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) elem
  where elem->>'id' is not null;

  delete from public.potential_change_order_line_items
  where pco_id = p_pco_id and id <> all (v_keep_ids);

  v_idx := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) loop
    if v_item->>'id' is not null then
      v_existing := (v_item->>'id')::bigint;
      update public.potential_change_order_line_items set
        description               = v_item->>'description',
        quantity                  = coalesce((v_item->>'quantity')::numeric, 1),
        uom                       = v_item->>'uom',
        unit_cost                 = coalesce((v_item->>'unit_cost')::numeric, 0),
        category                  = nullif(v_item->>'category', ''),
        change_event_line_item_id = (v_item->>'change_event_line_item_id')::uuid,
        sort_order                = v_idx,
        updated_at                = now()
      where id = v_existing and pco_id = p_pco_id;
    else
      insert into public.potential_change_order_line_items (
        pco_id, description, quantity, uom, unit_cost, category,
        change_event_line_item_id, sort_order
      ) values (
        p_pco_id,
        v_item->>'description',
        coalesce((v_item->>'quantity')::numeric, 1),
        v_item->>'uom',
        coalesce((v_item->>'unit_cost')::numeric, 0),
        nullif(v_item->>'category', ''),
        (v_item->>'change_event_line_item_id')::uuid,
        v_idx
      );
    end if;
    v_idx := v_idx + 1;
  end loop;

  insert into public.timeline_events (project_id, parent_type, parent_id, event_type, actor_id, summary, created_at)
  values (p_project_id, 'PCO', p_pco_id::text, 'UPDATED', p_user_id, 'PCO updated', now());

  return v_pco;
end;
$$;

grant execute on function public.create_pco_with_lines(integer, uuid, jsonb, uuid[], jsonb)
  to authenticated, service_role;
grant execute on function public.update_pco_with_lines(integer, bigint, uuid, jsonb, uuid[], jsonb)
  to authenticated, service_role;

notify pgrst, 'reload schema';
