# RAG scope synchronization verification

## Targeted checks

```text
$ node --check scripts/database/rag/copy-document-metadata-to-rag.mjs
PASS

$ node --test scripts/database/rag/__tests__/copy-document-metadata-to-rag.test.mjs
7 tests passed
```

The tests prove that a stale Business Area is overwritten from the
authoritative PM APP column, explicit null removes the stale key, a nonzero
document/chunk mismatch fails with the full postcondition counts, and an
incomplete source scan fails with expected/actual counts.
The orchestration tests also prove the exact repeatable-read/read-only
transaction option, cursor progression across multiple keyset pages, and
failure on non-increasing IDs.

## Live boundary proof

The strengthened cross-database verifier diagnosed 175 shared IDs with stale
RAG scope. Its guarded repair updated 175 RAG documents and 2,068 linked chunks.
The exact pre-state is stored in:

`docs/ops/evidence/2026-07-24-alleato-brain-verifier-v2/rag-scope-pre-repair-snapshot.json`

The subsequent live verifier passed at `2026-07-24T05:46:05.764Z` with:

- `sharedMismatchCount=0`
- `appBusinessAreaOnlyMissingRagCount=0`
- `ragBusinessAreaOnlyMissingAppCount=0`
- `document_scope_mismatch_count=0`
- `invalid_document_orphan_count=0`
- `invalid_standalone_dual_scope_count=0`
- `standalone_mapped_scope_mismatch_count=0`

Normal and `--scope-only` execution now share the same document/chunk scope
reconciliation. The source catalog is held in a read-only repeatable-read
transaction and keyset-paginated by document ID. Every RAG batch is read back
after its write and once again across the complete retained scope snapshot
before successful exit; document or chunk mismatches fail with
`RAG_SCOPE_POSTCONDITION_FAILED`. A final source count mismatch fails with
`SOURCE_SNAPSHOT_COUNT_MISMATCH`. Scope-only remains limited to existing RAG
rows and never writes content or embedding fields.
