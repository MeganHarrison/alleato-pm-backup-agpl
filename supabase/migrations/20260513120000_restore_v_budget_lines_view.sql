create or replace view public.v_budget_lines as
with approved_budget_mods as (
  select
    bml.project_id,
    coalesce(bml.sub_job_id, '00000000-0000-0000-0000-000000000000'::uuid) as sub_job_key,
    bml.cost_code_id,
    bml.cost_type_id,
    sum(bml.amount) as budget_mod_total
  from public.budget_mod_lines bml
  join public.budget_modifications bm on bm.id = bml.budget_modification_id
  where bm.status = 'approved'
  group by
    bml.project_id,
    coalesce(bml.sub_job_id, '00000000-0000-0000-0000-000000000000'::uuid),
    bml.cost_code_id,
    bml.cost_type_id
),
approved_prime_co_lines as (
  select
    pco.project_id,
    pli.budget_code_id as budget_line_id,
    sum(pli.amount) as approved_co_total
  from public.pco_line_items pli
  join public.prime_contract_pcos pco
    on pco.id = pli.pco_id
   and pli.pco_type = 'prime'
  where pco.status = 'approved'
    and pco.promoted_to_co_id is not null
  group by pco.project_id, pli.budget_code_id
)
select
  bl.id,
  bl.project_id,
  bl.sub_job_id,
  bl.cost_code_id,
  bl.cost_type_id,
  bl.description,
  bl.original_amount,
  bl.created_by,
  bl.created_at,
  bl.updated_at,
  coalesce(abm.budget_mod_total, 0) as budget_mod_total,
  coalesce(apcl.approved_co_total, 0) as approved_co_total,
  (
    bl.original_amount
    + coalesce(abm.budget_mod_total, 0)
    + coalesce(apcl.approved_co_total, 0)
  ) as revised_budget
from public.budget_lines bl
left join approved_budget_mods abm
  on abm.project_id = bl.project_id
 and abm.sub_job_key = bl.sub_job_key
 and abm.cost_code_id = bl.cost_code_id
 and abm.cost_type_id = bl.cost_type_id
left join approved_prime_co_lines apcl
  on apcl.project_id = bl.project_id
 and apcl.budget_line_id = bl.id;

grant all on table public.v_budget_lines to anon;
grant all on table public.v_budget_lines to authenticated;
grant all on table public.v_budget_lines to service_role;

notify pgrst, 'reload schema';
