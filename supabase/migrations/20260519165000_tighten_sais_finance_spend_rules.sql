-- SAIS finance spend guardrail: avoid broad keyword rules that classify
-- unrelated AP operating noise as accounting/finance overhead.

update public.finance_spend_classification_rules
set
  active = false,
  exclusion_reason = 'Disabled by default: broad keyword match requires human review before inclusion.',
  updated_at = now()
where match_text in ('PAYROLL', 'TAX', 'CPA', 'LEGAL', 'COMPLIANCE');
