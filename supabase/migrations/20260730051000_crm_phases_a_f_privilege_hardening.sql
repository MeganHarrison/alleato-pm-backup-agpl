begin;

revoke delete on
  public.crm_microsoft_connections,
  public.crm_forecast_snapshots,
  public.crm_stage_requirements,
  public.crm_sales_assets,
  public.crm_relationship_intelligence,
  public.crm_ai_artifacts
from authenticated;

comment on table public.crm_sales_assets is
'Governed cadences, playbooks, and templates are retired rather than deleted so approvals remain auditable.';

commit;
