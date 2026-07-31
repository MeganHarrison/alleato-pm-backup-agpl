# Project Purge Verification

Task: `LOCAL-2026-07-23-PURGE-NONPROJECTS`

## Action log

1. Resolved all seven names to one production row each and bound the manifest
   to internal IDs plus job/Acumatica identifiers where present.
2. Inventoried direct project references in the app and RAG databases,
   indirect RAG document references, and exact project-folder storage paths.
3. Ran the complete app and RAG deletion sequence inside transactions and
   rolled both back. The rehearsal deleted seven project rows without a
   remaining scoped reference.
4. Applied with confirmation
   `PURGE_PROJECTS_BC4C7E2F7E568012`.
5. Ran a fresh deleted-state verification using the manifest IDs and names.

## Negative path

An apply attempt with `--confirm=WRONG` exited nonzero with:

> Project purge failed: Apply confirmation mismatch. Run dry-run and use its
> requiredConfirmation value.

No deletion transaction opens until the confirmation matches the canonical
manifest digest.

Future verify runs also fail closed unless they receive the matching
manifest-bound `APPLY_PASS` receipt containing every deleted RAG document ID.
Eight focused tests cover missing receipts, mismatched receipts, and incomplete
document-ID receipts.

## Outcome

- Seven active project rows removed.
- Zero remaining non-audit app references.
- Zero remaining RAG project references.
- Zero remaining references to the exact 332 deleted RAG document IDs.
- Zero exact project-folder storage objects before and after apply.
- Historical audit tombstones retained.
- Thirty-nine AI cost-ledger rows retained with `project_id` cleared.

The anonymous production projects API returned `401`, as expected without a
user session. The production database and RAG readbacks are the authoritative
verification boundary for this operation.
