-- FMDS 8-34 canonical, revision-isolated corpus.
-- This migration belongs only to the dedicated ASRS Supabase project.

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema public;

create table public.fmds_corpus_revisions (
  id uuid primary key default gen_random_uuid(),
  document_code text not null,
  revision_label text not null,
  publication_date date not null,
  source_file_name text not null,
  source_sha256 text not null,
  source_page_count integer not null check (source_page_count > 0),
  source_storage_path text,
  status text not null default 'staging'
    check (status in ('staging', 'active', 'superseded', 'rejected')),
  extraction_model text,
  embedding_model text not null default 'text-embedding-3-large',
  embedding_dimensions integer not null default 3072 check (embedding_dimensions = 3072),
  metadata jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_code, revision_label),
  unique (source_sha256)
);

create unique index fmds_one_active_revision_per_document
  on public.fmds_corpus_revisions (document_code)
  where status = 'active';

create table public.fmds_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fmds_corpus_revisions(id) on delete restrict,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  stage text not null,
  command_version text not null,
  source_sha256 text not null,
  counts jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index fmds_ingestion_runs_revision_started_idx
  on public.fmds_ingestion_runs (revision_id, started_at desc);

create table public.fmds_pages (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fmds_corpus_revisions(id) on delete restrict,
  page_number integer not null check (page_number > 0),
  native_text text not null default '',
  native_text_sha256 text not null,
  native_char_count integer not null default 0 check (native_char_count >= 0),
  rendered_image_path text,
  rendered_image_sha256 text,
  width_points numeric,
  height_points numeric,
  extraction_status text not null
    check (extraction_status in ('extracted', 'no_text', 'failed')),
  extraction_confidence numeric check (extraction_confidence between 0 and 1),
  review_status text not null default 'not_required'
    check (review_status in ('not_required', 'needs_review', 'reviewed', 'rejected')),
  extraction_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id, page_number)
);

create index fmds_pages_revision_status_idx
  on public.fmds_pages (revision_id, extraction_status, page_number);

create table public.fmds_chunks (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fmds_corpus_revisions(id) on delete restrict,
  page_id uuid not null references public.fmds_pages(id) on delete restrict,
  page_number integer not null check (page_number > 0),
  chunk_index integer not null check (chunk_index >= 0),
  chunk_type text not null default 'narrative'
    check (chunk_type in ('narrative', 'heading', 'table_text', 'figure_caption', 'appendix')),
  section_path text,
  clause_reference text,
  content text not null check (length(btrim(content)) > 0),
  content_sha256 text not null,
  citation_label text not null,
  native_char_count integer not null check (native_char_count > 0),
  embedding public.halfvec(3072),
  embedding_model text,
  embedding_dimensions integer check (embedding_dimensions = 3072),
  embedding_status text not null default 'pending'
    check (embedding_status in ('pending', 'embedded', 'failed')),
  embedding_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id, page_number, chunk_index)
);

create index fmds_chunks_revision_page_idx
  on public.fmds_chunks (revision_id, page_number, chunk_index);

create index fmds_chunks_embedding_hnsw_idx
  on public.fmds_chunks using hnsw (embedding public.halfvec_cosine_ops)
  where embedding_status = 'embedded';

create table public.fmds_tables (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fmds_corpus_revisions(id) on delete restrict,
  table_identifier text not null,
  title text,
  page_start integer not null check (page_start > 0),
  page_end integer not null check (page_end >= page_start),
  caption_text text,
  bounding_box jsonb,
  evidence_image_path text,
  extracted_structure jsonb not null default '{}'::jsonb,
  extraction_method text not null,
  extraction_confidence numeric check (extraction_confidence between 0 and 1),
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'reviewed', 'rejected')),
  source_sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id, table_identifier, page_start)
);

create index fmds_tables_revision_page_idx
  on public.fmds_tables (revision_id, page_start, table_identifier);

create table public.fmds_table_cells (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.fmds_tables(id) on delete cascade,
  row_index integer not null check (row_index >= 0),
  column_index integer not null check (column_index >= 0),
  row_header text,
  column_header text,
  raw_value text,
  normalized_value text,
  unit text,
  notes text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (table_id, row_index, column_index)
);

create table public.fmds_figures (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fmds_corpus_revisions(id) on delete restrict,
  figure_identifier text not null,
  title text,
  page_number integer not null check (page_number > 0),
  caption_text text,
  bounding_box jsonb,
  evidence_image_path text,
  extracted_description jsonb not null default '{}'::jsonb,
  extraction_method text not null,
  extraction_confidence numeric check (extraction_confidence between 0 and 1),
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'reviewed', 'rejected')),
  source_sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id, figure_identifier, page_number)
);

create index fmds_figures_revision_page_idx
  on public.fmds_figures (revision_id, page_number, figure_identifier);

create table public.fmds_rule_cards (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fmds_corpus_revisions(id) on delete restrict,
  rule_key text not null,
  title text not null,
  source_page_numbers integer[] not null,
  source_clause_references text[] not null default '{}',
  conditions jsonb not null,
  outputs jsonb not null,
  citations jsonb not null,
  derivation_method text not null,
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'reviewed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id, rule_key)
);

create or replace function public.set_fmds_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fmds_corpus_revisions_updated_at
before update on public.fmds_corpus_revisions
for each row execute function public.set_fmds_updated_at();
create trigger fmds_pages_updated_at
before update on public.fmds_pages
for each row execute function public.set_fmds_updated_at();
create trigger fmds_chunks_updated_at
before update on public.fmds_chunks
for each row execute function public.set_fmds_updated_at();
create trigger fmds_tables_updated_at
before update on public.fmds_tables
for each row execute function public.set_fmds_updated_at();
create trigger fmds_figures_updated_at
before update on public.fmds_figures
for each row execute function public.set_fmds_updated_at();
create trigger fmds_rule_cards_updated_at
before update on public.fmds_rule_cards
for each row execute function public.set_fmds_updated_at();

create or replace function public.prevent_fmds_revision_source_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.document_code <> old.document_code
     or new.revision_label <> old.revision_label
     or new.publication_date <> old.publication_date
     or new.source_file_name <> old.source_file_name
     or new.source_sha256 <> old.source_sha256
     or new.source_page_count <> old.source_page_count then
    raise exception 'FMDS revision source identity is immutable; create a new revision instead';
  end if;
  return new;
end;
$$;

create trigger prevent_fmds_revision_source_mutation
before update on public.fmds_corpus_revisions
for each row execute function public.prevent_fmds_revision_source_mutation();

create or replace view public.fmds_revision_coverage as
select
  r.id as revision_id,
  r.document_code,
  r.revision_label,
  r.status,
  r.source_page_count as expected_pages,
  coalesce(p.page_count, 0)::integer as page_count,
  coalesce(c.chunk_count, 0)::integer as chunk_count,
  coalesce(c.embedded_chunk_count, 0)::integer as embedded_chunk_count,
  coalesce(t.table_count, 0)::integer as table_count,
  coalesce(t.reviewed_table_count, 0)::integer as reviewed_table_count,
  coalesce(f.figure_count, 0)::integer as figure_count,
  coalesce(f.reviewed_figure_count, 0)::integer as reviewed_figure_count,
  coalesce(rc.rule_card_count, 0)::integer as rule_card_count,
  coalesce(rc.reviewed_rule_card_count, 0)::integer as reviewed_rule_card_count
from public.fmds_corpus_revisions r
left join lateral (
  select count(*) as page_count
  from public.fmds_pages p0
  where p0.revision_id = r.id
) p on true
left join lateral (
  select
    count(*) as chunk_count,
    count(*) filter (where c0.embedding_status = 'embedded' and c0.embedding_dimensions = 3072) as embedded_chunk_count
  from public.fmds_chunks c0
  where c0.revision_id = r.id
) c on true
left join lateral (
  select
    count(*) as table_count,
    count(*) filter (where t0.review_status = 'reviewed') as reviewed_table_count
  from public.fmds_tables t0
  where t0.revision_id = r.id
) t on true
left join lateral (
  select
    count(*) as figure_count,
    count(*) filter (where f0.review_status = 'reviewed') as reviewed_figure_count
  from public.fmds_figures f0
  where f0.revision_id = r.id
) f on true
left join lateral (
  select
    count(*) as rule_card_count,
    count(*) filter (where rc0.review_status = 'reviewed') as reviewed_rule_card_count
  from public.fmds_rule_cards rc0
  where rc0.revision_id = r.id
) rc on true;

create or replace view public.fmds_active_chunks as
select c.*, r.document_code, r.revision_label
from public.fmds_chunks c
join public.fmds_corpus_revisions r on r.id = c.revision_id
where r.status = 'active' and c.embedding_status = 'embedded';

create or replace function public.match_active_fmds_chunks(
  query_embedding public.halfvec(3072),
  match_count integer default 12,
  match_threshold double precision default 0.25
)
returns table (
  chunk_id uuid,
  revision_id uuid,
  document_code text,
  revision_label text,
  page_number integer,
  citation_label text,
  section_path text,
  clause_reference text,
  content text,
  similarity double precision
)
language sql
stable
set search_path = public
as $$
  select
    c.id,
    c.revision_id,
    r.document_code,
    r.revision_label,
    c.page_number,
    c.citation_label,
    c.section_path,
    c.clause_reference,
    c.content,
    (1 - (c.embedding <=> query_embedding))::double precision
  from public.fmds_chunks c
  join public.fmds_corpus_revisions r on r.id = c.revision_id
  where r.status = 'active'
    and c.embedding_status = 'embedded'
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

create or replace function public.match_staging_fmds_chunks(
  requested_revision_id uuid,
  query_embedding public.halfvec(3072),
  match_count integer default 12,
  match_threshold double precision default 0.25
)
returns table (
  chunk_id uuid,
  revision_id uuid,
  document_code text,
  revision_label text,
  page_number integer,
  citation_label text,
  section_path text,
  clause_reference text,
  content text,
  similarity double precision
)
language sql
stable
set search_path = public
as $$
  select
    c.id,
    c.revision_id,
    r.document_code,
    r.revision_label,
    c.page_number,
    c.citation_label,
    c.section_path,
    c.clause_reference,
    c.content,
    (1 - (c.embedding <=> query_embedding))::double precision
  from public.fmds_chunks c
  join public.fmds_corpus_revisions r on r.id = c.revision_id
  where r.id = requested_revision_id
    and r.status = 'staging'
    and c.embedding_status = 'embedded'
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

create or replace function public.activate_fmds_revision(requested_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.fmds_revision_coverage%rowtype;
begin
  select * into target
  from public.fmds_revision_coverage
  where revision_id = requested_revision_id;

  if target.revision_id is null then
    raise exception 'Unknown FMDS revision %', requested_revision_id;
  end if;
  if target.status <> 'staging' then
    raise exception 'Only a staging FMDS revision can be activated; current status is %', target.status;
  end if;
  if target.page_count <> target.expected_pages then
    raise exception 'Page coverage incomplete: expected %, found %', target.expected_pages, target.page_count;
  end if;
  if target.chunk_count = 0 or target.embedded_chunk_count <> target.chunk_count then
    raise exception 'Embedding coverage incomplete: % of % chunks embedded', target.embedded_chunk_count, target.chunk_count;
  end if;
  if target.reviewed_table_count <> target.table_count then
    raise exception 'Table review incomplete: % of % reviewed', target.reviewed_table_count, target.table_count;
  end if;
  if target.reviewed_figure_count <> target.figure_count then
    raise exception 'Figure review incomplete: % of % reviewed', target.reviewed_figure_count, target.figure_count;
  end if;
  if target.rule_card_count = 0 or target.reviewed_rule_card_count <> target.rule_card_count then
    raise exception 'Rule-card review incomplete: % of % reviewed', target.reviewed_rule_card_count, target.rule_card_count;
  end if;

  update public.fmds_corpus_revisions
  set status = 'superseded'
  where document_code = target.document_code and status = 'active';

  update public.fmds_corpus_revisions
  set status = 'active', activated_at = now()
  where id = requested_revision_id;
end;
$$;

alter table public.fmds_corpus_revisions enable row level security;
alter table public.fmds_ingestion_runs enable row level security;
alter table public.fmds_pages enable row level security;
alter table public.fmds_chunks enable row level security;
alter table public.fmds_tables enable row level security;
alter table public.fmds_table_cells enable row level security;
alter table public.fmds_figures enable row level security;
alter table public.fmds_rule_cards enable row level security;

revoke all on public.fmds_corpus_revisions from anon, authenticated;
revoke all on public.fmds_ingestion_runs from anon, authenticated;
revoke all on public.fmds_pages from anon, authenticated;
revoke all on public.fmds_chunks from anon, authenticated;
revoke all on public.fmds_tables from anon, authenticated;
revoke all on public.fmds_table_cells from anon, authenticated;
revoke all on public.fmds_figures from anon, authenticated;
revoke all on public.fmds_rule_cards from anon, authenticated;
revoke all on public.fmds_revision_coverage from anon, authenticated;
revoke all on public.fmds_active_chunks from anon, authenticated;
revoke all on function public.match_active_fmds_chunks(public.halfvec, integer, double precision) from public, anon, authenticated;
revoke all on function public.match_staging_fmds_chunks(uuid, public.halfvec, integer, double precision) from public, anon, authenticated;
revoke all on function public.activate_fmds_revision(uuid) from public, anon, authenticated;

grant select, insert, update, delete on public.fmds_corpus_revisions to service_role;
grant select, insert, update, delete on public.fmds_ingestion_runs to service_role;
grant select, insert, update, delete on public.fmds_pages to service_role;
grant select, insert, update, delete on public.fmds_chunks to service_role;
grant select, insert, update, delete on public.fmds_tables to service_role;
grant select, insert, update, delete on public.fmds_table_cells to service_role;
grant select, insert, update, delete on public.fmds_figures to service_role;
grant select, insert, update, delete on public.fmds_rule_cards to service_role;
grant select on public.fmds_revision_coverage, public.fmds_active_chunks to service_role;
grant execute on function public.match_active_fmds_chunks(public.halfvec, integer, double precision) to service_role;
grant execute on function public.match_staging_fmds_chunks(uuid, public.halfvec, integer, double precision) to service_role;
grant execute on function public.activate_fmds_revision(uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fmds-source-evidence',
  'fmds-source-evidence',
  false,
  26214400,
  array['application/pdf', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
