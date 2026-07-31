# Project Purge Verification — Batch 3

Task: `LOCAL-2026-07-23-PURGE-NONPROJECTS-BATCH-3`

## Action Log

1. Resolved two unique production rows by normalized exact name, internal ID,
   job number, and Acumatica ID.
2. Added a regression test for harmless trailing database name whitespace;
   duplicate normalized names still fail closed.
3. Ran nine focused tests and the full database deletion sequence in rollback
   transactions.
4. Reviewed 122 exact project-folder files and removed them through Supabase
   Storage in two successful batches. The storage receipt binds the dry-run and
   exact candidate-set hashes.
5. Proved a wrong confirmation fails before any deletion transaction.
6. Applied with `PURGE_PROJECTS_1073EBE83E4BB27A`.
7. Ran the receipt-bound verifier and replayed all 530 exact RAG document IDs.

## Outcome

- Superior Beverae Exotec (ID 178) and Paradise Isle Geotech (ID 58) deleted.
- 1,778 directly counted app rows and 10 indirect financial children deleted,
  plus database cascades.
- All 26 meetings and 20 meeting series deleted.
- 4,073 RAG rows deleted, including 530 exact source documents.
- 122 project files (62,855,536 bytes) deleted.
- 86 cost-ledger rows retained with project attribution cleared.
- Zero active project, non-audit app, RAG project, exact document, or exact
  storage references remain.
- Shared companies/people were not targets; 573 historical project audit rows
  remain intentionally.

## Negative Path

An apply attempt with `--confirm=WRONG` exited nonzero before deletion:

> Project purge failed: Apply confirmation mismatch. Run dry-run and use its
> requiredConfirmation value.

## Checks

- `node --check scripts/ops/purge-projects.mjs` — pass
- `node --test scripts/ops/__tests__/purge-projects.test.mjs` — 9/9 pass
- Production rollback rehearsal — pass
- Storage deletion and zero-object readback — pass
- Production apply — `APPLY_PASS`
- Receipt-bound production verification — `VERIFY_PASS`
