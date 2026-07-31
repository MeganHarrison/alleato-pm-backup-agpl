-- ============================================================
-- Change Order Attachments table and schema fixes
-- ============================================================
-- Purpose:
--   1. Create the change_order_attachments table (referenced by API
--      routes but missing from the database).
--   2. Add Procore-spec columns to change_orders that are defined
--      in the ContractChangeOrderExtended TypeScript interface but
--      absent from the schema.
--
-- Affected tables:
--   - public.change_order_attachments (CREATE)
--   - public.change_orders (ALTER — add 5 columns)
--
-- Storage bucket used by attachments: project-files
-- ============================================================

-- ============================================================
-- 1. create change_order_attachments
-- ============================================================

create table if not exists public.change_order_attachments (
  -- Primary key: UUID so that attachment IDs are globally unique and
  -- not guessable from sequential integers.
  id              uuid primary key default gen_random_uuid(),

  -- Foreign key to the parent change order.
  -- change_orders.id is bigint (confirmed from schema dump line 7701).
  change_order_id bigint not null
    references public.change_orders (id) on delete cascade,

  -- File metadata stored by the POST /attachments API route.
  file_name       text not null,
  file_path       text not null,       -- path inside the 'project-files' storage bucket
  file_size       bigint not null,     -- bytes; API enforces max 50 MB (52428800 bytes)
  mime_type       text not null,

  -- Uploader reference — auth.users.id is uuid.
  uploaded_by     uuid not null
    references auth.users (id) on delete set null,

  -- Timestamps.
  uploaded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
comment on table public.change_order_attachments is
  'File attachments for change orders. Metadata is stored here; '
  'actual files live in the project-files Supabase Storage bucket '
  'at path change-orders/{projectId}/{changeOrderId}/{fileName}.';
comment on column public.change_order_attachments.file_path is
  'Storage path inside the project-files bucket, e.g. '
  '"change-orders/67/123/1700000000000_abc123.pdf".';
comment on column public.change_order_attachments.file_size is
  'File size in bytes. API enforces a maximum of 52428800 (50 MB).';
-- ============================================================
-- 2. RLS for change_order_attachments
-- ============================================================
-- Pattern matches the existing change_order_lines policies in the
-- schema dump: simple auth.uid() IS NOT NULL check.  This means any
-- authenticated user can read, insert, or delete attachments.
-- A tighter policy (scoped to project membership) can be layered on
-- later once a project_members table is available.
-- ============================================================

alter table public.change_order_attachments enable row level security;
create policy change_order_attachments_select
  on public.change_order_attachments
  for select
  using (auth.uid() is not null);
create policy change_order_attachments_insert
  on public.change_order_attachments
  for insert
  with check (auth.uid() is not null);
create policy change_order_attachments_delete
  on public.change_order_attachments
  for delete
  using (auth.uid() is not null);
-- (No UPDATE policy — attachments are immutable; delete + re-upload to replace.)

-- ============================================================
-- 3. Indexes for change_order_attachments
-- ============================================================

-- Primary lookup: all attachments for a given change order, newest first.
create index if not exists idx_change_order_attachments_change_order_id
  on public.change_order_attachments (change_order_id, uploaded_at desc);
-- RLS policy column — needed so the policy scan on uploaded_by is fast.
create index if not exists idx_change_order_attachments_uploaded_by
  on public.change_order_attachments (uploaded_by);
-- ============================================================
-- 4. Missing columns on change_orders
-- ============================================================
-- The ContractChangeOrderExtended TypeScript interface lists these
-- fields as "Procore spec fields (to be added to schema)".
-- Adding them here with IF NOT EXISTS guards so the migration is
-- idempotent if partially applied.
-- ============================================================

-- revision: change order revision number (e.g. 0, 1, 2 …)
alter table public.change_orders
  add column if not exists revision integer;
comment on column public.change_orders.revision is
  'Revision counter for the change order, starting at 0. Incremented '
  'when a new revision is issued after initial submission.';
-- date_initiated: when the change event that drove this CO was first identified
alter table public.change_orders
  add column if not exists date_initiated date;
comment on column public.change_orders.date_initiated is
  'Date the change order was initiated / the triggering change event occurred.';
-- review_date: scheduled or actual date for the approval review
alter table public.change_orders
  add column if not exists review_date date;
comment on column public.change_orders.review_date is
  'Date on which the designated reviewer is expected to review the CO.';
-- scope: whether the work is within or outside the original contract scope
alter table public.change_orders
  add column if not exists scope text
  check (scope in ('in_scope', 'out_of_scope', 'tbd'));
comment on column public.change_orders.scope is
  'Scope classification: in_scope | out_of_scope | tbd.';
-- schedule_impact: whether the change order affects the project schedule
alter table public.change_orders
  add column if not exists schedule_impact text
  check (schedule_impact in ('yes', 'no', 'unknown'));
comment on column public.change_orders.schedule_impact is
  'Whether the change order has a schedule impact: yes | no | unknown.';
