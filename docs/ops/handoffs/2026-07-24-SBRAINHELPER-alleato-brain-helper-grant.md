# Business Area helper grant handoff

Status: Approved for Publication
Session: SBRAINHELPER
Task: ALL-11-HELPER-GRANT

## Acceptance contract

- Anonymous and public callers cannot execute the security-definer helper.
- Authenticated and service-role callers retain execute.
- The migration is applied and ledgered on PM APP.
- The foundation verifier passes.

## Verification

- Exact migration applied successfully.
- `npm run db:migrations:verify-applied -- supabase/migrations/20260724052000_revoke_anon_business_area_helper.sql` passed.
- Live cross-database verifier passed at `2026-07-24T05:46:05.764Z`.
- Effective ACL: anon false; authenticated true; service role true.
- Exact ACL grantees: authenticated, postgres, and service role.

## Migration ledger evidence

`20260724052000` is present in the PM APP remote ledger.

## Incident learning

`security.security-definer-anon-execute`

## Review

Independent high-risk review: APPROVED.
