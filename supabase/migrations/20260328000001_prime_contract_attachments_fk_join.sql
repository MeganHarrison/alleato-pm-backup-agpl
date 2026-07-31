-- Add a relational join table for prime contract attachments.
-- This provides FK enforcement while preserving existing attachment records.

CREATE TABLE IF NOT EXISTS public.prime_contract_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.prime_contracts(id) ON DELETE CASCADE,
  attachment_id uuid NOT NULL REFERENCES public.attachments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prime_contract_attachments_contract_attachment_key UNIQUE (contract_id, attachment_id)
);
COMMENT ON TABLE public.prime_contract_attachments IS
  'Join table linking attachments to prime contracts with FK enforcement';
CREATE INDEX IF NOT EXISTS idx_prime_contract_attachments_contract_id
  ON public.prime_contract_attachments (contract_id);
CREATE INDEX IF NOT EXISTS idx_prime_contract_attachments_attachment_id
  ON public.prime_contract_attachments (attachment_id);
ALTER TABLE public.prime_contract_attachments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prime_contract_attachments'
      AND policyname = 'prime_contract_attachments_select'
  ) THEN
    CREATE POLICY prime_contract_attachments_select
      ON public.prime_contract_attachments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prime_contract_attachments'
      AND policyname = 'prime_contract_attachments_insert'
  ) THEN
    CREATE POLICY prime_contract_attachments_insert
      ON public.prime_contract_attachments
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prime_contract_attachments'
      AND policyname = 'prime_contract_attachments_delete'
  ) THEN
    CREATE POLICY prime_contract_attachments_delete
      ON public.prime_contract_attachments
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
-- Backfill join links from legacy polymorphic pointers.
INSERT INTO public.prime_contract_attachments (contract_id, attachment_id)
SELECT pc.id, a.id
FROM public.attachments a
JOIN public.prime_contracts pc
  ON pc.id::text = a.attached_to_id
WHERE a.attached_to_table = 'prime_contracts'
  AND a.attached_to_id IS NOT NULL
ON CONFLICT (contract_id, attachment_id) DO NOTHING;
