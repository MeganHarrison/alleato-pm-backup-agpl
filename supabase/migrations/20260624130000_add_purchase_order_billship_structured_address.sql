-- Purchase Order Bill To / Ship To structured redesign.
--
-- Replaces free-text bill_to / ship_to with structured, queryable fields:
--   * a company FK (source of truth for the address)
--   * a contact/person FK
--   * a snapshot of the address (address/city/state/zip) that auto-populates
--     from the selected company but remains independently editable.
--
-- Legacy bill_to / ship_to text columns are KEPT for backward compatibility and
-- historical display; new writes populate the structured columns.
--
-- FKs use ON DELETE SET NULL so deleting a company/person clears the link but
-- preserves the snapshotted address text on the PO.

alter table public.purchase_orders
  add column if not exists bill_to_company_id uuid,
  add column if not exists bill_to_contact_id uuid,
  add column if not exists bill_to_address text,
  add column if not exists bill_to_city text,
  add column if not exists bill_to_state text,
  add column if not exists bill_to_zip text,
  add column if not exists ship_to_company_id uuid,
  add column if not exists ship_to_contact_id uuid,
  add column if not exists ship_to_address text,
  add column if not exists ship_to_city text,
  add column if not exists ship_to_state text,
  add column if not exists ship_to_zip text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'purchase_orders_bill_to_company_id_fkey'
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_bill_to_company_id_fkey
      foreign key (bill_to_company_id) references public.companies(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'purchase_orders_bill_to_contact_id_fkey'
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_bill_to_contact_id_fkey
      foreign key (bill_to_contact_id) references public.people(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'purchase_orders_ship_to_company_id_fkey'
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_ship_to_company_id_fkey
      foreign key (ship_to_company_id) references public.companies(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'purchase_orders_ship_to_contact_id_fkey'
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_ship_to_contact_id_fkey
      foreign key (ship_to_contact_id) references public.people(id) on delete set null;
  end if;
end $$;

create index if not exists idx_purchase_orders_bill_to_company_id
  on public.purchase_orders (bill_to_company_id);
create index if not exists idx_purchase_orders_ship_to_company_id
  on public.purchase_orders (ship_to_company_id);

comment on column public.purchase_orders.bill_to_company_id is 'Company being billed (FK companies.id). Source of the auto-populated bill-to address.';
comment on column public.purchase_orders.bill_to_contact_id is 'Billing contact at the bill-to company (FK people.id).';
comment on column public.purchase_orders.ship_to_company_id is 'Company receiving the shipment (FK companies.id). Source of the auto-populated ship-to address.';
comment on column public.purchase_orders.ship_to_contact_id is 'Receiving person, an employee of the ship-to company (FK people.id).';
comment on column public.purchase_orders.bill_to is 'DEPRECATED free-text bill-to. Retained for historical records; new writes use bill_to_* structured columns.';
comment on column public.purchase_orders.ship_to is 'DEPRECATED free-text ship-to. Retained for historical records; new writes use ship_to_* structured columns.';
