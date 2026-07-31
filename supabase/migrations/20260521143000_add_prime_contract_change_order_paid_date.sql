alter table public.prime_contract_change_orders
  add column if not exists paid_date timestamptz;
