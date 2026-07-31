# AI Database search RPC grant verification

Verified 2026-07-24 against AI Database `fqcvmfqldlewvbsuxdvz`.

| Check | Result |
| --- | --- |
| Baseline ACL | `PUBLIC` retained execute; anon/authenticated effective execute were true |
| Migration apply | `20260724052500_revoke_public_rag_search.sql` applied successfully |
| Remote ledger | `20260724052500` present |
| Effective privilege after apply | anon false; authenticated false; service role true |
| Complete exact-signature ACL | `postgres`, `service_role` |
| Service-role RPC invocation | PASS; exact ten-argument RPC returned `result_count=1` inside a rolled-back transaction |
| Cross-database verifier | PASS at `2026-07-24T05:15:09.033Z` |

The migration changes grants only. Search implementation, embeddings, document
metadata, and chunk content are unchanged.

## Exact service-role invocation

Executed through the Supabase Management API:

```sql
begin;
set local role service_role;
select count(*)::int as result_count
from public.search_document_chunks(
  (
    '['
    || array_to_string(
      array_fill(0::double precision, array[3072]),
      ','
    )
    || ']'
  )::halfvec,
  null::text[],
  null::bigint,
  1::integer,
  1.0::double precision,
  'vector'::text,
  null::text,
  false::boolean,
  null::text,
  null::text
);
rollback;
```

Result:

```json
[{"result_count":1}]
```

The query uses a 3,072-dimensional zero vector, requests one vector-mode
result, and supplies explicit types for every nullable argument. `set local`
and `rollback` ensure the role switch and transaction state do not persist.
