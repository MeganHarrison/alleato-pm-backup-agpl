-- Proactively seed deterministic attribution rules from the active Projects
-- table. This adds:
-- - exact project numbers
-- - full project-name phrases
-- - distinctive single-word project terms that occur on only one active project
--
-- Generic/repeated words stay out of the matrix so they do not create false
-- positives across portfolio/project-family names.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

with stop_words(word) as (
  values
    ('addition'), ('academy'), ('apartments'), ('based'), ('beauty'),
    ('center'), ('code'), ('cold'), ('collective'), ('commons'), ('company'),
    ('contract'), ('curb'), ('cut'), ('dallas'), ('door'), ('electrical'),
    ('excel'), ('exotec'), ('fire'), ('foundations'), ('geotech'), ('group'),
    ('homes'), ('internal'), ('lasik'), ('leads'), ('office'), ('ops'),
    ('permit'), ('permitting'), ('phase'), ('pioneer'), ('project'), ('road'),
    ('sedc'), ('sprinkler'), ('storage'), ('store'), ('temp'), ('temporary'),
    ('the'), ('warehouse'), ('weekly')
),
active_projects as (
  select
    id,
    name,
    project_number,
    regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g') as normalized_name
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
    'phrase'::text as rule_type,
    trim(project_number) as pattern,
    0.995::numeric as confidence,
    5::integer as priority,
    'Exact active project number from Projects table.'::text as notes
  from active_projects
  where nullif(trim(coalesce(project_number, '')), '') is not null
),
full_name_rules as (
  select
    id as project_id,
    'phrase'::text as rule_type,
    trim(name) as pattern,
    0.985::numeric as confidence,
    20::integer as priority,
    'Full active project name from Projects table.'::text as notes
  from active_projects
  where length(trim(name)) >= 6
),
tokens as (
  select
    id as project_id,
    name,
    token
  from active_projects
  cross join lateral regexp_split_to_table(normalized_name, '\s+') as token
  where length(token) >= 4
    and token !~ '^[0-9]+$'
    and token not in (select word from stop_words)
),
unique_tokens as (
  select token
  from tokens
  group by token
  having count(distinct project_id) = 1
),
keyword_rules as (
  select distinct
    tokens.project_id,
    'keyword'::text as rule_type,
    initcap(tokens.token) as pattern,
    0.970::numeric as confidence,
    40::integer as priority,
    'Unique distinctive project-name token from active Projects table.'::text as notes
  from tokens
  join unique_tokens on unique_tokens.token = tokens.token
),
seeded_rules as (
  select * from project_number_rules
  union all
  select * from full_name_rules
  union all
  select * from keyword_rules
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
  'projects_table_auto_seed',
  notes
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
