-- Backfill existing communication rows that now match deterministic project
-- attribution rules. Future syncs use the same matrix in application code.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

with doc_rule_hits as (
  select
    dm.id as document_metadata_id,
    dm.project_id as current_project_id,
    r.project_id as rule_project_id,
    r.rule_type,
    r.pattern,
    r.confidence,
    r.priority,
    row_number() over (
      partition by dm.id
      order by r.confidence desc, r.priority asc, length(r.pattern) desc, r.project_id asc
    ) as rank
  from public.document_metadata dm
  join public.project_attribution_rules r
    on r.status = 'active'
   and (
    (
      r.rule_type in ('keyword', 'phrase', 'title_keyword')
      and lower(
        coalesce(dm.title, '') || ' ' ||
        coalesce(dm.content, '') || ' ' ||
        coalesce(dm.summary, '') || ' ' ||
        coalesce(dm.overview, '') || ' ' ||
        coalesce(dm.participants, '') || ' ' ||
        coalesce(dm.participants_array::text, '')
      ) like '%' || lower(r.pattern) || '%'
    )
    or (
      r.rule_type = 'email'
      and lower(
        coalesce(dm.participants, '') || ' ' ||
        coalesce(dm.participants_array::text, '') || ' ' ||
        coalesce(dm.organizer_email, '') || ' ' ||
        coalesce(dm.host_email, '')
      ) like '%' || lower(r.pattern) || '%'
    )
   )
  where dm.source in ('microsoft_graph', 'fireflies')
    and dm.category in ('email', 'meeting', 'teams_message', 'document')
),
best_doc_hits as (
  select *
  from doc_rule_hits
  where rank = 1
    and current_project_id is distinct from rule_project_id
),
updated_docs as (
  update public.document_metadata dm
  set
    project_id = hit.rule_project_id,
    project = p.name,
    tags = case
      when coalesce(dm.tags, '') = '' then 'project_repair:attribution_rule_backfill'
      when position('project_repair:attribution_rule_backfill' in dm.tags) > 0 then dm.tags
      else dm.tags || ',project_repair:attribution_rule_backfill'
    end
  from best_doc_hits hit
  join public.projects p on p.id = hit.rule_project_id
  where dm.id = hit.document_metadata_id
  returning dm.id, hit.rule_project_id, p.name, hit.rule_type, hit.pattern, hit.confidence
),
intake_rule_hits as (
  select
    oi.id as intake_id,
    oi.project_id as current_project_id,
    oi.project_email_id,
    oi.document_metadata_id,
    r.project_id as rule_project_id,
    r.rule_type,
    r.pattern,
    r.confidence,
    r.priority,
    row_number() over (
      partition by oi.id
      order by r.confidence desc, r.priority asc, length(r.pattern) desc, r.project_id asc
    ) as rank
  from public.outlook_email_intake oi
  join public.project_attribution_rules r
    on r.status = 'active'
   and (
    (
      r.rule_type in ('keyword', 'phrase', 'title_keyword')
      and lower(
        coalesce(oi.subject, '') || ' ' ||
        coalesce(oi.body_text, '') || ' ' ||
        coalesce(oi.body, '')
      ) like '%' || lower(r.pattern) || '%'
    )
    or (
      r.rule_type = 'email'
      and lower(
        coalesce(oi.from_email, '') || ' ' ||
        coalesce(oi.to_list::text, '') || ' ' ||
        coalesce(oi.cc_list::text, '')
      ) like '%' || lower(r.pattern) || '%'
    )
   )
),
best_intake_hits as (
  select *
  from intake_rule_hits
  where rank = 1
    and current_project_id is distinct from rule_project_id
),
updated_intake as (
  update public.outlook_email_intake oi
  set
    project_id = hit.rule_project_id,
    match_status = 'matched',
    status = 'Matched',
    assignment_method = 'attribution_rule:' || hit.rule_type,
    assignment_confidence = hit.confidence,
    updated_at = now()
  from best_intake_hits hit
  where oi.id = hit.intake_id
  returning oi.id, hit.project_email_id, hit.document_metadata_id, hit.rule_project_id, hit.rule_type, hit.pattern, hit.confidence
),
updated_project_emails as (
  update public.project_emails pe
  set
    project_id = updated_intake.rule_project_id,
    updated_at = now()
  from updated_intake
  where pe.id = updated_intake.project_email_id
  returning pe.id
),
updated_linked_docs as (
  update public.document_metadata dm
  set
    project_id = updated_intake.rule_project_id,
    project = p.name,
    tags = case
      when coalesce(dm.tags, '') = '' then 'project_repair:attribution_rule_backfill'
      when position('project_repair:attribution_rule_backfill' in dm.tags) > 0 then dm.tags
      else dm.tags || ',project_repair:attribution_rule_backfill'
    end
  from updated_intake
  join public.projects p on p.id = updated_intake.rule_project_id
  where dm.id = updated_intake.document_metadata_id
    and dm.project_id is distinct from updated_intake.rule_project_id
  returning dm.id
),
updated_jobs as (
  update public.source_intelligence_jobs job
  set
    project_id = coalesce(updated_intake.rule_project_id, updated_docs.rule_project_id),
    updated_at = now()
  from (
    select id as source_document_id, rule_project_id from updated_docs
    union all
    select document_metadata_id as source_document_id, rule_project_id from updated_intake where document_metadata_id is not null
  ) fixed
  left join updated_intake on updated_intake.document_metadata_id = fixed.source_document_id
  left join updated_docs on updated_docs.id = fixed.source_document_id
  where job.source_document_id = fixed.source_document_id
  returning job.id
)
insert into public.document_attribution_candidates (
  source_document_id,
  candidate_project_id,
  candidate_project_name,
  confidence,
  attribution_method,
  evidence_terms,
  reasoning,
  status
)
select
  fixed.source_document_id,
  fixed.rule_project_id,
  p.name,
  fixed.confidence,
  'data_repair:attribution_rule_backfill',
  array[fixed.pattern],
  'Corrected existing communication project attribution using deterministic project_attribution_rules.',
  'auto_assigned'
from (
  select id as source_document_id, rule_project_id, pattern, confidence from updated_docs
  union all
  select document_metadata_id as source_document_id, rule_project_id, pattern, confidence
  from updated_intake
  where document_metadata_id is not null
) fixed
join public.projects p on p.id = fixed.rule_project_id
on conflict do nothing;

commit;
