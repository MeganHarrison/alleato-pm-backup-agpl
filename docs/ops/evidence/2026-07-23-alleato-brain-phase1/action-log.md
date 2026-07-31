# Action log — Alleato Brain foundation

Task: ALL-7
Session: SBRAIN1

- Applied the additive Business Area foundation migration to production PM APP.
- Verified migration version `20260723180000` in the remote ledger.
- Seeded five branches and five permanent legacy-container mappings.
- Added the nullable document branch column, membership helper, indexes, RLS,
  and admin/member policies.
- Recorded the Phase 1 zero-row-change snapshot.
- Recorded the Phase 2 dual-label migration snapshot for 2,115 documents and
  12,651 then-current chunks.
- Added a repeatable read-only verifier spanning PM APP and AI Database.
- Hardened the verifier after independent review so it checks exact per-branch
  app and RAG parity, policy modes and expressions, integrity constraints,
  grants, migration ledgers, and live Finance visibility under four principals.
- The hardened verifier then detected one new Fireflies project-60 document
  without a Finance label. This is an intentional red gate until the Fireflies
  caller is routed through typed Business Area assignment and the scoped drift
  is repaired.
- Left all five container projects active for the measured parallel run.
- Left Finance membership empty rather than inventing authorization.
