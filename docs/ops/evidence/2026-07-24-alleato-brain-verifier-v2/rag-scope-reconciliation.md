# RAG scope reconciliation

Applied at 2026-07-24T05:31Z after the strengthened verifier found 175 shared
document IDs whose AI Database scope differed from the authoritative PM APP
`document_metadata` row.

## Cause and repair contract

The legacy `copy-document-metadata-to-rag.mjs` path selected `project_id` but
omitted the separate `business_area_id` column. Existing RAG rows could
therefore retain a stale project or Business Area label after PM APP scope
changed.

The repair command was:

```bash
ALLEATO_ENV_FILE=/home/friday/code/project-management/.env \
  node scripts/database/verify-alleato-brain-foundation.mjs \
  --repair-rag-scope \
  --confirm-app-authoritative
```

The command:

1. loaded complete PM APP and RAG catalogs;
2. selected only shared IDs where `project_id` or Business Area differed;
3. captured the exact scope-key pre-state for every affected document and chunk in
   `rag-scope-pre-repair-snapshot.json`;
4. required each RAG document to still match the diagnosed pre-state;
5. copied PM APP `project_id` and `business_area_id` to the RAG document and
   all linked chunk metadata in one AI Database transaction.

Executed mutation shape:

```sql
begin;
with desired as (
  select *
  from jsonb_to_recordset(<175 exact candidates>) as scope(
    id text,
    desired_project_id integer,
    desired_business_area_id bigint,
    expected_project_id integer,
    expected_business_area_id bigint
  )
),
updated_documents as (
  update public.rag_document_metadata as document
  set
    project_id = desired.desired_project_id,
    source_metadata =
      (coalesce(document.source_metadata, '{}'::jsonb) - 'business_area_id')
      || jsonb_strip_nulls(jsonb_build_object(
        'business_area_id', desired.desired_business_area_id
      )),
    updated_at = now()
  from desired
  where document.id = desired.id
    and document.project_id is not distinct from desired.expected_project_id
    and document.source_metadata->>'business_area_id'
      is not distinct from desired.expected_business_area_id::text
  returning document.id
),
updated_chunks as (
  update public.document_chunks as chunk
  set metadata =
    (coalesce(chunk.metadata, '{}'::jsonb)
      - 'project_id'
      - 'business_area_id')
    || jsonb_strip_nulls(jsonb_build_object(
      'project_id', desired.desired_project_id,
      'business_area_id', desired.desired_business_area_id
    ))
  from desired
  join updated_documents on updated_documents.id = desired.id
  where chunk.document_id = desired.id
  returning chunk.chunk_id
)
select
  (select count(*) from desired) as candidates,
  (select count(*) from updated_documents) as documents,
  (select count(*) from updated_chunks) as chunks;
commit;
```

Result:

```json
{"status":"PASS","candidates":175,"documents":175,"chunks":2068}
```

The full candidate values and exact pre-repair scope-key values are in
`rag-scope-pre-repair-snapshot.json`; no content, embeddings, or unrelated
metadata keys were changed.

## Rollback contract

Rollback was not executed because it would restore known-invalid scope. The
snapshot did not capture the prior `rag_document_metadata.updated_at`, so this
is an exact scope-key rollback—not a byte-for-byte row rollback. The operational
timestamp would remain the repair timestamp.

Generate the runnable restore SQL directly from the retained snapshot:

```bash
node scripts/database/verify-alleato-brain-foundation.mjs \
  --generate-rag-scope-rollback
```

The generated transaction embeds all 175 document and 2,068 chunk snapshots,
requires every row to still match the repaired PM-authoritative scope, restores
the original presence/value of each project and Business Area JSON key, and
aborts before commit with `RAG_SCOPE_ROLLBACK_COUNT_MISMATCH` unless all
`175 + 2,068` rows match. Review the generated SQL before submitting it to the
AI Database Management API.

## Readback

`live-verifier.json` at `2026-07-24T05:46:05.764Z` reports:

- shared scope mismatches: `0`
- Business-Area-only missing replicas: `0` in both directions
- RAG document/chunk scope mismatches: `0`
- malformed or invalid standalone chunk scope: `0`
- legacy catalog-only gaps: `9` PM APP rows and `1,913` RAG rows, explicitly
  retained as a separate cutover prerequisite
