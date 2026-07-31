# Alleato Brain verifier v2 handoff

Status: Approved for Publication
Session: SBRAINVERIFY
Task: ALL-11-VERIFIER-V2

## Acceptance contract

- Legacy mapped project rows have the exact mapped Business Area.
- Business-Area-only rows have null project scope.
- Non-null dual scope is accepted only for the exact legacy mapping.
- AI Database document and chunk metadata match the same Business Area.
- Live verifier output is retained as evidence.

## Verification

- Transition fixture self-test passed.
- Live repair-guard negative test surfaced exact expected/candidate/document counts and proved the touched fixture timestamp rolled back.
- Exact-ID drift repair updated one Outlook Finance PM APP row, one AI Database document, and one chunk.
- Full-catalog comparison exposed and then reconciled 175 stale shared RAG documents and 2,068 linked chunks from the authoritative PM APP scope.
- The exact pre-repair scope keys are retained in `rag-scope-pre-repair-snapshot.json`; a count-guarded rollback SQL generator is included.
- Live cross-database verifier passed at `2026-07-24T05:46:05.764Z`.
- PM APP invalid/mismatched scope counts: zero.
- AI Database document/chunk mismatch counts: zero.
- Shared cross-database scope mismatches: zero.
- Business-Area-only missing replicas: zero in both directions.
- Effective AI Database table grants to anon/authenticated: none.
- Exact RAG search RPC ACL: postgres and service role only.
- Finance personas have explicit principal IDs; the project-60 membership case is inserted and rolled back inside one verification transaction.
- Finance remains app-admin-only because no Finance memberships have been approved.

## Migration ledger evidence

No migration is owned by this task. The verifier reads six applied foundation/security migration ledger entries.

## Review

Independent high-risk review: APPROVED.

## Remaining transition gates

- Reconcile 9 PM APP-only and 1,913 RAG-only legacy catalog rows before cutover; these are surfaced explicitly and cannot be mistaken for Business-Area-only parity.
- Confirm Render is running the published Fireflies commit and observe a clean scheduled run; four recurring RAG metadata drifts were caught and repaired, proving the older runtime remains unsafe until deployment is verified.
