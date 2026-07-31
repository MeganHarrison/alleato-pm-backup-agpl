-- SAIS: structured SOP backlog and accounting/finance spend classification.
-- Missing SOPs are operational requirements, not uploaded files, so they live
-- outside document_metadata and link to it only after a real file exists.

create table if not exists public.sop_backlog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  business_area text not null check (business_area in ('accounting', 'finance')),
  document_type text not null default 'sop' check (document_type in ('sop')),
  status text not null default 'needed' check (status in ('needed', 'draft', 'in_review', 'published', 'archived')),
  priority integer not null default 100 check (priority >= 0),
  priority_label text check (priority_label in ('critical', 'high', 'medium', 'low')),
  description text,
  owner text,
  linked_document_metadata_id text references public.document_metadata(id) on delete set null,
  project_id bigint references public.projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sop_backlog_leadership_sort_idx
  on public.sop_backlog (
    business_area,
    status,
    priority,
    created_at
  );

create index if not exists sop_backlog_linked_document_idx
  on public.sop_backlog (linked_document_metadata_id)
  where linked_document_metadata_id is not null;

drop trigger if exists sop_backlog_set_updated_at on public.sop_backlog;
create trigger sop_backlog_set_updated_at
  before update on public.sop_backlog
  for each row execute function public.set_updated_at();

create table if not exists public.finance_spend_classification_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  match_text text not null check (length(trim(match_text)) > 0),
  category text not null check (
    category in (
      'audit_tax',
      'controller_accounting_services',
      'erp_accounting_software',
      'payroll_timekeeping',
      'finance_legal_compliance',
      'other_finance_overhead'
    )
  ),
  priority integer not null default 100 check (priority >= 0),
  confidence numeric(5,4) not null default 0.85 check (confidence >= 0 and confidence <= 1),
  exclude boolean not null default false,
  exclusion_reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_text)
);

create index if not exists finance_spend_classification_rules_active_idx
  on public.finance_spend_classification_rules (active, priority, match_text);

drop trigger if exists finance_spend_classification_rules_set_updated_at
  on public.finance_spend_classification_rules;
create trigger finance_spend_classification_rules_set_updated_at
  before update on public.finance_spend_classification_rules
  for each row execute function public.set_updated_at();

insert into public.finance_spend_classification_rules
  (rule_name, match_text, category, priority, confidence, exclude, exclusion_reason)
values
  ('Somerset audit and tax services', 'SOMERSET', 'audit_tax', 10, 0.95, false, null),
  ('LLUM controller services', 'LLUM', 'controller_accounting_services', 10, 0.95, false, null),
  ('Revive ERP Acumatica support', 'REVIVE ERP', 'erp_accounting_software', 10, 0.9, false, null),
  ('Acumatica software', 'ACUMATICA', 'erp_accounting_software', 20, 0.88, false, null),
  ('JobPlanner subscription', 'JOBPLANNER', 'erp_accounting_software', 30, 0.82, false, null),
  ('TimeCo payroll and timekeeping', 'TIMECO', 'payroll_timekeeping', 30, 0.9, false, null),
  ('Payroll services', 'PAYROLL', 'payroll_timekeeping', 60, 0.75, false, null),
  ('Tax services keyword', 'TAX', 'audit_tax', 70, 0.7, false, null),
  ('CPA services keyword', 'CPA', 'audit_tax', 70, 0.7, false, null),
  ('Finance legal keyword', 'LEGAL', 'finance_legal_compliance', 80, 0.7, false, null),
  ('Compliance keyword', 'COMPLIANCE', 'finance_legal_compliance', 80, 0.7, false, null)
on conflict (match_text) do update
set
  rule_name = excluded.rule_name,
  category = excluded.category,
  priority = excluded.priority,
  confidence = excluded.confidence,
  exclude = excluded.exclude,
  exclusion_reason = excluded.exclusion_reason,
  active = true,
  updated_at = now();
