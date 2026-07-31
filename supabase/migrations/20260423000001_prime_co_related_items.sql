-- Prime Contract Change Order related item links
-- Enables cross-references from a prime CO to other project records.

CREATE TABLE IF NOT EXISTS public.prime_contract_change_order_related_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  prime_co_id integer NOT NULL REFERENCES public.prime_contract_change_orders(id) ON DELETE CASCADE,
  related_type text NOT NULL,
  related_id text NOT NULL,
  related_number text,
  related_title text NOT NULL,
  related_status text,
  related_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prime_co_related_items_unique_link
  ON public.prime_contract_change_order_related_items (prime_co_id, related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_prime_co_related_items_co_created_desc
  ON public.prime_contract_change_order_related_items (prime_co_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prime_co_related_items_project_type
  ON public.prime_contract_change_order_related_items (project_id, related_type);
ALTER TABLE public.prime_contract_change_order_related_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prime_co_related_items_select"
  ON public.prime_contract_change_order_related_items FOR SELECT USING (true);
CREATE POLICY "prime_co_related_items_insert"
  ON public.prime_contract_change_order_related_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "prime_co_related_items_delete"
  ON public.prime_contract_change_order_related_items FOR DELETE
  USING (auth.uid() IS NOT NULL);
CREATE OR REPLACE FUNCTION public.set_prime_co_related_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prime_co_related_items_updated_at
  ON public.prime_contract_change_order_related_items;
CREATE TRIGGER trg_prime_co_related_items_updated_at
BEFORE UPDATE ON public.prime_contract_change_order_related_items
FOR EACH ROW
EXECUTE FUNCTION public.set_prime_co_related_items_updated_at();
