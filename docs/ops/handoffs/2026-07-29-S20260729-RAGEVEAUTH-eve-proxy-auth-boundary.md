# Handoff: Eve Proxy Authentication Boundary

Status: In Progress
Session: S20260729-RAGEVEAUTH
Task: AAI-1280
Delivery lane: High-risk
Verification contract: Required

## Summary

The deployed app authenticated a temporary Supabase user and created a durable
turn, but the separate Eve deployment returned HTTP 401. Aligning the shared
proxy secret did not change the result; an incorrect proxy secret would return
HTTP 403. The localized failure was therefore the ambient browser bearer
contract across two Vercel projects.

The repair removes `Authorization` from the cross-project allowlist. After the
app authenticates the browser request, it copies only the token value into
`x-alleato-user-access-token`. Eve validates `ALLEATO_EVE_PROXY_SECRET` before
reading that internal header. A caller-supplied value cannot cross the proxy
allowlist or override the app-derived token.

## Owned Files

- `frontend/src/app/api/ai-assistant/eve/proxy/[...path]/eve-proxy.ts`
- `frontend/src/app/api/ai-assistant/eve/proxy/[...path]/__tests__/eve-proxy.test.ts`
- `agents/alleato-assistant/agent/lib/auth.ts`
- `agents/alleato-assistant/tests/auth.test.ts`
- `docs/ops/tasks/2026-07-29-eve-proxy-auth-boundary.md`
- `docs/ops/handoffs/2026-07-29-S20260729-RAGEVEAUTH-eve-proxy-auth-boundary.md`

## Evidence

- Proxy unit contract: 16/16 passed, including malformed-NDJSON fail-loud behavior.
- Eve auth and production-tool contract: 40/40 passed.
- Eve TypeScript check: passed.
- Eve-only runtime guardrail: passed.
- Independent review: approved with no blocking findings.
- Incident fingerprint: published as
  `eve.cross-project-user-token-forwarding`.
- Eve deployment `dpl_EE2e7krD39qfwN9VSSfTRKKB8pYD`: Ready.
- App deployment `dpl_5vxgALX7foWqspo745sQJ7NtB2Ud`: Ready.
- Authenticated lifecycle: start 202, stream 200, the turn.completed runtime
  event, 2,374
  stream bytes, and complete temporary-data cleanup.
- Verification contract: PASS.

## Failure Accounting

- Cause: ambient `Authorization` was not a dependable, explicit identity
  contract across separate Vercel projects.
- Detection gap: local authentication tests did not include the deployed
  cross-project hop.
- Prevention: secret-gated internal user-token header, caller override test,
  and mandatory real lifecycle probe.
- Failure-loudly behavior: user-auth failure is HTTP 401; proxy-origin failure
  is HTTP 403; Supabase or durable-turn service failures remain named 5xx/403
  failures instead of falling back to another assistant.

## Remaining Work

1. Publish exact owned paths.
2. Close this handoff after remote `main` readback.

## Migration Ledger Evidence

N/A. No database migration is part of this repair.
