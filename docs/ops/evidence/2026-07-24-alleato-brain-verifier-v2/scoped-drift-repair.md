# Scoped Outlook Finance drift repair

Applied 2026-07-24 to the one exact document reported by the baseline verifier.

Document ID:

`outlook_AAMkADllNTZkYTFlLTZiZDQtNGVlNS05MmNlLTBlNDRhMTdiMThiYwBGAAAAAAAwum4-eo4iQITmxDs_AMxLBwA2bV2EJf1iQqoGMNCZ1WvLAAAAAAEMAAA2bV2EJf1iQqoGMNCZ1WvLAAH-cXmFAAA=`

Classification basis: the PM APP row had `source_system='outlook_email'`,
legacy container `project_id=60`, and the authoritative
`business_area_project_map` maps project `60` to Finance Business Area `3`.

Before:

- PM APP: `project_id=60`, `business_area_id=NULL`, `access_level='team'`
- AI Database document: `project_id=60`, no `source_metadata.business_area_id`
- AI Database chunk: no `metadata.business_area_id`

Executed repair:

```sql
-- PM APP, constrained by exact ID and expected pre-state
update public.document_metadata
set business_area_id = 3, access_level = 'restricted'
where id = '<document-id>'
  and project_id = 60
  and business_area_id is null;

-- AI Database, constrained by exact ID and expected pre-state
update public.rag_document_metadata
set source_metadata = jsonb_set(
  coalesce(source_metadata, '{}'::jsonb),
  '{business_area_id}',
  '3'::jsonb,
  true
)
where id = '<document-id>'
  and project_id = 60
  and source_metadata->>'business_area_id' is null;

update public.document_chunks
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{business_area_id}',
  '3'::jsonb,
  true
)
where document_id = '<document-id>'
  and metadata->>'business_area_id' is null;
```

Row-count guardrails required exactly one PM APP document, one AI Database
document, and one chunk. All three matched.

After:

- PM APP: `project_id=60`, `business_area_id=3`, `access_level='restricted'`
- AI Database document: `project_id=60`, `source_metadata.business_area_id=3`
- AI Database chunk: `metadata.business_area_id=3`
- Cross-database verifier: PASS

Rollback (not executed; would intentionally restore the invalid pre-state):

```sql
update public.document_metadata
set business_area_id = null, access_level = 'team'
where id = '<document-id>'
  and project_id = 60
  and business_area_id = 3;

update public.rag_document_metadata
set source_metadata = source_metadata - 'business_area_id'
where id = '<document-id>'
  and project_id = 60
  and source_metadata->>'business_area_id' = '3';

update public.document_chunks
set metadata = metadata - 'business_area_id'
where document_id = '<document-id>'
  and metadata->>'business_area_id' = '3';
```

## Recurrence caught by the strengthened verifier

At `2026-07-24T05:17Z`, a second verifier run found four existing Fireflies
RAG metadata rows whose PM APP rows and chunks still had the correct Internal
Operations scope, but whose RAG document `source_metadata.business_area_id` had
been removed:

- `01KY0E39B9Y25QKGT3W7HS9YRP`
- `01KY4XD77T1XFEZ9N60FSGMTF3`
- `01KY4Y75AD95Z4AQ9AH4DB2AMS`
- `01KY85J0TG16P6FCVFVC7ZF46B`

The repair was constrained to those four IDs, `source='fireflies'`,
`project_id=90`, and a null Business Area label. Exactly four RAG documents and
zero chunks changed; the chunks already held Business Area `4`. The subsequent
verifier passed at `2026-07-24T05:18:36.854Z`.

Executed repair:

```sql
begin;
with repaired_documents as (
  update public.rag_document_metadata
  set
    source_metadata = jsonb_set(
      coalesce(source_metadata, '{}'::jsonb),
      '{business_area_id}',
      '4'::jsonb,
      true
    ),
    updated_at = now()
  where id in (
    '01KY0E39B9Y25QKGT3W7HS9YRP',
    '01KY4XD77T1XFEZ9N60FSGMTF3',
    '01KY4Y75AD95Z4AQ9AH4DB2AMS',
    '01KY85J0TG16P6FCVFVC7ZF46B'
  )
    and project_id = 90
    and source = 'fireflies'
    and source_metadata->>'business_area_id' is null
  returning id
),
repaired_chunks as (
  update public.document_chunks
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{business_area_id}',
    '4'::jsonb,
    true
  )
  where document_id in (
    '01KY0E39B9Y25QKGT3W7HS9YRP',
    '01KY4XD77T1XFEZ9N60FSGMTF3',
    '01KY4Y75AD95Z4AQ9AH4DB2AMS',
    '01KY85J0TG16P6FCVFVC7ZF46B'
  )
    and metadata->>'business_area_id' is distinct from '4'
  returning chunk_id
)
select
  (select count(*) from repaired_documents) as documents,
  (select count(*) from repaired_chunks) as chunks;
commit;
```

The statement returned `documents=4`, `chunks=0`.

Rollback (not executed; it would restore the invalid document pre-state):

```sql
update public.rag_document_metadata
set
  source_metadata = source_metadata - 'business_area_id',
  updated_at = now()
where id in (
  '01KY0E39B9Y25QKGT3W7HS9YRP',
  '01KY4XD77T1XFEZ9N60FSGMTF3',
  '01KY4Y75AD95Z4AQ9AH4DB2AMS',
  '01KY85J0TG16P6FCVFVC7ZF46B'
)
  and project_id = 90
  and source = 'fireflies'
  and source_metadata->>'business_area_id' = '4';
```

No chunk rollback is required because the repair changed zero chunks.

This recurrence is not considered runtime-closed. The source fix is published
on `origin/main`, but the session has neither `RENDER_API_KEY` nor
`RENDER_TOKEN`; production health does not expose a Git SHA. Deployment and the
next scheduled Fireflies run therefore remain explicit live gates.
