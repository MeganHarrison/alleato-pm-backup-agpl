# Negative-path evidence

- The foundation migration is additive. The later hardening migration
  deliberately tightens Finance to a restrictive deny-by-default RLS contract;
  no membership is fabricated and app admins are the only current override.
- The production verifier rejects a missing branch, unexpected mapping,
  incorrect Finance restriction, missing policy, early container archive, or
  mismatch between current RAG branch and retained legacy labels.
- Provider readback uses the Supabase Management API and never prints tokens or
  database credentials.
- Migration replay is ledger-governed. Operators must inspect the failed
  statement and ledger rather than blindly replaying policy creation.
- The verifier proved its drift guard by failing on a newly ingested Fireflies
  row instead of allowing a stale point-in-time PASS to close the task.
