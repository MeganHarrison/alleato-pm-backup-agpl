-- Drop PM APP tables that are now either RAG-owned duplicates or legacy
-- unused rollups with no runtime owner.

drop view if exists public.project_risk_deteriorating;
drop view if exists public.project_risk_current;

drop table if exists public.source_sync_health_snapshots;
drop table if exists public.project_risk_snapshots;
