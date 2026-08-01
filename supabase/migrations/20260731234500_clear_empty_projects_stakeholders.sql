-- Clear the placeholder empty-array value from projects.stakeholders.
--
-- Every row in `projects` carried `'[]'::jsonb` because that was the column
-- default, so the field rendered as a meaningless "[]" everywhere it surfaced
-- while holding no data. An empty field should hold NULL and render nothing.
--
-- Guardrail: the column default is dropped in the same migration, otherwise
-- every newly inserted project immediately reintroduces `[]` and this cleanup
-- silently rots.
--
-- Safety: the only consumer is
-- backend/src/services/ingestion/project_assignment.py:749, which reads
-- `project.get("stakeholders") or []` — NULL-safe.

update public.projects
set stakeholders = null
where stakeholders = '[]'::jsonb;

alter table public.projects
  alter column stakeholders drop default;
