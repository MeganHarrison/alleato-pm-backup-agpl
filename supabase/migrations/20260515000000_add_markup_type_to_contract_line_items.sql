-- Add markup_type to contract_line_items so markup rows (insurance, fee, etc.)
-- can be identified and rendered as locked/read-only in the SOV detail view.
-- markup_type is NULL for regular line items and set to the markup category
-- (e.g. 'insurance', 'fee') for auto-computed markup rows.

alter table contract_line_items
  add column if not exists markup_type text null;

-- Constrain to known markup categories to prevent arbitrary values
alter table contract_line_items
  add constraint contract_line_items_markup_type_check
  check (markup_type in ('insurance', 'fee', 'overhead', 'profit', 'bond', 'tax', 'other') or markup_type is null);

comment on column contract_line_items.markup_type is
  'Non-null for auto-computed markup rows (e.g. insurance, fee). NULL for regular SOV line items. Markup rows are read-only in the UI.';
