update public.tasks
set
  extraction_source = case
    when assigned_by ilike '%brandon%' then 'legacy_brandon_extraction'
    when source_system in ('microsoft_teams', 'teams_dm_conversation', 'teams_dm', 'teams_message') then 'legacy_teams_extraction'
    when source_system in ('outlook_email', 'email') then 'legacy_email_extraction'
    else 'legacy_task_extraction'
  end,
  extraction_model = 'legacy_untracked',
  extraction_prompt_version = 'legacy_untracked',
  extraction_metadata = coalesce(extraction_metadata, '{}'::jsonb) || jsonb_build_object(
    'audit_backfilled_at', now(),
    'audit_backfill_reason', 'Task rows predated extractor model/source audit columns.'
  )
where extraction_source is null
  or extraction_model is null
  or extraction_prompt_version is null;
