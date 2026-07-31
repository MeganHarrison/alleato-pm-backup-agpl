-- Migration: Create Pattern C document junction tables
-- Purpose: Link document_metadata records to first-class entities via junction tables.
--          These sit alongside existing file-storage tables (contract_documents,
--          submittal_documents, etc.) which are NOT replaced — they remain for
--          their file-upload workflow. These junctions connect AI-indexed docs.
-- Affects: New tables:
--   commitment_documents, prime_contract_documents, change_order_documents,
--   owner_invoice_documents, company_documents, project_documents_v2,
--   submittal_doc_links, rfi_documents
-- Note: document_metadata.id is TEXT. All junction FKs use text.
-- Note: commitments table is actually commitments_unified (uuid PK, integer project_id).
-- Note: project_documents already exists as a file-storage table with a different shape;
--       new junction is named project_documents_v2 to avoid conflict.
-- Note: submittal_documents already exists as a file-storage table;
--       new junction is named submittal_doc_links to avoid conflict.

-- ─── commitment_documents ────────────────────────────────────────────────────

create table if not exists public.commitment_documents (
  commitment_id       uuid        not null references public.commitments_unified(id) on delete cascade,
  document_metadata_id text       not null references public.document_metadata(id) on delete cascade,
  document_type       text        references public.document_type_taxonomy(type_key),
  attached_at         timestamptz not null default now(),
  attached_by         uuid        references auth.users(id),
  primary key (commitment_id, document_metadata_id)
);

create index if not exists idx_commitment_documents_doc
  on public.commitment_documents (document_metadata_id);

alter table public.commitment_documents enable row level security;

create policy "commitment_documents_select" on public.commitment_documents
  for select to authenticated
  using (public.user_can_access_entity('commitment', commitment_id::text));

create policy "commitment_documents_insert" on public.commitment_documents
  for insert to authenticated
  with check (public.user_can_access_entity('commitment', commitment_id::text));

create policy "commitment_documents_update" on public.commitment_documents
  for update to authenticated
  using  (public.user_can_access_entity('commitment', commitment_id::text))
  with check (public.user_can_access_entity('commitment', commitment_id::text));

create policy "commitment_documents_delete" on public.commitment_documents
  for delete to authenticated
  using (public.user_can_access_entity('commitment', commitment_id::text));

comment on table public.commitment_documents is
  'Pattern C junction: links document_metadata records to commitments_unified. '
  'Distinct from legacy file-upload flows.';

-- ─── prime_contract_documents ─────────────────────────────────────────────────

create table if not exists public.prime_contract_documents (
  prime_contract_id    uuid        not null references public.prime_contracts(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  document_type        text        references public.document_type_taxonomy(type_key),
  attached_at          timestamptz not null default now(),
  attached_by          uuid        references auth.users(id),
  primary key (prime_contract_id, document_metadata_id)
);

create index if not exists idx_prime_contract_documents_doc
  on public.prime_contract_documents (document_metadata_id);

alter table public.prime_contract_documents enable row level security;

create policy "prime_contract_documents_select" on public.prime_contract_documents
  for select to authenticated
  using (public.user_can_access_entity('prime_contract', prime_contract_id::text));

create policy "prime_contract_documents_insert" on public.prime_contract_documents
  for insert to authenticated
  with check (public.user_can_access_entity('prime_contract', prime_contract_id::text));

create policy "prime_contract_documents_update" on public.prime_contract_documents
  for update to authenticated
  using  (public.user_can_access_entity('prime_contract', prime_contract_id::text))
  with check (public.user_can_access_entity('prime_contract', prime_contract_id::text));

create policy "prime_contract_documents_delete" on public.prime_contract_documents
  for delete to authenticated
  using (public.user_can_access_entity('prime_contract', prime_contract_id::text));

comment on table public.prime_contract_documents is
  'Pattern C junction: links document_metadata records to prime_contracts. '
  'Distinct from contract_documents which tracks uploaded files.';

-- ─── change_order_documents ───────────────────────────────────────────────────

create table if not exists public.change_order_documents (
  change_order_id      uuid        not null references public.change_orders(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  document_type        text        references public.document_type_taxonomy(type_key),
  attached_at          timestamptz not null default now(),
  attached_by          uuid        references auth.users(id),
  primary key (change_order_id, document_metadata_id)
);

create index if not exists idx_change_order_documents_doc
  on public.change_order_documents (document_metadata_id);

alter table public.change_order_documents enable row level security;

create policy "change_order_documents_select" on public.change_order_documents
  for select to authenticated
  using (public.user_can_access_entity('change_order', change_order_id::text));

create policy "change_order_documents_insert" on public.change_order_documents
  for insert to authenticated
  with check (public.user_can_access_entity('change_order', change_order_id::text));

create policy "change_order_documents_update" on public.change_order_documents
  for update to authenticated
  using  (public.user_can_access_entity('change_order', change_order_id::text))
  with check (public.user_can_access_entity('change_order', change_order_id::text));

create policy "change_order_documents_delete" on public.change_order_documents
  for delete to authenticated
  using (public.user_can_access_entity('change_order', change_order_id::text));

comment on table public.change_order_documents is
  'Pattern C junction: links document_metadata records to change_orders.';

-- ─── owner_invoice_documents ──────────────────────────────────────────────────

create table if not exists public.owner_invoice_documents (
  owner_invoice_id     bigint      not null references public.owner_invoices(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  document_type        text        references public.document_type_taxonomy(type_key),
  attached_at          timestamptz not null default now(),
  attached_by          uuid        references auth.users(id),
  primary key (owner_invoice_id, document_metadata_id)
);

create index if not exists idx_owner_invoice_documents_doc
  on public.owner_invoice_documents (document_metadata_id);

alter table public.owner_invoice_documents enable row level security;

create policy "owner_invoice_documents_select" on public.owner_invoice_documents
  for select to authenticated
  using (public.user_can_access_entity('invoice', owner_invoice_id::text));

create policy "owner_invoice_documents_insert" on public.owner_invoice_documents
  for insert to authenticated
  with check (public.user_can_access_entity('invoice', owner_invoice_id::text));

create policy "owner_invoice_documents_update" on public.owner_invoice_documents
  for update to authenticated
  using  (public.user_can_access_entity('invoice', owner_invoice_id::text))
  with check (public.user_can_access_entity('invoice', owner_invoice_id::text));

create policy "owner_invoice_documents_delete" on public.owner_invoice_documents
  for delete to authenticated
  using (public.user_can_access_entity('invoice', owner_invoice_id::text));

comment on table public.owner_invoice_documents is
  'Pattern C junction: links document_metadata records to owner_invoices. '
  'Access is checked through prime_contracts → project membership chain.';

-- ─── company_documents ────────────────────────────────────────────────────────

create table if not exists public.company_documents (
  company_id           uuid        not null references public.companies(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  document_type        text        references public.document_type_taxonomy(type_key),
  attached_at          timestamptz not null default now(),
  attached_by          uuid        references auth.users(id),
  primary key (company_id, document_metadata_id)
);

create index if not exists idx_company_documents_doc
  on public.company_documents (document_metadata_id);

alter table public.company_documents enable row level security;

-- Companies are cross-project; any authenticated user can read
create policy "company_documents_select" on public.company_documents
  for select to authenticated
  using (public.user_can_access_entity('company', company_id::text));

create policy "company_documents_insert" on public.company_documents
  for insert to authenticated
  with check (public.current_is_app_admin());

create policy "company_documents_update" on public.company_documents
  for update to authenticated
  using  (public.current_is_app_admin())
  with check (public.current_is_app_admin());

create policy "company_documents_delete" on public.company_documents
  for delete to authenticated
  using (public.current_is_app_admin());

comment on table public.company_documents is
  'Pattern C junction: links document_metadata records to companies. '
  'Read: any authenticated user. Write: admins only (companies are cross-project).';

-- ─── project_documents_v2 ─────────────────────────────────────────────────────
-- project_documents (v1) is a file-storage table with a different schema.
-- This v2 junction links document_metadata to projects for Pattern C.

create table if not exists public.project_documents_v2 (
  project_id           integer     not null references public.projects(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  document_type        text        references public.document_type_taxonomy(type_key),
  attached_at          timestamptz not null default now(),
  attached_by          uuid        references auth.users(id),
  primary key (project_id, document_metadata_id)
);

create index if not exists idx_project_documents_v2_doc
  on public.project_documents_v2 (document_metadata_id);

alter table public.project_documents_v2 enable row level security;

create policy "project_documents_v2_select" on public.project_documents_v2
  for select to authenticated
  using (public.user_can_access_entity('project', project_id::text));

create policy "project_documents_v2_insert" on public.project_documents_v2
  for insert to authenticated
  with check (public.user_can_access_entity('project', project_id::text));

create policy "project_documents_v2_update" on public.project_documents_v2
  for update to authenticated
  using  (public.user_can_access_entity('project', project_id::text))
  with check (public.user_can_access_entity('project', project_id::text));

create policy "project_documents_v2_delete" on public.project_documents_v2
  for delete to authenticated
  using (public.user_can_access_entity('project', project_id::text));

comment on table public.project_documents_v2 is
  'Pattern C junction: links document_metadata records to projects. '
  'Named v2 to avoid conflict with existing project_documents file-storage table.';

-- ─── submittal_doc_links ──────────────────────────────────────────────────────
-- submittal_documents already exists as a file-storage table.
-- This junction links document_metadata to submittals for Pattern C.

create table if not exists public.submittal_doc_links (
  submittal_id         uuid        not null references public.submittals(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  document_type        text        references public.document_type_taxonomy(type_key),
  attached_at          timestamptz not null default now(),
  attached_by          uuid        references auth.users(id),
  primary key (submittal_id, document_metadata_id)
);

create index if not exists idx_submittal_doc_links_doc
  on public.submittal_doc_links (document_metadata_id);

alter table public.submittal_doc_links enable row level security;

create policy "submittal_doc_links_select" on public.submittal_doc_links
  for select to authenticated
  using (public.user_can_access_entity('submittal', submittal_id::text));

create policy "submittal_doc_links_insert" on public.submittal_doc_links
  for insert to authenticated
  with check (public.user_can_access_entity('submittal', submittal_id::text));

create policy "submittal_doc_links_update" on public.submittal_doc_links
  for update to authenticated
  using  (public.user_can_access_entity('submittal', submittal_id::text))
  with check (public.user_can_access_entity('submittal', submittal_id::text));

create policy "submittal_doc_links_delete" on public.submittal_doc_links
  for delete to authenticated
  using (public.user_can_access_entity('submittal', submittal_id::text));

comment on table public.submittal_doc_links is
  'Pattern C junction: links document_metadata records to submittals. '
  'Named submittal_doc_links to avoid conflict with existing submittal_documents file-storage table.';

-- ─── rfi_documents ────────────────────────────────────────────────────────────

create table if not exists public.rfi_documents (
  rfi_id               uuid        not null references public.rfis(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  document_type        text        references public.document_type_taxonomy(type_key),
  attached_at          timestamptz not null default now(),
  attached_by          uuid        references auth.users(id),
  primary key (rfi_id, document_metadata_id)
);

create index if not exists idx_rfi_documents_doc
  on public.rfi_documents (document_metadata_id);

alter table public.rfi_documents enable row level security;

create policy "rfi_documents_select" on public.rfi_documents
  for select to authenticated
  using (public.user_can_access_entity('rfi', rfi_id::text));

create policy "rfi_documents_insert" on public.rfi_documents
  for insert to authenticated
  with check (public.user_can_access_entity('rfi', rfi_id::text));

create policy "rfi_documents_update" on public.rfi_documents
  for update to authenticated
  using  (public.user_can_access_entity('rfi', rfi_id::text))
  with check (public.user_can_access_entity('rfi', rfi_id::text));

create policy "rfi_documents_delete" on public.rfi_documents
  for delete to authenticated
  using (public.user_can_access_entity('rfi', rfi_id::text));

comment on table public.rfi_documents is
  'Pattern C junction: links document_metadata records to rfis. '
  'rfis also has source_document_metadata_id / response_document_metadata_id columns '
  'for the primary source/response docs; this junction is for additional attachments.';
