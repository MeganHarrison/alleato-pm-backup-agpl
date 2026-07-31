-- Fix: multiple FKs to prime_contracts use NO ACTION, blocking contract deletion.
-- This migration changes them to CASCADE or SET NULL as appropriate.

-- change_events.prime_contract_id → SET NULL (keep change events, unlink contract)
ALTER TABLE public.change_events
  DROP CONSTRAINT IF EXISTS change_events_prime_contract_id_fkey;
ALTER TABLE public.change_events
  ADD CONSTRAINT change_events_prime_contract_id_fkey
  FOREIGN KEY (prime_contract_id) REFERENCES public.prime_contracts(id)
  ON DELETE SET NULL;
-- change_event_line_items.contract_id → SET NULL (keep line items, unlink contract)
ALTER TABLE public.change_event_line_items
  DROP CONSTRAINT IF EXISTS change_event_line_items_contract_id_fkey;
ALTER TABLE public.change_event_line_items
  ADD CONSTRAINT change_event_line_items_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.prime_contracts(id)
  ON DELETE SET NULL;
-- payment_transactions.contract_id → SET NULL (keep payment records, unlink contract)
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_contract_id_fkey;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.prime_contracts(id)
  ON DELETE SET NULL;
-- prime_contract_change_orders.contract_id → CASCADE (COs belong to the contract)
ALTER TABLE public.prime_contract_change_orders
  DROP CONSTRAINT IF EXISTS prime_contract_change_orders_contract_id_fkey;
ALTER TABLE public.prime_contract_change_orders
  ADD CONSTRAINT prime_contract_change_orders_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.prime_contracts(id)
  ON DELETE CASCADE;
-- prime_contract_sovs.contract_id → CASCADE (SOVs belong to the contract)
ALTER TABLE public.prime_contract_sovs
  DROP CONSTRAINT IF EXISTS prime_contract_sovs_contract_id_fkey;
ALTER TABLE public.prime_contract_sovs
  ADD CONSTRAINT prime_contract_sovs_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.prime_contracts(id)
  ON DELETE CASCADE;
-- schedule_of_values.contract_id → CASCADE (SOVs belong to the contract)
ALTER TABLE public.schedule_of_values
  DROP CONSTRAINT IF EXISTS schedule_of_values_contract_id_fkey;
ALTER TABLE public.schedule_of_values
  ADD CONSTRAINT schedule_of_values_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.prime_contracts(id)
  ON DELETE CASCADE;
