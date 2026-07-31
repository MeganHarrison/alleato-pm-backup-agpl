-- Extend source_sync_runs.stage check constraint to include
-- 'generate_and_send' used by the executive daily brief cron.
--
-- The original constraint in 20260507160000_source_sync_health_observability.sql
-- only covers ingestion pipeline stages. The executive brief runner inserts a
-- run row with stage='generate_and_send' before executing, which violated the
-- constraint and caused both daily-brief crons to fail on every run.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

alter table public.source_sync_runs
  drop constraint if exists source_sync_runs_stage_check;

alter table public.source_sync_runs
  add constraint source_sync_runs_stage_check check (
    stage in (
      'source_sync',
      'delta_fetch',
      'webhook',
      'text_extraction',
      'vectorization',
      'task_extraction',
      'intelligence_compile',
      'packet_refresh',
      'generate_and_send'
    )
  );

commit;
