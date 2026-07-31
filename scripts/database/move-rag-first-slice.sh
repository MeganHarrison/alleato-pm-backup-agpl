#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Move the first high-risk RAG tables to the AI/RAG database.

Required env:
  APP_DB_URL   Source app database URL
  RAG_DB_URL   Target AI/RAG database URL

Optional env:
  WORK_DIR             Default: /tmp/alleato-rag-db-move
  CONNECT_TIMEOUT      Default: 8
  SKIP_RESTORE         Set to 1 to dump and validate only
  RELOAD_TARGET_DATA   Set to 1 to truncate target tables before restore

This script is intentionally copy-only for the source database. It never drops,
truncates, or cleans source tables.
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_env() {
  if [[ -z "${!1:-}" ]]; then
    echo "Missing required env var: $1" >&2
    exit 1
  fi
}

require_command psql
require_command pg_dump
require_command pg_restore
require_env APP_DB_URL
require_env RAG_DB_URL

WORK_DIR="${WORK_DIR:-/tmp/alleato-rag-db-move}"
CONNECT_TIMEOUT="${CONNECT_TIMEOUT:-8}"
DUMP_FILE="${WORK_DIR}/rag-first-slice.dump"
SCHEMA_PREVIEW_FILE="${WORK_DIR}/rag-first-slice.schema.sql"

mkdir -p "$WORK_DIR"

with_timeout() {
  local url="$1"
  if [[ "$url" == *"connect_timeout="* ]]; then
    printf '%s' "$url"
  elif [[ "$url" == *"?"* ]]; then
    printf '%s&connect_timeout=%s' "$url" "$CONNECT_TIMEOUT"
  else
    printf '%s?connect_timeout=%s' "$url" "$CONNECT_TIMEOUT"
  fi
}

APP_DB_URL_TIMEOUT="$(with_timeout "$APP_DB_URL")"
RAG_DB_URL_TIMEOUT="$(with_timeout "$RAG_DB_URL")"

echo "Checking source app database readiness..."
psql "$APP_DB_URL_TIMEOUT" -v ON_ERROR_STOP=1 -qAt -c "select 'source_ready';" >/dev/null

echo "Checking target AI/RAG database readiness..."
psql "$RAG_DB_URL_TIMEOUT" -v ON_ERROR_STOP=1 -qAt -c "select 'target_ready';" >/dev/null

echo "Preparing target extensions..."
psql "$RAG_DB_URL_TIMEOUT" -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
select 'extensions.halfvec'::regtype;
SQL

echo "Dumping source RAG first-slice tables..."
pg_dump "$APP_DB_URL_TIMEOUT" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --table=public.document_chunks \
  --table=public.fireflies_ingestion_jobs \
  --file="$DUMP_FILE"

echo "Writing schema preview..."
pg_restore \
  --schema-only \
  --file="$SCHEMA_PREVIEW_FILE" \
  "$DUMP_FILE"

if [[ "${SKIP_RESTORE:-0}" == "1" ]]; then
  echo "SKIP_RESTORE=1 set; stopping after dump."
  echo "Dump: $DUMP_FILE"
  echo "Schema preview: $SCHEMA_PREVIEW_FILE"
  exit 0
fi

echo "Preparing clean RAG-side target schema..."
psql "$RAG_DB_URL_TIMEOUT" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists public.document_chunks (
    chunk_id text not null,
    document_id text not null,
    chunk_index integer not null,
    text text not null,
    metadata jsonb,
    content_hash text,
    embedding extensions.halfvec(3072),
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,
    source_type text default 'document'::text
);

create table if not exists public.fireflies_ingestion_jobs (
    id uuid default gen_random_uuid() not null,
    fireflies_id text not null,
    metadata_id text,
    stage text default 'pending'::text not null,
    attempt_count integer default 0 not null,
    last_attempt_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint fireflies_ingestion_jobs_stage_check check (stage = any (array['pending'::text, 'raw_ingested'::text, 'segmented'::text, 'chunked'::text, 'embedded'::text, 'structured_extracted'::text, 'done'::text, 'error'::text]))
);
SQL

if [[ "${RELOAD_TARGET_DATA:-0}" == "1" ]]; then
  echo "RELOAD_TARGET_DATA=1 set; truncating target RAG tables only."
  psql "$RAG_DB_URL_TIMEOUT" -v ON_ERROR_STOP=1 <<'SQL'
truncate table public.document_chunks restart identity cascade;
truncate table public.fireflies_ingestion_jobs restart identity cascade;
SQL
else
  EXISTING_TARGET_ROWS="$(psql "$RAG_DB_URL_TIMEOUT" -v ON_ERROR_STOP=1 -qAt <<'SQL'
select (select count(*) from public.document_chunks) + (select count(*) from public.fireflies_ingestion_jobs);
SQL
)"
  if [[ "$EXISTING_TARGET_ROWS" != "0" ]]; then
    echo "Target RAG tables already contain ${EXISTING_TARGET_ROWS} rows." >&2
    echo "Set RELOAD_TARGET_DATA=1 to intentionally reload target data." >&2
    exit 1
  fi
fi

echo "Restoring into target AI/RAG database..."
pg_restore \
  --dbname="$RAG_DB_URL_TIMEOUT" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "$DUMP_FILE"

echo "Adding target constraints and indexes..."
psql "$RAG_DB_URL_TIMEOUT" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'document_chunks_pkey' and conrelid = 'public.document_chunks'::regclass) then
    alter table public.document_chunks add constraint document_chunks_pkey primary key (chunk_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'document_chunks_chunk_id_key' and conrelid = 'public.document_chunks'::regclass) then
    alter table public.document_chunks add constraint document_chunks_chunk_id_key unique (chunk_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fireflies_ingestion_jobs_pkey' and conrelid = 'public.fireflies_ingestion_jobs'::regclass) then
    alter table public.fireflies_ingestion_jobs add constraint fireflies_ingestion_jobs_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fireflies_ingestion_jobs_fireflies_id_key' and conrelid = 'public.fireflies_ingestion_jobs'::regclass) then
    alter table public.fireflies_ingestion_jobs add constraint fireflies_ingestion_jobs_fireflies_id_key unique (fireflies_id);
  end if;
end $$;

set maintenance_work_mem = '256MB';
create index if not exists idx_document_chunks_content_hash on public.document_chunks using btree (content_hash);
create index if not exists idx_document_chunks_created_at on public.document_chunks using btree (created_at desc);
create index if not exists idx_document_chunks_document_id on public.document_chunks using btree (document_id);
create index if not exists idx_document_chunks_embedded_document_id on public.document_chunks using btree (document_id) where (embedding is not null);
create index if not exists idx_document_chunks_source_type on public.document_chunks using btree (source_type);
create index if not exists idx_document_chunks_embedding_ivfflat on public.document_chunks using ivfflat (embedding extensions.halfvec_cosine_ops) with (lists='200');
create index if not exists idx_document_chunks_teams_embedding on public.document_chunks using hnsw (embedding extensions.halfvec_cosine_ops) with (m='8', ef_construction='32') where (source_type = any (array['teams_dm'::text, 'teams_channel'::text]));

create index if not exists fireflies_ingestion_jobs_metadata_idx on public.fireflies_ingestion_jobs using btree (metadata_id);
create index if not exists fireflies_ingestion_jobs_stage_idx on public.fireflies_ingestion_jobs using btree (stage);
create index if not exists idx_fireflies_ingestion_backlog_candidates on public.fireflies_ingestion_jobs using btree (updated_at desc, metadata_id) where ((stage = any (array['raw_ingested'::text, 'error'::text])) and (metadata_id <> ''::text));

analyze public.document_chunks;
analyze public.fireflies_ingestion_jobs;
SQL

echo "Running target parity summary..."
psql "$RAG_DB_URL_TIMEOUT" -v ON_ERROR_STOP=1 <<'SQL'
select 'document_chunks' as table_name, count(*) from public.document_chunks
union all
select 'fireflies_ingestion_jobs', count(*) from public.fireflies_ingestion_jobs;

select
  count(*) as total_chunks,
  count(*) filter (where embedding is not null) as embedded_chunks,
  count(*) filter (where embedding is null) as missing_embeddings
from public.document_chunks;

select stage, count(*)
from public.fireflies_ingestion_jobs
group by stage
order by count(*) desc;
SQL

echo "RAG first-slice move completed."
