-- Link Acumatica subcontracts/purchase orders to domain commitment tables.
-- Enables idempotent upsert from acumatica raw tables → subcontracts/purchase_orders.

-- 1. Track vendor UUID on purchase orders (mirrors acumatica_subcontracts.vendor_uuid)
ALTER TABLE public.acumatica_purchase_orders
  ADD COLUMN IF NOT EXISTS vendor_acumatica_id TEXT,
  ADD COLUMN IF NOT EXISTS vendor_uuid UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
-- Backfill vendor_acumatica_id from the legacy vendor_id text column
UPDATE public.acumatica_purchase_orders
SET vendor_acumatica_id = vendor_id
WHERE vendor_acumatica_id IS NULL
  AND vendor_id IS NOT NULL;
-- Backfill vendor_uuid using the vendors table acumatica_vendor_id lookup
UPDATE public.acumatica_purchase_orders po
SET vendor_uuid = v.id
FROM public.vendors v
WHERE v.acumatica_vendor_id = po.vendor_id
  AND po.vendor_uuid IS NULL
  AND po.vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS acumatica_purchase_orders_vendor_acumatica_id_idx
  ON public.acumatica_purchase_orders (vendor_acumatica_id);
CREATE INDEX IF NOT EXISTS acumatica_purchase_orders_vendor_uuid_idx
  ON public.acumatica_purchase_orders (vendor_uuid);
-- 2. Add acumatica linkage column to domain subcontracts table
ALTER TABLE public.subcontracts
  ADD COLUMN IF NOT EXISTS acumatica_external_key TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_subcontracts_acumatica_external_key
  ON public.subcontracts (acumatica_external_key)
  WHERE acumatica_external_key IS NOT NULL;
-- 3. Add acumatica linkage column to domain purchase_orders table
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS acumatica_external_key TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_acumatica_external_key
  ON public.purchase_orders (acumatica_external_key)
  WHERE acumatica_external_key IS NOT NULL;
-- 4. Add acumatica_line_nbr to subcontract_sov_items for tracking
ALTER TABLE public.subcontract_sov_items
  ADD COLUMN IF NOT EXISTS acumatica_line_nbr INTEGER;
-- 5. Add acumatica_line_nbr to purchase_order_sov_items for tracking
ALTER TABLE public.purchase_order_sov_items
  ADD COLUMN IF NOT EXISTS acumatica_line_nbr INTEGER;
