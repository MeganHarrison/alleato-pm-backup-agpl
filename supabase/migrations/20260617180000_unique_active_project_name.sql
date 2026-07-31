-- Guardrail: prevent duplicate ACTIVE project names.
--
-- Why: project routing for Acumatica financial sync and the
-- `set_project_id_from_title()` document trigger matches incoming data by
-- project NAME. Two active projects sharing a name silently split their
-- incoming documents/financials between them (see the Westfield #1068->#43
-- incident and the Aspire Kissimmee Gardens #798/#25117 cancelled-twin case).
--
-- A partial unique index on the normalized name scoped to non-archived rows
-- makes a second active project with the same name impossible to create,
-- while still allowing archived duplicates (e.g. cancelled Acumatica twins)
-- to coexist as historical tombstones.
--
-- Pre-req handled before this migration: the one existing active duplicate
-- pair ("Aspire Kissimmee Gardens" #798/#25117) was resolved by merging the
-- misrouted documents into the canonical active project #25117 and archiving
-- the cancelled-twin #798. After that, zero active duplicate names remained.

CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_active_name
  ON public.projects (lower(trim(name)))
  WHERE coalesce(archived, false) = false;
