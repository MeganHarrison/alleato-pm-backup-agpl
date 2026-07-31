-- Recreate `project_health_dashboard` view, now backed by Pipeline B
-- (`insight_cards` + `intelligence_targets`) instead of the dropped
-- `ai_insights` table.
--
-- The view was dropped in 20260515080000_drop_pipeline_a_intelligence.sql.
-- Three consumers still need it (daily-flags cron and two AI tools), so
-- rather than rewrite each callsite around inline aggregations, we
-- restore the same column contract from the new source of truth.
--
-- Columns kept identical (callers depend on them):
--   id, name, current_phase, completion_percentage, health_score, health_status,
--   summary, summary_updated_at, budget_utilization, total_insights_count,
--   open_critical_items, recent_documents_count, last_document_date.
--
-- Definitions:
--   total_insights_count — every non-rejected, non-resolved insight card
--                          linked to the project via intelligence_targets.
--   open_critical_items  — high-confidence cards in risk-bucket card types
--                          (risk, blocker, financial_exposure, schedule_risk)
--                          that are open or blocked.
--
-- Recent-documents counts now read from `document_metadata` (Pipeline B's
-- raw source layer) instead of the legacy `documents` table.

create or replace view public.project_health_dashboard as
select
  p.id,
  p.name,
  p.current_phase,
  p.completion_percentage,
  p.health_score,
  p.health_status,
  p.summary,
  p.summary_updated_at,
  case
    when p.budget is not null and p.budget > 0 and p.budget_used is not null
      then (p.budget_used::numeric / p.budget::numeric) * 100::numeric
    else 0::numeric
  end as budget_utilization,
  p."est completion",
  (
    select count(*)
    from public.insight_cards ic
    join public.intelligence_targets it on it.id = ic.primary_target_id
    where it.project_id = p.id
      and it.target_type = 'client_project'
      and ic.attribution_status != 'rejected'
      and ic.current_status != 'resolved'
  ) as total_insights_count,
  (
    select count(*)
    from public.insight_cards ic
    join public.intelligence_targets it on it.id = ic.primary_target_id
    where it.project_id = p.id
      and it.target_type = 'client_project'
      and ic.attribution_status != 'rejected'
      and ic.current_status in ('open', 'blocked')
      and ic.confidence = 'high'
      and ic.card_type in ('risk', 'blocker', 'financial_exposure', 'schedule_risk')
  ) as open_critical_items,
  (
    select count(*)
    from public.document_metadata dm
    where dm.project_id = p.id
      and dm.created_at > (now() - interval '30 days')
  ) as recent_documents_count,
  (
    select max(dm.created_at::date)
    from public.document_metadata dm
    where dm.project_id = p.id
  ) as last_document_date
from public.projects p
where p.name is not null
order by
  case when p.health_score is null then 999::numeric else p.health_score end;

comment on view public.project_health_dashboard is
  'Project-level KPIs + insight card counts. Backed by insight_cards + intelligence_targets (Pipeline B) after the 2026-05-15 migration.';
