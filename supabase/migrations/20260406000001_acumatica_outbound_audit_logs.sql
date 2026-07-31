-- Outbound Acumatica export audit log
-- Tracks each create/update/skip/error attempt for app -> Acumatica exports.

CREATE TABLE IF NOT EXISTS public.acumatica_outbound_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL,
  triggered_by_user_id UUID,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contract_id UUID,
  entity_name TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_reference TEXT,
  acumatica_entity TEXT NOT NULL,
  acumatica_reference TEXT,
  acumatica_doc_type TEXT,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'skip', 'error')),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acu_outbound_audit_run_id
  ON public.acumatica_outbound_audit_logs (run_id);
CREATE INDEX IF NOT EXISTS idx_acu_outbound_audit_project_created
  ON public.acumatica_outbound_audit_logs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acu_outbound_audit_entity_created
  ON public.acumatica_outbound_audit_logs (entity_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acu_outbound_audit_success
  ON public.acumatica_outbound_audit_logs (success, created_at DESC);
