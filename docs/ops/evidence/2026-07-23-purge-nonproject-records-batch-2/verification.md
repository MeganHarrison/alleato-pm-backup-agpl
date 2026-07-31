# Project Purge Verification — Batch 2

Task: `LOCAL-2026-07-23-PURGE-NONPROJECTS-BATCH-2`

## Exact Target Binding

All eighteen production rows were bound to exact database names and internal
IDs, with job and Acumatica identifiers where present. Three user labels mapped
to unique full database names:

- `Test-Zaryll` → `Test-Zaryll-04-09-2026`
- `Seminole Colective` → `Seminole Collective`
- `Temporary project code for Forza` → the full Forza Cincinnati temporary
  project name

## Action Log

1. Ran eight focused guardrail tests.
2. Inventoried every direct project reference, indirect financial child, exact
   RAG document reference, and project-folder storage candidate.
3. Ran the complete app/RAG deletion sequence in transactions and rolled it
   back. All eighteen project rows deleted in the rehearsal.
4. Reviewed all 485 `project-files` paths under exact selected project-ID
   prefixes and removed them through the Supabase Storage API in five
   successful batches. The manifest-bound `storage-delete.json` receipt binds
   the operation to the dry-run and candidate-set hashes.
5. The storage receipt, committed apply, and final verifier each record zero
   remaining exact project-folder storage objects.
6. Proved a wrong confirmation fails before any deletion transaction opens.
7. Applied with manifest-bound confirmation
   `PURGE_PROJECTS_C8AF64D4321261DE`.
8. Ran a separate verifier using the matching apply receipt and replayed all
   8,535 exact RAG document IDs.

## Outcome

- Eighteen active projects deleted.
- 18,174 directly counted application rows deleted, plus 651 explicitly
  counted indirect financial children and database cascades.
- All 191 meetings and 113 meeting series owned by these projects deleted.
- 40,882 RAG rows deleted, including 8,535 source documents and their chunks,
  ingestion jobs, derived intelligence, and other document references.
- All 485 reviewed project files (412,936,884 bytes) were deleted.
- 494 cost-ledger rows retained with project attribution cleared.
- Zero active project rows, non-audit app references, RAG project references,
  exact RAG document references, or exact storage paths remain.
- Shared people and companies were not purge targets.
- Historical project and AI-write audit tombstones remain intentionally.

## Negative Path

An apply attempt with `--confirm=WRONG` exited nonzero with:

> Project purge failed: Apply confirmation mismatch. Run dry-run and use its
> requiredConfirmation value.

The tool also rejects missing or mismatched apply receipts and incomplete exact
RAG document ID lists during verification.

## Checks

- `node --check scripts/ops/purge-projects.mjs` — pass
- `node --test scripts/ops/__tests__/purge-projects.test.mjs` — 8/8 pass
- Production rollback rehearsal — pass
- Production apply — `APPLY_PASS`
- Receipt-bound production verification — `VERIFY_PASS`
