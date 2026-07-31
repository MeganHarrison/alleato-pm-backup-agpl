-- ALL-52: protect CRM lead system fields and complete lead health/conversion workflows.
begin;

alter table public.tasks
  add column if not exists source_type text,
  add column if not exists source_url text;

revoke update on public.crm_leads from authenticated;
grant update (
  organization_name,
  contact_name,
  contact_email,
  contact_phone,
  source,
  notes,
  owner_person_id,
  archived_at
) on public.crm_leads to authenticated;

create or replace function public.crm_evaluate_lead(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last timestamptz;
  v_overdue date;
  v_active_days integer := 14;
  v_watch_days integer := 30;
  v_status text;
  v_reason text;
begin
  if p_lead_id is null then
    return;
  end if;

  select coalesce(nullif(value->>'active_days', '')::integer, v_active_days),
         coalesce(nullif(value->>'watch_days', '')::integer, v_watch_days)
  into v_active_days, v_watch_days
  from public.crm_settings
  where key = 'health_thresholds';

  select max(a.occurred_at)
  into v_last
  from public.crm_activities a
  where a.lead_id = p_lead_id
    and a.deleted_at is null
    and a.occurred_at <= now()
    and (
      a.record_origin = 'manual'
      or (a.record_origin = 'auto' and a.match_status = 'accepted')
    )
    and exists (
      select 1
      from public.crm_settings s
      where s.key = 'meaningful_activity_types'
        and s.value ? a.activity_type
    );

  select min(t.due_date)
  into v_overdue
  from public.tasks t
  where t.crm_lead_id = p_lead_id
    and t.status in ('open', 'in_progress', 'blocked')
    and t.due_date < current_date;

  if v_overdue is not null then
    v_status := 'stale';
    v_reason := format(
      'Follow-up overdue by %s day(s).',
      current_date - v_overdue
    );
  elsif v_last is null then
    v_status := 'unknown';
    v_reason := 'No meaningful activity has been recorded.';
  elsif v_last >= now() - make_interval(days => v_active_days) then
    v_status := 'active';
    v_reason := format(
      'Meaningful activity recorded within %s days.',
      v_active_days
    );
  elsif v_last >= now() - make_interval(days => v_watch_days) then
    v_status := 'watch';
    v_reason := format(
      'No meaningful activity in %s days.',
      extract(day from now() - v_last)::integer
    );
  else
    v_status := 'stale';
    v_reason := format(
      'No meaningful activity in %s days.',
      extract(day from now() - v_last)::integer
    );
  end if;

  update public.crm_leads
  set last_meaningful_activity_at = v_last,
      health_status = v_status,
      health_reason = v_reason,
      health_evaluated_at = now()
  where id = p_lead_id
    and status <> 'converted';
end;
$$;

revoke all on function public.crm_evaluate_lead(uuid)
from public, anon, authenticated;
grant execute on function public.crm_evaluate_lead(uuid) to service_role;

create or replace function public.crm_activity_health_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.crm_evaluate_account(old.company_id);
    perform public.crm_evaluate_lead(old.lead_id);
    return old;
  end if;

  perform public.crm_evaluate_account(new.company_id);
  perform public.crm_evaluate_lead(new.lead_id);

  if tg_op = 'UPDATE' then
    if old.company_id is distinct from new.company_id then
      perform public.crm_evaluate_account(old.company_id);
    end if;
    if old.lead_id is distinct from new.lead_id then
      perform public.crm_evaluate_lead(old.lead_id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.crm_task_health_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.crm_evaluate_account(old.company_id);
    perform public.crm_evaluate_lead(old.crm_lead_id);
    return old;
  end if;

  perform public.crm_evaluate_account(new.company_id);
  perform public.crm_evaluate_lead(new.crm_lead_id);

  if tg_op = 'UPDATE' then
    if old.company_id is distinct from new.company_id then
      perform public.crm_evaluate_account(old.company_id);
    end if;
    if old.crm_lead_id is distinct from new.crm_lead_id then
      perform public.crm_evaluate_lead(old.crm_lead_id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.crm_convert_lead_to_company(
  p_lead_id uuid,
  p_company_id uuid,
  p_expected_row_version integer
)
returns public.crm_leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_person_id uuid;
  v_lead public.crm_leads;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then
    raise exception using
      errcode = '42501',
      message = 'An active internal CRM user is required.';
  end if;

  select *
  into v_lead
  from public.crm_leads
  where id = p_lead_id
    and archived_at is null
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CRM lead was not found.';
  end if;

  if not (
    public.current_has_company_module_permission('crm', 'admin')
    or (
      public.current_has_company_module_permission('crm', 'write')
      and v_lead.owner_person_id = v_person_id
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'You do not have permission to convert this CRM lead.';
  end if;

  if v_lead.row_version <> p_expected_row_version then
    raise exception using
      errcode = '40001',
      message = 'The CRM lead changed before conversion. Refresh and try again.';
  end if;

  if not exists (
    select 1
    from public.companies
    where id = p_company_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'The selected company does not exist.';
  end if;

  if v_lead.status = 'converted' then
    if v_lead.converted_company_id = p_company_id then
      return v_lead;
    end if;
    raise exception using
      errcode = '23514',
      message = 'This lead is already linked to a different company.';
  end if;

  update public.crm_deals
  set company_id = p_company_id,
      lead_id = null
  where lead_id = p_lead_id;

  update public.crm_activities
  set company_id = p_company_id,
      lead_id = null
  where lead_id = p_lead_id;

  update public.tasks
  set company_id = p_company_id,
      source_url = case
        when crm_deal_id is not null then source_url
        else format('/crm/companies/%s', p_company_id)
      end
  where crm_lead_id = p_lead_id;

  update public.crm_leads
  set status = 'converted',
      converted_company_id = p_company_id,
      converted_at = now()
  where id = p_lead_id
  returning * into v_lead;

  perform public.crm_evaluate_account(p_company_id);
  return v_lead;
end;
$$;

revoke all on function public.crm_convert_lead_to_company(uuid, uuid, integer)
from public, anon;
grant execute on function public.crm_convert_lead_to_company(uuid, uuid, integer)
to authenticated, service_role;

commit;
