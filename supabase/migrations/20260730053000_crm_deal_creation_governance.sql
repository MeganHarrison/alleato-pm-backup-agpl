begin;

revoke insert on public.crm_deals from authenticated;
grant insert (
  name,
  company_id,
  lead_id,
  pipeline_id,
  stage_id,
  owner_person_id,
  value_estimate,
  probability,
  expected_close_date,
  source,
  forecast_category,
  pursuit_type,
  bid_due_date,
  qualification_score,
  win_loss_notes
) on public.crm_deals to authenticated;

create or replace function public.crm_guard_new_deal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage_type text;
begin
  select stage.stage_type
  into v_stage_type
  from public.crm_stages stage
  where stage.id = new.stage_id
    and stage.pipeline_id = new.pipeline_id
    and stage.archived_at is null;

  if v_stage_type is distinct from 'open' then
    raise exception using
      errcode = '23514',
      message = 'New CRM deals must begin in an active open stage in the selected pipeline.';
  end if;

  new.status := 'open';
  new.closed_at := null;
  new.lost_reason := null;
  new.project_id := null;
  new.project_sync_status := 'not_started';
  new.row_version := 1;
  new.archived_at := null;
  return new;
end;
$$;

drop trigger if exists crm_deals_creation_guard on public.crm_deals;
create trigger crm_deals_creation_guard
before insert on public.crm_deals
for each row execute function public.crm_guard_new_deal();

comment on function public.crm_guard_new_deal() is
'Forces every new CRM deal into an active open stage and clears lifecycle, archive, and project-link state. Terminal transitions remain governed by crm_transition_deal_stage.';

commit;
