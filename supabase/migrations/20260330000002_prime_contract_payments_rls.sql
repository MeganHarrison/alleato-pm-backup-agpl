-- Add RLS policies for prime_contract_payments table
-- Without these, authenticated users cannot read/write payments

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prime_contract_payments' AND policyname = 'Authenticated users can read payments'
  ) THEN
    CREATE POLICY "Authenticated users can read payments"
      ON public.prime_contract_payments FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prime_contract_payments' AND policyname = 'Authenticated users can insert payments'
  ) THEN
    CREATE POLICY "Authenticated users can insert payments"
      ON public.prime_contract_payments FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prime_contract_payments' AND policyname = 'Authenticated users can update payments'
  ) THEN
    CREATE POLICY "Authenticated users can update payments"
      ON public.prime_contract_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prime_contract_payments' AND policyname = 'Authenticated users can delete payments'
  ) THEN
    CREATE POLICY "Authenticated users can delete payments"
      ON public.prime_contract_payments FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
-- Also add policies for prime_contract_payment_applications if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prime_contract_payment_applications' AND policyname = 'Authenticated users can read payment applications'
  ) THEN
    CREATE POLICY "Authenticated users can read payment applications"
      ON public.prime_contract_payment_applications FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prime_contract_payment_applications' AND policyname = 'Authenticated users can insert payment applications'
  ) THEN
    CREATE POLICY "Authenticated users can insert payment applications"
      ON public.prime_contract_payment_applications FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prime_contract_payment_applications' AND policyname = 'Authenticated users can update payment applications'
  ) THEN
    CREATE POLICY "Authenticated users can update payment applications"
      ON public.prime_contract_payment_applications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prime_contract_payment_applications' AND policyname = 'Authenticated users can delete payment applications'
  ) THEN
    CREATE POLICY "Authenticated users can delete payment applications"
      ON public.prime_contract_payment_applications FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
