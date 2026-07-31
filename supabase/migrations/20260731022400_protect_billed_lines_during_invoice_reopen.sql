-- Reopening may remove sources that disappeared while the invoice was under
-- review, but it must never erase billed work, materials, or retainage.

create or replace function public.guard_billed_invoice_line_reconciliation_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('alleato.invoice_reconcile', true) = 'on'
    and (
      coalesce(old.work_completed_previous, 0) <> 0
      or coalesce(old.work_completed_period, 0) <> 0
      or coalesce(old.materials_stored, 0) <> 0
      or coalesce(old.retainage_amount, 0) <> 0
      or coalesce(old.materials_retainage_amount, 0) <> 0
      or coalesce(old.previous_work_retainage, 0) <> 0
      or coalesce(old.previous_materials_retainage, 0) <> 0
      or coalesce(old.retainage_released, 0) <> 0
      or coalesce(old.work_retainage_released, 0) <> 0
      or coalesce(old.materials_retainage_released, 0) <> 0
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Invoice cannot return to draft because a removed or unapproved source has billed financial activity';
  end if;
  return old;
end;
$$;

revoke all on function public.guard_billed_invoice_line_reconciliation_delete()
from public, anon, authenticated;

drop trigger if exists trg_subcontractor_invoice_line_reconcile_billing_guard
on public.subcontractor_invoice_line_items;
create trigger trg_subcontractor_invoice_line_reconcile_billing_guard
before delete
on public.subcontractor_invoice_line_items
for each row
execute function public.guard_billed_invoice_line_reconciliation_delete();

create or replace function public.reconcile_subcontractor_invoice_on_reopen()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status
    and new.status::text in (
      'draft',
      'invited',
      'revise_and_resubmit'
    )
    and old.status::text not in (
      'draft',
      'invited',
      'revise_and_resubmit'
    )
    and new.acumatica_ref_nbr is null
    and new.acumatica_doc_type is null
    and new.acumatica_sync_at is null
    and new.acumatica_ap_bill_id is null
  then
    perform set_config('alleato.invoice_reconcile', 'on', true);
    perform public.reconcile_subcontractor_invoice_sources(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.reconcile_subcontractor_invoice_on_reopen()
from public, anon, authenticated;
