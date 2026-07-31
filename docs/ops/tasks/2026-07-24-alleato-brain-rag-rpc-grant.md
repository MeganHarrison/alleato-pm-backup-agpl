# Task: Restrict AI Database search RPC

Status: Approved for Publication
Owner: Codex
Created: 2026-07-24
Task ID: ALL-11-RAG-RPC-GRANT
Linear Issue: ALL-11 (connector unavailable in this session; work remains linked by the existing issue ID)
Related Handoff: `docs/ops/handoffs/2026-07-24-SBRAINRAGACL-alleato-brain-rag-rpc-grant.md`

## Objective

Make `service_role` the only non-owner runtime role that can execute the AI Database knowledge search RPC.

## Scope

- `scripts/database/rag/migrations/20260724052500_revoke_public_rag_search.sql`
- Live AI Database migration application, ACL readback, and ledger verification
- Explicitly excludes changing search behavior or embeddings

## Source of Truth

- Canonical runtime/data owner: `public.search_document_chunks(...)` in AI Database
- Existing shared primitives/services: server-side service-role RAG client
- Deprecated or parallel paths: direct anon/authenticated RPC access

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `PUBLIC`, `anon`, and `authenticated` cannot execute the search RPC.
- [x] `service_role` retains execute; the PostgreSQL owner retains its inherent owner access.
- [x] The AI Database remote ledger contains migration `20260724052500`.
- [x] The cross-database Alleato Brain verifier passes.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] The canonical search RPC remains unchanged.
- [x] The failure names the exact grant contract.
- [x] The database security contract is idempotent.

## Integration and Verification

- [x] Targeted migration checks pass.
- [x] Actual live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `AI Database search_document_chunks execution grants are not service-role-only.`
- Detection path: `ALLEATO_ENV_FILE=/home/friday/code/project-management/.env node scripts/database/verify-alleato-brain-foundation.mjs`
- Recovery path: apply the idempotent RAG grant migration and verify ACL plus remote ledger.

## Incident Learning

- Failure fingerprint: `security.security-definer-anon-execute`
- Root cause: The prior RAG hardening revoked named roles but left PostgreSQL `PUBLIC` execute, which anon/authenticated inherited.
- Detection gap: Migration closeout did not inspect effective privileges through `has_function_privilege`.
- Prevention: Revoke `PUBLIC` and named roles explicitly and enforce effective privilege readback in the shared live verifier.
- Guardrail evidence: `scripts/database/verify-alleato-brain-foundation.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Baseline ACL | Live `pg_proc` and `has_function_privilege` readback | Fail as expected | ACL contained `=X/postgres`; anon/authenticated effective execute were true. |
| Migration ledger | AI Database `supabase_migrations.schema_migrations` readback | Pass | `20260724052500` present. |
| Effective ACL | Cross-database live verifier | Pass | anon/authenticated false; service role true. |
| Complete ACL | Exact `regprocedure` plus `aclexplode` readback | Pass | Execute grantees are exactly `postgres` and `service_role`. |
| Runtime invocation | Rolled-back `SET LOCAL ROLE service_role` call to exact RPC signature | Pass | RPC executed and returned a result set after the revoke. |
| Evidence | `docs/ops/evidence/2026-07-24-alleato-brain-rag-rpc-grant/verification.md` | Pass | Live results recorded without secrets. |

## Remaining Risk

- Independent high-risk review approved the exact ACL and service-role invocation evidence. Publication is the remaining mechanical closeout.

## Final Status

- [x] All required checklist items are complete except the publication receipt updated by `codex:finish`.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No deferred task-owned work remains.
