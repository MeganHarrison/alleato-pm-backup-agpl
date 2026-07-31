-- Weekly progress reports get an internal-only notes section (the "dirt": our
-- risk assessment, contract-strategy, client-relationship concerns). The client
-- audience view omits it; the internal audience view includes it. Populated by
-- the daily deep-read assembler from projectRecords.activeRisks. Additive/nullable.
alter table public.project_progress_reports
  add column if not exists internal_notes text;

comment on column public.project_progress_reports.internal_notes is
  'Internal-only notes (risks/contract strategy/client-relationship). Shown only in the internal audience view of the report, never the client view.';
