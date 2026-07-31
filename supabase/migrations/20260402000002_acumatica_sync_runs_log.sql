-- Acumatica financial sync run history log
-- Keeps an immutable audit trail for each entity run (success/failure) so
-- operations can verify cadence and troubleshoot issues.

CREATE TABLE IF NOT EXISTS public.acumatica_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  entity_name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  cursor TIMESTAMPTZ,
  fetched INTEGER,
  upserted INTEGER,
  projected INTEGER,
  skipped INTEGER,
  errors INTEGER,
  error_message TEXT,
  stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acumatica_sync_runs_entity_name_idx
  ON public.acumatica_sync_runs (entity_name);
CREATE INDEX IF NOT EXISTS acumatica_sync_runs_started_at_desc_idx
  ON public.acumatica_sync_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS acumatica_sync_runs_entity_started_at_desc_idx
  ON public.acumatica_sync_runs (entity_name, started_at DESC);
