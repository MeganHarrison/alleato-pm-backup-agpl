-- Add a durable project attribution matrix, seed known deterministic mappings,
-- and reconcile the known split-brain Outlook thread that was written to
-- project_emails/outlook_email_intake before document_metadata was corrected.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.project_attribution_rules (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  rule_type text not null check (rule_type in ('keyword', 'phrase', 'title_keyword', 'email', 'domain')),
  pattern text not null,
  pattern_normalized text not null,
  confidence numeric(4, 3) not null default 0.95 check (confidence >= 0 and confidence <= 1),
  priority integer not null default 100,
  source text not null default 'manual',
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, rule_type, pattern_normalized)
);

comment on table public.project_attribution_rules is
  'Deterministic project attribution matrix for communications ingestion. These rules are evidence for matching; they do not grant project access.';

create index if not exists idx_project_attribution_rules_status_priority
  on public.project_attribution_rules (status, priority, confidence desc);

create index if not exists idx_project_attribution_rules_project
  on public.project_attribution_rules (project_id);

with ranked_refs as (
  select
    id,
    row_number() over (
      partition by project_id, person_id, reference_type, coalesce(source_document_metadata_id, '')
      order by
        case when status = 'active' then 0 else 1 end,
        coalesce(confidence, 0) desc,
        created_at asc,
        id asc
    ) as keep_rank
  from public.project_contact_references
)
delete from public.project_contact_references pcr
using ranked_refs ranked
where pcr.id = ranked.id
  and ranked.keep_rank > 1;

create unique index if not exists uq_project_contact_refs_one_active_null_source
  on public.project_contact_references (project_id, person_id, reference_type)
  where source_document_metadata_id is null
    and status = 'active';

create unique index if not exists uq_project_contact_refs_one_active_source
  on public.project_contact_references (project_id, person_id, reference_type, source_document_metadata_id)
  where source_document_metadata_id is not null
    and status = 'active';

with seeded_rules(project_id, rule_type, pattern, confidence, priority, notes) as (
  values
    (67, 'keyword', 'Hillsdale', 0.990::numeric, 10, 'User-specified mapping: any communication containing Hillsdale belongs to Vermillion Rise.'),
    (67, 'email', 'mferderer@ferdimation.com', 0.990::numeric, 10, 'Owner email for Vermillion Rise / Hillsdale.'),
    (178, 'phrase', 'Superior Beverage Product on Tray', 0.990::numeric, 20, 'Known Superior Beverage thread subject.'),
    (178, 'keyword', 'Superior Beverage', 0.970::numeric, 30, 'Known Superior Beverage project signal.')
)
insert into public.project_attribution_rules (
  project_id,
  rule_type,
  pattern,
  pattern_normalized,
  confidence,
  priority,
  source,
  notes
)
select
  project_id,
  rule_type,
  pattern,
  regexp_replace(lower(pattern), '[^a-z0-9@.]+', ' ', 'g'),
  confidence,
  priority,
  'manual_seed',
  notes
from seeded_rules
on conflict (project_id, rule_type, pattern_normalized) do update
set
  pattern = excluded.pattern,
  confidence = excluded.confidence,
  priority = excluded.priority,
  source = excluded.source,
  notes = excluded.notes,
  status = 'active',
  updated_at = now();

update public.companies
set
  contact_email = 'mferderer@ferdimation.com',
  contact_name = coalesce(nullif(contact_name, ''), 'Michael Federer'),
  website = coalesce(nullif(website, ''), 'https://ferdimation.com'),
  updated_at = now()
where id = 'a5a49139-44dc-4be4-9d48-3f293798579e';

update public.people
set
  first_name = 'Michael',
  last_name = 'Federer',
  company_id = 'a5a49139-44dc-4be4-9d48-3f293798579e',
  person_type = coalesce(nullif(person_type, ''), 'External'),
  status = 'active',
  updated_at = now()
where lower(email) = 'mferderer@ferdimation.com';

update public.companies
set
  primary_contact_id = (
    select id
    from public.people
    where lower(email) = 'mferderer@ferdimation.com'
    limit 1
  ),
  updated_at = now()
where id = 'a5a49139-44dc-4be4-9d48-3f293798579e'
  and exists (
    select 1
    from public.people
    where lower(email) = 'mferderer@ferdimation.com'
  );

insert into public.project_companies (
  project_id,
  company_id,
  email_address,
  primary_contact_id,
  company_type,
  status
)
select
  67,
  'a5a49139-44dc-4be4-9d48-3f293798579e',
  'mferderer@ferdimation.com',
  p.id,
  'VENDOR',
  'ACTIVE'
from public.people p
where lower(p.email) = 'mferderer@ferdimation.com'
  and not exists (
    select 1
    from public.project_companies pc
    where pc.project_id = 67
      and pc.company_id = 'a5a49139-44dc-4be4-9d48-3f293798579e'
  );

insert into public.project_contact_references (
  project_id,
  person_id,
  company_id,
  reference_type,
  source_system,
  confidence,
  status
)
select
  67,
  p.id,
  'a5a49139-44dc-4be4-9d48-3f293798579e',
  'manual_reference',
  'project_attribution_rules',
  0.990,
  'active'
from public.people p
where lower(p.email) = 'mferderer@ferdimation.com'
  and not exists (
    select 1
    from public.project_contact_references pcr
    where pcr.project_id = 67
      and pcr.person_id = p.id
      and pcr.reference_type = 'manual_reference'
  );

update public.document_metadata
set
  project_id = 178,
  project = (select name from public.projects where id = 178),
  tags = case
    when coalesce(tags, '') = '' then 'project_repair:superior_beverage_attribution'
    when position('project_repair:superior_beverage_attribution' in tags) > 0 then tags
    else tags || ',project_repair:superior_beverage_attribution'
  end
where category = 'email'
  and title ilike '%Superior Beverage Product on Tray%';

update public.outlook_email_intake
set
  project_id = 178,
  match_status = 'matched',
  status = 'Matched',
  assignment_method = 'document_metadata_reconcile',
  assignment_confidence = 1.0,
  updated_at = now()
where subject ilike '%Superior Beverage Product on Tray%';

update public.project_emails
set
  project_id = 178,
  updated_at = now()
where subject ilike '%Superior Beverage Product on Tray%';

update public.source_intelligence_jobs
set
  project_id = 178,
  updated_at = now()
where source_document_id in (
  select id
  from public.document_metadata
  where category = 'email'
    and title ilike '%Superior Beverage Product on Tray%'
);

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
  dm.id,
  178,
  (select name from public.projects where id = 178),
  1.0,
  'data_repair:document_metadata_reconcile',
  array['Superior Beverage Product on Tray'],
  'Corrected split project attribution where Outlook intake/project_emails retained an earlier contact-overlap assignment after document_metadata was corrected.',
  'auto_assigned'
from public.document_metadata dm
where dm.category = 'email'
  and dm.title ilike '%Superior Beverage Product on Tray%'
on conflict do nothing;

commit;
