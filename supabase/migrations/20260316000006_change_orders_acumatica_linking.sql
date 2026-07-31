-- Enable Acumatica change orders to project into domain change order tables.

-- 1. prime_contract_change_orders: add project_id for direct filtering
--    (current schema requires joining through contracts table which may not exist)
ALTER TABLE public.prime_contract_change_orders
  ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS acumatica_external_key TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_prime_contract_change_orders_project_id
  ON public.prime_contract_change_orders (project_id)
  WHERE project_id IS NOT NULL;
-- 2. contract_change_orders (Commitments tab): add acumatica linkage
ALTER TABLE public.contract_change_orders
  ADD COLUMN IF NOT EXISTS acumatica_external_key TEXT UNIQUE;
