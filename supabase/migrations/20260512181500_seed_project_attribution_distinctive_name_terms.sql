-- Seed obvious distinctive project-name terms into the communication
-- attribution matrix. These are deterministic routing rules, not access grants.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

with seeded_rules(project_id, rule_type, pattern, confidence, priority, notes) as (
  values
    (876, 'keyword', 'Morrisville', 0.990::numeric, 10, 'Distinctive project-name term for Exol Morrisville.'),
    (876, 'phrase', 'Exol Morrisville', 0.990::numeric, 10, 'Full project-name phrase for Exol Morrisville.'),
    (1014, 'keyword', 'NEXCOM', 0.990::numeric, 10, 'Distinctive project-name term for NEXCOM SEDC.'),
    (1014, 'phrase', 'NEXCOM SEDC', 0.990::numeric, 10, 'Full project-name phrase for NEXCOM SEDC.')
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

commit;
