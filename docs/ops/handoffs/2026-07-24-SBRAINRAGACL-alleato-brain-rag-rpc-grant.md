# AI Database RPC grant handoff

Status: Approved for Publication
Session: SBRAINRAGACL
Task: ALL-11-RAG-RPC-GRANT

## Acceptance contract

- `PUBLIC`, `anon`, and `authenticated` cannot execute the server-only search RPC.
- `service_role` is the only non-owner runtime execute grantee; PostgreSQL owner access remains.
- Migration `20260724052500` is applied and ledgered on AI Database.
- The cross-database foundation verifier passes.

## Verification

- Exact migration applied successfully.
- AI Database ledger contains `20260724052500`.
- Live cross-database verifier passed at `2026-07-24T05:46:05.764Z`.
- Effective ACL: anon false; authenticated false; service role true.
- Exact ACL grantees: postgres and service role.
- A rolled-back `SET LOCAL ROLE service_role` invocation of the exact RPC signature succeeded.

## Migration ledger evidence

`20260724052500` is present in the AI Database remote ledger.

## Incident learning

`security.security-definer-anon-execute`

## Review

Independent high-risk review: APPROVED.
