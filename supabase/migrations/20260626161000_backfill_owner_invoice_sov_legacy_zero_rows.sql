-- Backfill legacy owner invoice line items where the billed amount exists only
-- in approved_amount and every SOV display/progress field is still zero.
--
-- This keeps the migration idempotent and avoids touching any line where users
-- or imports have already populated Schedule of Values progress.

update public.owner_invoice_line_items
set
  scheduled_value = approved_amount,
  work_completed_previous = 0,
  work_completed_period = approved_amount,
  materials_stored = 0,
  work_completed_pct = 99.9999,
  retainage_amount = 0,
  retainage_released = 0,
  updated_at = now()
where
  coalesce(approved_amount, 0) > 0
  and coalesce(scheduled_value, 0) = 0
  and coalesce(work_completed_previous, 0) = 0
  and coalesce(work_completed_period, 0) = 0
  and coalesce(materials_stored, 0) = 0
  and coalesce(total_completed_stored, 0) = 0
  and coalesce(net_amount_this_period, 0) = 0
  and coalesce(balance_to_finish, 0) = 0;
