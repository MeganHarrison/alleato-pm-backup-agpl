begin;

set local search_path = public, extensions;

select plan(24);

select has_function(
  'public',
  'recalculate_prime_contract_totals',
  array['uuid', 'boolean'],
  'Prime Contract totals have one shared recalculation function'
);

select has_trigger(
  'public',
  'contract_line_items',
  'contract_line_items_sync_prime_contract_totals',
  'SOV mutations synchronize their Prime Contract'
);

select has_trigger(
  'public',
  'prime_contract_change_orders',
  'prime_contract_change_orders_sync_contract_totals',
  'Prime Contract change-order mutations synchronize revised totals'
);

select ok(
  coalesce((
    select 'security_invoker=true' = any(pg_class.reloptions)
    from pg_catalog.pg_class
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'prime_contract_financial_summary'
  ), false),
  'The financial summary preserves caller RLS with security_invoker'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.prime_contract_financial_summary),
  0::bigint,
  'An authenticated principal without project access cannot read the view'
);

reset role;

create temp table prime_contract_total_test_context (
  project_id integer not null,
  contract_a uuid not null,
  contract_b uuid not null,
  header_only_contract uuid not null,
  line_item uuid not null
) on commit drop;

insert into prime_contract_total_test_context (
  project_id,
  contract_a,
  contract_b,
  header_only_contract,
  line_item
)
select
  project.id,
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid()
from public.projects project
order by project.id
limit 1;

select is(
  (select count(*) from prime_contract_total_test_context),
  1::bigint,
  'A project is available for transactional fixtures'
);

insert into public.prime_contracts (
  id,
  project_id,
  contract_number,
  title,
  original_contract_value,
  revised_contract_value
)
select
  fixture.contract_id,
  context.project_id,
  'PGTAP-' || left(fixture.contract_id::text, 8),
  fixture.title,
  fixture.original_value,
  fixture.original_value
from prime_contract_total_test_context context
cross join lateral (
  values
    (context.contract_a, 'SOV sync contract A', 1::numeric),
    (context.contract_b, 'SOV sync contract B', 777::numeric),
    (context.header_only_contract, 'Header-only contract', 888::numeric)
) as fixture(contract_id, title, original_value);

insert into public.contract_line_items (
  id,
  contract_id,
  line_number,
  description,
  quantity,
  unit_cost
)
select
  context.line_item,
  context.contract_a,
  1,
  'SOV trigger fixture',
  2,
  50
from prime_contract_total_test_context context;

select is(
  (
    select original_contract_value
    from public.prime_contracts
    where id = (select contract_a from prime_contract_total_test_context)
  ),
  100::numeric,
  'Inserting an SOV row updates the original amount'
);

update public.contract_line_items
set quantity = 5,
    unit_cost = 50
where id = (select line_item from prime_contract_total_test_context);

select is(
  (
    select original_contract_value
    from public.prime_contracts
    where id = (select contract_a from prime_contract_total_test_context)
  ),
  250::numeric,
  'Updating SOV quantity, unit cost, and total updates the original amount'
);

insert into public.prime_contract_change_orders (
  project_id,
  prime_contract_id,
  title,
  status,
  total_amount
)
select
  context.project_id,
  context.contract_a,
  'Approved change fixture',
  'approved',
  25
from prime_contract_total_test_context context;

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (select contract_a from prime_contract_total_test_context)
  ),
  275::numeric,
  'An approved change order is added to the revised amount'
);

update public.prime_contract_change_orders
set total_amount = 30
where title = 'Approved change fixture'
  and prime_contract_id = (
    select contract_a from prime_contract_total_test_context
  );

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (select contract_a from prime_contract_total_test_context)
  ),
  280::numeric,
  'Changing an approved change-order amount updates the revised amount'
);

update public.prime_contract_change_orders
set status = 'draft'
where title = 'Approved change fixture'
  and prime_contract_id = (
    select contract_a from prime_contract_total_test_context
  );

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (select contract_a from prime_contract_total_test_context)
  ),
  250::numeric,
  'Removing approval removes the change order from the revised amount'
);

update public.prime_contract_change_orders
set status = 'approved'
where title = 'Approved change fixture'
  and prime_contract_id = (
    select contract_a from prime_contract_total_test_context
  );

update public.prime_contracts
set original_contract_value = 999,
    revised_contract_value = 999
where id = (select contract_a from prime_contract_total_test_context);

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (select contract_a from prime_contract_total_test_context)
  ),
  280::numeric,
  'A competing SOV-backed parent writer cannot erase approved changes'
);

update public.contract_line_items
set contract_id = (
  select contract_b from prime_contract_total_test_context
)
where id = (select line_item from prime_contract_total_test_context);

select is(
  (
    select original_contract_value
    from public.prime_contracts
    where id = (select contract_a from prime_contract_total_test_context)
  ),
  0::numeric,
  'Moving the final SOV row clears the old contract original amount'
);

select is(
  (
    select original_contract_value
    from public.prime_contracts
    where id = (select contract_b from prime_contract_total_test_context)
  ),
  250::numeric,
  'Moving an SOV row updates the new contract original amount'
);

delete from public.contract_line_items
where id = (select line_item from prime_contract_total_test_context);

select is(
  (
    select original_contract_value
    from public.prime_contracts
    where id = (select contract_b from prime_contract_total_test_context)
  ),
  0::numeric,
  'Deleting the final SOV row clears the contract original amount'
);

insert into public.prime_contract_change_orders (
  project_id,
  prime_contract_id,
  title,
  status,
  total_amount
)
select
  context.project_id,
  context.header_only_contract,
  'Header-only approved change fixture',
  'approved',
  12
from prime_contract_total_test_context context;

select is(
  (
    select original_contract_value
    from public.prime_contracts
    where id = (
      select header_only_contract from prime_contract_total_test_context
    )
  ),
  888::numeric,
  'A change-order mutation preserves a header-only original amount'
);

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (
      select header_only_contract from prime_contract_total_test_context
    )
  ),
  900::numeric,
  'A header-only contract still receives its approved revised amount'
);

insert into public.prime_contract_change_orders (
  project_id,
  prime_contract_id,
  contract_id,
  title,
  status,
  total_amount
)
select
  context.project_id,
  context.contract_a,
  context.contract_b,
  'Canonical parent fixture',
  'approved',
  7
from prime_contract_total_test_context context;

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (select contract_a from prime_contract_total_test_context)
  ),
  37::numeric,
  'prime_contract_id is the canonical parent when both parent fields exist'
);

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (select contract_b from prime_contract_total_test_context)
  ),
  0::numeric,
  'A dual-parent change order is not counted against contract_id'
);

update public.prime_contract_change_orders
set prime_contract_id = (
      select contract_b from prime_contract_total_test_context
    ),
    contract_id = (
      select contract_b from prime_contract_total_test_context
    )
where title = 'Canonical parent fixture';

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (select contract_a from prime_contract_total_test_context)
  ),
  30::numeric,
  'Re-parenting a change order removes it from the old contract'
);

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (select contract_b from prime_contract_total_test_context)
  ),
  7::numeric,
  'Re-parenting a change order adds it to the new contract'
);

delete from public.prime_contract_change_orders
where title = 'Canonical parent fixture';

select is(
  (
    select revised_contract_value
    from public.prime_contracts
    where id = (select contract_b from prime_contract_total_test_context)
  ),
  0::numeric,
  'Deleting a change order removes it from the revised amount'
);

select is(
  (
    select approved_change_orders
    from public.prime_contract_financial_summary
    where contract_id = (
      select contract_a from prime_contract_total_test_context
    )
  ),
  30::numeric,
  'The shared financial view reads canonical Prime Contract change orders'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.prime_contracts pc
    join (
      select
        contract_id,
        round(coalesce(sum(total_cost), 0), 2) as sov_total
      from public.contract_line_items
      group by contract_id
    ) sov on sov.contract_id = pc.id
    where round(coalesce(pc.original_contract_value, 0), 2) <> sov.sov_total
  $$,
  $$ values (0::bigint) $$,
  'Stored Prime Contract original amounts match their SOV totals'
);

select * from finish();
rollback;
