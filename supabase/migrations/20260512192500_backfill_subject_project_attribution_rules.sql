-- Backfill existing Outlook/project email/document rows using the corrected
-- subject-only project attribution rules. This repairs rows where the subject
-- already contains a project number, full project name, or curated distinctive
-- project term but contact overlap previously assigned the wrong project.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create temporary table tmp_subject_project_rule_matches on commit drop as
with normalized_emails as (
  select
    e.id as outlook_email_intake_id,
    e.project_email_id,
    e.document_metadata_id,
    e.project_id as current_project_id,
    regexp_replace(lower(coalesce(e.subject, '')), '[^a-z0-9@.]+', ' ', 'g') as normalized_subject
  from public.outlook_email_intake e
  where e.deleted_at is null
    and nullif(trim(coalesce(e.subject, '')), '') is not null
),
matches as (
  select
    e.outlook_email_intake_id,
    e.project_email_id,
    e.document_metadata_id,
    e.current_project_id,
    r.project_id,
    r.pattern,
    r.confidence,
    r.priority
  from normalized_emails e
  join public.project_attribution_rules r
    on r.status = 'active'
   and r.rule_type = 'title_keyword'
   and (' ' || e.normalized_subject || ' ') like ('% ' || r.pattern_normalized || ' %')
),
ranked as (
  select
    matches.*,
    row_number() over (
      partition by outlook_email_intake_id
      order by confidence desc, priority asc, project_id asc
    ) as rn
  from matches
),
best_matches as (
  select ranked.*
  from ranked
  where rn = 1
    and not exists (
      select 1
      from matches tied
      where tied.outlook_email_intake_id = ranked.outlook_email_intake_id
        and tied.project_id <> ranked.project_id
        and tied.confidence = ranked.confidence
    )
)
select *
from best_matches
where current_project_id is distinct from project_id;

update public.outlook_email_intake e
set
  project_id = m.project_id,
  assignment_method = 'attribution_rule:title_keyword_backfill',
  assignment_confidence = m.confidence,
  match_status = 'matched',
  source_metadata = jsonb_set(
    coalesce(e.source_metadata, '{}'::jsonb),
    '{project_attribution_backfill}',
    jsonb_build_object(
      'migration', '20260512192500_backfill_subject_project_attribution_rules',
      'rule_type', 'title_keyword',
      'matched_pattern', m.pattern,
      'previous_project_id', e.project_id,
      'applied_at', now()
    ),
    true
  ),
  updated_at = now()
from tmp_subject_project_rule_matches m
where e.id = m.outlook_email_intake_id;

update public.project_emails pe
set
  project_id = m.project_id,
  updated_at = now()
from tmp_subject_project_rule_matches m
where pe.id = m.project_email_id
  and pe.project_id is distinct from m.project_id;

update public.document_metadata dm
set
  project_id = m.project_id,
  project = p.name
from tmp_subject_project_rule_matches m
join public.projects p on p.id = m.project_id
where dm.id = m.document_metadata_id
  and dm.project_id is distinct from m.project_id;

commit;
