-- Ensure acumatica_subcontracts can store both:
-- 1) Acumatica vendor code
-- 2) Local vendors table UUID linkage

ALTER TABLE public.acumatica_subcontracts
  ADD COLUMN IF NOT EXISTS vendor_acumatica_id TEXT,
  ADD COLUMN IF NOT EXISTS vendor_uuid UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
-- Backfill from legacy vendor_id text field (Acumatica vendor code)
UPDATE public.acumatica_subcontracts
SET vendor_acumatica_id = vendor_id
WHERE vendor_acumatica_id IS NULL
  AND vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS acumatica_subcontracts_vendor_acumatica_id_idx
  ON public.acumatica_subcontracts (vendor_acumatica_id);
CREATE INDEX IF NOT EXISTS acumatica_subcontracts_vendor_uuid_idx
  ON public.acumatica_subcontracts (vendor_uuid);
