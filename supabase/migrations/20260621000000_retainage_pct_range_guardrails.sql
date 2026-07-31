-- Retainage guardrails: enforce that every retainage percentage on an invoice
-- line item is a whole-number percent in [0, 100].
--
-- Why: subcontracts and subcontract_sov_items already CHECK (0..100), but the
-- actual *billing* line-item tables had no range guard. Two failure modes this
-- prevents:
--   1) A stored value > 100 (or negative) silently over/under-withholding from a
--      subcontractor -- the class of bug that has burned subs in other systems.
--   2) The "fraction trap": these columns are numeric(6-7,4) and *look* like they
--      should hold 0.10, but the app convention is whole percent (10.0000 = 10%).
--      A 0..100 CHECK makes a fraction-shaped 0.10 obviously valid-but-tiny and a
--      mistaken 1000 obviously rejected, and documents the convention in the schema.
--
-- NULL is allowed (CHECK passes on NULL) -- these columns are nullable and a null
-- pct means "no retainage on this line", which is legitimate.
--
-- Release bounds (released <= previous + this_period) are intentionally NOT a DB
-- CHECK here: the correct bound spans multiple columns/periods and is enforced in
-- application code where the prior-period context is available.

ALTER TABLE public.subcontractor_invoice_line_items
  ADD CONSTRAINT subcontractor_invoice_line_items_retainage_pct_check
    CHECK (retainage_pct IS NULL OR retainage_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT subcontractor_invoice_line_items_materials_retainage_pct_check
    CHECK (materials_retainage_pct IS NULL OR materials_retainage_pct BETWEEN 0 AND 100);

ALTER TABLE public.owner_invoice_line_items
  ADD CONSTRAINT owner_invoice_line_items_retainage_pct_check
    CHECK (retainage_pct IS NULL OR retainage_pct BETWEEN 0 AND 100);

ALTER TABLE public.payment_application_line_items
  ADD CONSTRAINT payment_application_line_items_retainage_work_pct_check
    CHECK (retainage_this_period_work_pct IS NULL OR retainage_this_period_work_pct BETWEEN 0 AND 100),
  ADD CONSTRAINT payment_application_line_items_retainage_materials_pct_check
    CHECK (retainage_this_period_materials_pct IS NULL OR retainage_this_period_materials_pct BETWEEN 0 AND 100);
