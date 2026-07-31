# Task: Restrict Business Area membership helper

Status: Approved for Publication
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-HELPER-GRANT
Linear Issue: ALL-11 (connector unavailable in this session; work remains linked by the existing issue ID)
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINHELPER-alleato-brain-helper-grant.md`

## Objective

Remove anonymous execution access from the security-definer Business Area membership helper and prove the live database contract.

## Scope

- `supabase/migrations/20260724052000_revoke_anon_business_area_helper.sql`
- Live PM APP migration application and privilege readback
- Explicitly excludes changing Business Area membership or Finance access assignments

## Source of Truth

- Canonical runtime/data owner: PostgreSQL function ACL for `public.current_is_business_area_member(bigint)`
- Existing shared primitives/services: restricted Business Area RLS policy
- Deprecated or parallel paths: anonymous RPC access

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `anon` and `PUBLIC` cannot execute the helper.
- [x] `authenticated` and `service_role` can execute the helper.
- [x] The migration is present in the linked remote ledger.
- [x] The Alleato Brain foundation verifier passes the helper security assertion.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared RLS helper remains the authorization owner.
- [x] Failure is surfaced by an exact function-privilege assertion.
- [x] The migration is idempotent and additive.

## Integration and Verification

- [x] Live Supabase types were regenerated and the Business Area tables/FKs were inspected before database code.
- [x] Targeted migration checks pass.
- [x] Actual live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: verifier assertion that names the Business Area membership helper grant contract.
- Detection path: `ALLEATO_ENV_FILE=/home/friday/code/project-management/.env node scripts/database/verify-alleato-brain-foundation.mjs`
- Recovery path: apply the idempotent grant migration and verify the function ACL and migration ledger.

## Incident Learning

- Failure fingerprint: `security.security-definer-anon-execute`
- Root cause: Production retained an explicit `anon=X` ACL on the security-definer membership helper despite the foundation migration's intended `PUBLIC` revoke.
- Detection gap: The initial migration application was not closed with an exact post-application ACL readback.
- Prevention: Idempotently revoke both `PUBLIC` and `anon`, then make the cross-database live verifier enforce the exact grant matrix.
- Guardrail evidence: `scripts/database/verify-alleato-brain-foundation.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Types gate | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Pass | Live schema contains Business Area tables and expected FKs. Generated CLI formatting drift is not task-owned and is not published. |
| Baseline ACL | `has_function_privilege(...)` live readback | Fail as expected | `anon_execute=true`; authenticated and service role also true. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260724052000_revoke_anon_business_area_helper.sql` | Pass | Exact version is present remotely. |
| Effective ACL | Cross-database live verifier | Pass | anon false; authenticated and service role true. |
| Complete ACL | Exact `regprocedure` plus `aclexplode` readback | Pass | Execute grantees are exactly authenticated, postgres, and service role. |
| Evidence | `docs/ops/evidence/2026-07-24-alleato-brain-helper-grant/verification.md` | Pass | Live results recorded without secrets. |

## Remaining Risk

- Independent high-risk review approved the exact ACL contract. Publication is the remaining mechanical closeout.

## Final Status

- [x] All required checklist items are complete except the publication receipt updated by `codex:finish`.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No deferred task-owned work remains.
