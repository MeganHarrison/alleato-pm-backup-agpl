-- Monitoring RPC for the Teams conversation compiler.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create or replace function public.get_teams_compiler_status()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_teams_dm_rows',
      (select count(*) from public.document_metadata where type = 'teams_dm_conversation'),
    'rows_with_overview',
      (select count(*) from public.document_metadata
       where type = 'teams_dm_conversation' and overview is not null and overview <> ''),
    'rows_missing_overview',
      (select count(*) from public.document_metadata
       where type = 'teams_dm_conversation' and (overview is null or overview = '')),
    'rows_with_project_id',
      (select count(*) from public.document_metadata
       where type = 'teams_dm_conversation' and project_id is not null),
    'rows_with_attribution_candidates',
      (select count(distinct source_document_id) from public.document_attribution_candidates),
    'rows_with_insight_cards',
      (select count(distinct source_document_ids[1]) from public.project_insights
       where source_document_ids is not null and array_length(source_document_ids, 1) > 0),
    'rows_failed_compiler',
      (select count(*) from public.document_metadata
       where type = 'teams_dm_conversation' and status = 'error'),
    'rows_compiled',
      (select count(*) from public.document_metadata
       where type = 'teams_dm_conversation' and status = 'compiled'),
    'last_successful_run',
      (select max(captured_at) from public.document_metadata
       where type = 'teams_dm_conversation' and status = 'compiled'),
    'avg_processing_time_ms',
      null
  );
$$;

grant execute on function public.get_teams_compiler_status() to anon, authenticated, service_role;

commit;
