-- Attribution candidates table for the Teams conversation compiler.
-- Stores multi-project or uncertain project attributions for human review.
-- auto_assigned rows have confidence >= 0.85 and no conflicting evidence.
-- pending_review rows require human approval before affecting project records.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.document_attribution_candidates (
  id uuid not null default gen_random_uuid() primary key,
  source_document_id text not null references public.document_metadata(id) on delete cascade,
  source_message_ids text[] not null default '{}',
  candidate_project_id bigint references public.projects(id) on delete set null,
  candidate_project_name text,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  attribution_method text not null,
  evidence_terms text[] not null default '{}',
  reasoning text,
  status text not null default 'pending_review',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_attribution_candidates_status_check
    check (status in ('pending_review', 'approved', 'rejected', 'auto_assigned'))
);

create index if not exists idx_attribution_candidates_doc
  on public.document_attribution_candidates(source_document_id);
create index if not exists idx_attribution_candidates_project
  on public.document_attribution_candidates(candidate_project_id);
create index if not exists idx_attribution_candidates_status
  on public.document_attribution_candidates(status);

drop trigger if exists document_attribution_candidates_set_updated_at
  on public.document_attribution_candidates;
create trigger document_attribution_candidates_set_updated_at
  before update on public.document_attribution_candidates
  for each row execute function public.set_updated_at();

alter table public.document_attribution_candidates enable row level security;

drop policy if exists document_attribution_candidates_admin_all_access
  on public.document_attribution_candidates;
create policy document_attribution_candidates_admin_all_access
  on public.document_attribution_candidates
  to authenticated
  using ((auth.jwt() ->> 'role') in ('admin', 'leadership'))
  with check ((auth.jwt() ->> 'role') in ('admin', 'leadership'));

grant all on table public.document_attribution_candidates to anon;
grant all on table public.document_attribution_candidates to authenticated;
grant all on table public.document_attribution_candidates to service_role;

commit;
