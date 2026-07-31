-- Reconcile linked Outlook surfaces after project attribution hardening.
-- If document_metadata already has a project and no active subject/title rule
-- points to a different project, use that document project as the canonical
-- assignment for the linked outlook_email_intake and project_emails rows.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

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
      'migration', '20260512194000_reconcile_linked_outlook_project_surfaces',
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

update public.project_emails pe
set
  project_id = r.document_metadata_project_id,
  updated_at = now()
from tmp_linked_outlook_project_reconciliation r
where pe.id = r.project_email_id
  and pe.project_id is distinct from r.document_metadata_project_id;

commit;
