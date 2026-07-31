-- Correct the proactive Projects-table attribution seed so generated terms do
-- not match body/signature/location boilerplate. Project numbers, full project
-- names, and curated distinctive tokens from the Projects table should be
-- subject/title signals unless a stronger manual rule explicitly says
-- otherwise.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

update public.project_attribution_rules
set
  status = 'inactive',
  notes = concat_ws(
    ' ',
    nullif(notes, ''),
    'Deactivated by 20260512191500: broad Projects-table auto terms are replaced with title-only rules to prevent body/signature false positives.'
  ),
  updated_at = now()
where source = 'projects_table_auto_seed'
  and status = 'active';

with active_projects as (
  select
    id,
    name,
    project_number
  from public.projects
  where coalesce(archived, false) = false
    and nullif(trim(name), '') is not null
    and lower(name) not like 'test%'
    and lower(name) not like 'qa %'
    and lower(name) not like 'temporary project%'
),
project_number_rules as (
  select
    id as project_id,
    trim(project_number) as pattern,
    0.995::numeric as confidence,
    5::integer as priority,
    'Exact active project number from Projects table; subject/title only.'::text as notes
  from active_projects
  where nullif(trim(coalesce(project_number, '')), '') is not null
),
full_name_rules as (
  select
    id as project_id,
    trim(name) as pattern,
    0.985::numeric as confidence,
    20::integer as priority,
    'Full active project name from Projects table; subject/title only.'::text as notes
  from active_projects
  where length(trim(name)) >= 6
),
curated_keyword_rules(project_id, pattern, confidence, priority, notes) as (
  values
    (31, 'Uniqlo', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (31, 'Phillipsburg', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (38, 'Niemann', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (43, 'Westfield', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (53, 'Crate', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (53, 'Escapes', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (67, 'Vermillion', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (88, 'Arcedge', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (98, 'Seminole', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (754, 'Allisonville', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (760, 'Wilmer', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (761, 'Fresno', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (765, 'Shelbyville', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (766, 'Forza', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (793, 'Brownsburg', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (801, 'Allentown', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (808, 'Pepsi', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (810, 'Bella', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (817, 'Tecova', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (821, 'Hebron', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (822, 'Pratt Whitney', 0.980::numeric, 30, 'Curated distinctive Projects-table phrase; subject/title only.'),
    (827, 'Lakeshore', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (833, 'Roebling', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (837, 'Coram Deo', 0.980::numeric, 30, 'Curated distinctive Projects-table phrase; subject/title only.'),
    (839, 'Hiro', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (840, 'Decatur', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (842, 'Shadeland', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (877, 'Brookville', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (1008, 'Champaign', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (1015, 'Varsity', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (1016, 'Kokomo', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (24113, 'Daytona', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (25102, 'Lucie', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (25108, 'Tremont', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (25113, 'Martinsville', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.'),
    (25125, 'Noblesville', 0.970::numeric, 35, 'Curated distinctive Projects-table token; subject/title only.')
),
raw_seeded_rules as (
  select * from project_number_rules
  union all
  select * from full_name_rules
  union all
  select * from curated_keyword_rules
),
seeded_rules as (
  select
    project_id,
    min(pattern) as pattern,
    max(confidence) as confidence,
    min(priority) as priority,
    string_agg(distinct notes, ' ') as notes
  from raw_seeded_rules
  group by
    project_id,
    regexp_replace(lower(pattern), '[^a-z0-9@.]+', ' ', 'g')
)
insert into public.project_attribution_rules (
  project_id,
  rule_type,
  pattern,
  pattern_normalized,
  confidence,
  priority,
  source,
  notes,
  status
)
select
  project_id,
  'title_keyword',
  pattern,
  regexp_replace(lower(pattern), '[^a-z0-9@.]+', ' ', 'g'),
  confidence,
  priority,
  'projects_table_subject_seed',
  notes,
  'active'
from seeded_rules
where nullif(trim(pattern), '') is not null
on conflict (project_id, rule_type, pattern_normalized) do update
set
  pattern = excluded.pattern,
  confidence = greatest(public.project_attribution_rules.confidence, excluded.confidence),
  priority = least(public.project_attribution_rules.priority, excluded.priority),
  source = excluded.source,
  notes = excluded.notes,
  status = 'active',
  updated_at = now();

commit;
