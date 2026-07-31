-- Enforce relational integrity for prime_contracts.contract_company_id -> companies.id
-- Safe for existing data: validates no orphaned contract_company_id values before adding FK.

DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*)
  INTO orphan_count
  FROM public.prime_contracts pc
  LEFT JOIN public.companies c
    ON c.id = pc.contract_company_id
  WHERE pc.contract_company_id IS NOT NULL
    AND c.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add FK prime_contracts_contract_company_id_fkey: % orphan contract_company_id value(s) found in public.prime_contracts',
      orphan_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prime_contracts_contract_company_id_fkey'
  ) THEN
    ALTER TABLE public.prime_contracts
      ADD CONSTRAINT prime_contracts_contract_company_id_fkey
      FOREIGN KEY (contract_company_id)
      REFERENCES public.companies(id)
      ON DELETE SET NULL;
  END IF;
END $$;
