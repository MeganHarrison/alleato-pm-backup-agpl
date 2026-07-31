-- Create a reusable reconciliation function for linked Outlook project
-- surfaces. This prevents the repair from living only as one-time migration
-- SQL and gives ops/cron/API code one safe server-side primitive to call.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create or replace function public.reconcile_outlook_project_surfaces()
returns table (
  intake_rows_updated integer,
  project_email_rows_updated integer,
  document_metadata_rows_updated integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intake_rows integer := 0;
  v_project_email_rows integer := 0;
  v_document_rows integer := 0;
begin
  create temporary table tmp_linked_outlook_project_reconciliation on commit drop as
  with linked_rows as (
    select
      e.id as outlook_email_intake_id,
      e.project_email_id,
      e.document_metadata_id,
      e.subject,
      e.project_id as intake_project_id,
      pe.project_id as project_email_project_id,
      dm.project_id as document_metadata_project_id,
      regexp_replace(lower(coalesce(e.subject, '')), '[^a-z0-9@.]+', ' ', 'g') as normalized_subject
    from public.outlook_email_intake e
    left join public.project_emails pe on pe.id = e.project_email_id
    join public.document_metadata dm on dm.id = e.document_metadata_id
    where e.deleted_at is null
      and dm.project_id is not null
      and (
        e.project_id is distinct from dm.project_id
        or (pe.id is not null and pe.project_id is distinct from dm.project_id)
      )
  ),
  subject_rule_conflicts as (
    select distinct linked_rows.outlook_email_intake_id
    from linked_rows
    join public.project_attribution_rules r
      on r.status = 'active'
     and r.rule_type = 'title_keyword'
     and (' ' || linked_rows.normalized_subject || ' ') like ('% ' || r.pattern_normalized || ' %')
     and r.project_id <> linked_rows.document_metadata_project_id
  )
  select linked_rows.*
  from linked_rows
  where not exists (
    select 1
    from subject_rule_conflicts
    where subject_rule_conflicts.outlook_email_intake_id = linked_rows.outlook_email_intake_id
  );

  update public.outlook_email_intake e
  set
    project_id = r.document_metadata_project_id,
    assignment_method = 'linked_document_metadata_reconciliation',
    assignment_confidence = greatest(coalesce(e.assignment_confidence, 0), 0.95),
    match_status = 'matched',
    source_metadata = jsonb_set(
      coalesce(e.source_metadata, '{}'::jsonb),
      '{linked_surface_reconciliation}',
      jsonb_build_object(
        'function', 'reconcile_outlook_project_surfaces',
        'previous_project_id', e.project_id,
        'document_metadata_project_id', r.document_metadata_project_id,
        'applied_at', now()
      ),
      true
    ),
    updated_at = now()
  from tmp_linked_outlook_project_reconciliation r
  where e.id = r.outlook_email_intake_id
    and e.project_id is distinct from r.document_metadata_project_id;

  get diagnostics v_intake_rows = row_count;

  update public.project_emails pe
  set
    project_id = r.document_metadata_project_id,
    updated_at = now()
  from tmp_linked_outlook_project_reconciliation r
  where pe.id = r.project_email_id
    and pe.project_id is distinct from r.document_metadata_project_id;

  get diagnostics v_project_email_rows = row_count;

  update public.document_metadata dm
  set
    project_id = e.project_id,
    project = p.name
  from public.outlook_email_intake e
  left join public.project_emails pe on pe.id = e.project_email_id
  join public.projects p on p.id = e.project_id
  where dm.id = e.document_metadata_id
    and dm.project_id is null
    and e.project_id is not null
    and (
      pe.id is null
      or pe.project_id = e.project_id
    );

  get diagnostics v_document_rows = row_count;

  return query select v_intake_rows, v_project_email_rows, v_document_rows;
end;
$$;

select * from public.reconcile_outlook_project_surfaces();

commit;
