begin;

alter table public.crm_microsoft_connections
  add constraint crm_microsoft_automatic_matching_truth
  check (
    not automatic_matching_enabled
    or connection_status = 'connected'
  );

revoke insert, update on public.crm_microsoft_connections from authenticated;
grant insert (
  person_id,
  privacy_mode,
  automatic_matching_enabled
) on public.crm_microsoft_connections to authenticated;
grant update (
  privacy_mode,
  automatic_matching_enabled
) on public.crm_microsoft_connections to authenticated;

revoke update on public.crm_deals from authenticated;
grant update (
  name,
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

revoke insert, update on public.crm_sales_assets from authenticated;
grant insert (
  asset_type,
  name,
  description,
  steps,
  approval_status,
  created_by_person_id
) on public.crm_sales_assets to authenticated;

revoke insert, update on public.crm_relationship_intelligence from authenticated;
grant insert (
  company_id,
  lead_id,
  intelligence_type,
  title,
  status,
  details,
  source_system,
  source_reference,
  created_by_person_id
) on public.crm_relationship_intelligence to authenticated;

drop policy if exists crm_relationship_intelligence_write
on public.crm_relationship_intelligence;
create policy crm_relationship_intelligence_write
on public.crm_relationship_intelligence for insert to authenticated
with check (
  public.current_has_company_module_permission('crm', 'write')
  and created_by_person_id = public.current_person_id()
  and status in ('draft', 'active', 'needs_review')
  and reviewed_by_person_id is null
  and reviewed_at is null
);

revoke insert, update on public.crm_ai_artifacts from authenticated;
grant insert (
  artifact_type,
  company_id,
  lead_id,
  deal_id,
  title,
  content,
  citations,
  explanation,
  review_status,
  created_by_person_id
) on public.crm_ai_artifacts to authenticated;

drop policy if exists crm_ai_artifacts_read on public.crm_ai_artifacts;
create policy crm_ai_artifacts_read
on public.crm_ai_artifacts for select to authenticated
using (
  public.current_has_company_module_permission('crm', 'read')
  and (
    created_by_person_id = public.current_person_id()
    or public.current_has_company_module_permission('crm', 'admin')
  )
);

create index if not exists crm_forecast_snapshots_owner_fk_idx
  on public.crm_forecast_snapshots(owner_person_id);
create index if not exists crm_forecast_snapshots_captured_by_fk_idx
  on public.crm_forecast_snapshots(captured_by_person_id);
create index if not exists crm_stage_requirements_created_by_fk_idx
  on public.crm_stage_requirements(created_by_person_id);
create index if not exists crm_stage_requirements_updated_by_fk_idx
  on public.crm_stage_requirements(updated_by_person_id);
create index if not exists crm_sales_assets_created_by_fk_idx
  on public.crm_sales_assets(created_by_person_id);
create index if not exists crm_sales_assets_approved_by_fk_idx
  on public.crm_sales_assets(approved_by_person_id)
  where approved_by_person_id is not null;
create index if not exists crm_relationship_intelligence_company_fk_idx
  on public.crm_relationship_intelligence(company_id)
  where company_id is not null;
create index if not exists crm_relationship_intelligence_lead_fk_idx
  on public.crm_relationship_intelligence(lead_id)
  where lead_id is not null;
create index if not exists crm_relationship_intelligence_created_by_fk_idx
  on public.crm_relationship_intelligence(created_by_person_id);
create index if not exists crm_relationship_intelligence_reviewed_by_fk_idx
  on public.crm_relationship_intelligence(reviewed_by_person_id)
  where reviewed_by_person_id is not null;
create index if not exists crm_ai_artifacts_company_fk_idx
  on public.crm_ai_artifacts(company_id)
  where company_id is not null;
create index if not exists crm_ai_artifacts_lead_fk_idx
  on public.crm_ai_artifacts(lead_id)
  where lead_id is not null;
create index if not exists crm_ai_artifacts_created_by_fk_idx
  on public.crm_ai_artifacts(created_by_person_id);
create index if not exists crm_ai_artifacts_reviewed_by_fk_idx
  on public.crm_ai_artifacts(reviewed_by_person_id)
  where reviewed_by_person_id is not null;

create or replace function public.crm_capture_forecast_snapshot(
  p_captured_by_person_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot_week date := date_trunc('week', now())::date;
  v_inserted integer;
begin
  delete from public.crm_forecast_snapshots
  where snapshot_week = v_snapshot_week;

  insert into public.crm_forecast_snapshots (
    snapshot_week,
    owner_person_id,
    category,
    deal_count,
    total_value,
    weighted_value,
    captured_by_person_id,
    captured_at
  )
  select
    v_snapshot_week,
    deal.owner_person_id,
    deal.forecast_category,
    count(*)::integer,
    sum(deal.value_estimate),
    sum(deal.value_estimate * deal.probability / 100.0),
    p_captured_by_person_id,
    now()
  from public.crm_deals deal
  where deal.status = 'open'
    and deal.archived_at is null
  group by deal.owner_person_id, deal.forecast_category;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.crm_capture_forecast_snapshot(uuid)
from public, anon, authenticated;
grant execute on function public.crm_capture_forecast_snapshot(uuid)
to service_role;

comment on function public.crm_capture_forecast_snapshot(uuid) is
'Service-only function that atomically replaces the current weekly forecast so empty owner/category groups cannot remain stale. The API authorizes the CRM administrator and supplies the captured-by person.';

commit;
