-- Add second address line to the structured Bill To / Ship To fields on
-- purchase_orders. The existing bill_to_address / ship_to_address act as
-- "Address Line 1"; these new columns are the optional "Address Line 2".

alter table public.purchase_orders
  add column if not exists bill_to_address_line2 text,
  add column if not exists ship_to_address_line2 text;

comment on column public.purchase_orders.bill_to_address_line2 is 'Bill-to address line 2 (suite/unit). Address line 1 is bill_to_address.';
comment on column public.purchase_orders.ship_to_address_line2 is 'Ship-to address line 2 (suite/unit). Address line 1 is ship_to_address.';
