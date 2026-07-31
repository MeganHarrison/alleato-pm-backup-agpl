# Database contract readback

- Migration: `supabase/migrations/20260722173000_atomic_ai_prime_contract_sov_edits.sql`
- Live migration application: PASS; the migration was reapplied successfully to prove rerunnability.
- Contract readback: PASS; Prime Contract and SOV columns, numeric precision, contract status/executed fields, visibility fields, active budget-code linkage, audit ledger, and service-only RPC matched the implementation contract.
- Authorization readback: PASS; project access, active service-linked identity, `contracts:write`, private-contract visibility, and deny-wins overrides fail closed.
- Atomicity readback: PASS; the RPC locks and revalidates the draft contract and expected SOV snapshot before applying confirmed rows.

The production verification intentionally stopped at preview. No contract financial row was mutated for this evidence run.
