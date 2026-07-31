-- Structured per-finding evidence (e.g. the AP bill copies behind a duplicate),
-- so the UI can show a side-by-side comparison without re-querying Acumatica.
alter table public.reconciliation_findings add column if not exists evidence jsonb;
