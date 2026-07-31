# Task: Repair the Deployed App-to-Eve Authentication Boundary

Status: In Progress
Owner: S20260729-RAGEVEAUTH
Created: 2026-07-29
Task ID: AAI-1280
Linear Issue: [AAI-1280](https://linear.app/megankharrison/issue/AAI-1280/complete-and-production-verify-the-eve-rag-pipeline)
Related Handoff: `docs/ops/handoffs/2026-07-29-S20260729-RAGEVEAUTH-eve-proxy-auth-boundary.md`

## Objective

An authenticated user can start and stream a deployed Eve conversation through
the backup application's canonical proxy without exposing a browser bearer
token as ambient cross-project authorization.

## Scope

- Next.js Eve proxy request headers for POST and GET stream requests.
- Eve authentication of the proxy-bound user access token.
- Focused unit, type, deployment, and authenticated lifecycle evidence.
- No changes to Eve tool permissions, RAG ingestion ownership, or write access.

## Source of Truth

- Canonical runtime/data owner: `agents/alleato-assistant`
- Existing shared primitives/services:
  `frontend/src/app/api/ai-assistant/eve/proxy/[...path]/eve-proxy.ts` and
  `agents/alleato-assistant/agent/lib/auth.ts`
- Deprecated or parallel paths: browser `Authorization` forwarded unchanged to
  the separate Eve Vercel project

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] App validation remains the first user-authentication boundary.
- [x] Browser `Authorization` is not forwarded to Eve.
- [x] The app injects one internal user-token header after authentication.
- [x] Caller-supplied internal user-token headers cannot override app state.
- [x] Eve validates the shared proxy secret before trusting the internal token.
- [x] Missing, malformed, or unauthorized identity fails loudly.
- [x] Both Vercel projects deploy the reviewed repair.
- [x] A temporary real Supabase user completes start and stream through the
  deployed backup application.
- [x] Temporary verification data is removed and cleanup is recorded.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared proxy/auth modules own cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Authentication and permission contracts are fail-closed.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Actual live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated setup failure names the exact command and owner.
- [x] Independent security and correctness review approves the repair.
- [ ] Task-owned files are published and remote `main` contains the repair.

## Failure-Loudly Contract

- Cause surfaced as: structured HTTP 401 for missing/invalid user identity and
  HTTP 403 for an invalid trusted-proxy secret.
- Detection path: focused proxy/auth tests plus deployed authenticated lifecycle
  probe and Vercel runtime logs.
- Recovery path: verify the app-injected internal header, shared proxy secret,
  Supabase binding, durable turn ownership, and RLS response in that order.

## Incident Learning

- Failure fingerprint: `eve.cross-project-user-token-forwarding`
- Root cause: the app relied on ambient `Authorization` surviving a
  cross-project Vercel fetch even though user identity had already been
  authenticated at the app boundary.
- Detection gap: unit tests proved direct bearer authentication but did not
  exercise the separate deployed app and Eve projects.
- Prevention: use a proxy-only internal header that cannot be caller-overridden,
  validate the shared secret before the token, and require a real deployed
  lifecycle probe.
- Guardrail evidence: focused proxy and Eve authentication tests listed below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Previous deployed failure | Temporary authenticated lifecycle probe | Failed as expected | App accepted the user and durable turn; Eve returned HTTP 401. |
| Proxy contract | `npm --prefix frontend run test:unit -- --runInBand --runTestsByPath "src/app/api/ai-assistant/eve/proxy/[...path]/__tests__/eve-proxy.test.ts"` | Pass, 16/16 | Proves stripping, internal binding, override rejection, streaming, durability, malformed-NDJSON detection, and failures. |
| Eve auth/tool contract | `pnpm --dir agents/alleato-assistant test:auth` | Pass, 40/40 | Proves secret-first auth, internal-token precedence, RLS, surface, turn, and tool boundaries. |
| Eve typecheck | `pnpm --dir agents/alleato-assistant typecheck` | Pass | TypeScript compilation succeeds. |
| Sole runtime | `npm run verify:eve-only-runtime` | Pass | No legacy generator or fallback runtime remains. |
| Independent review | `rag_client_boundary_review` | Approved | No blocking correctness or security findings. |
| Learning registry | `eve.cross-project-user-token-forwarding` | Published | Lookup returns the new failure fingerprint first. |
| Eve deployment | `dpl_EE2e7krD39qfwN9VSSfTRKKB8pYD` | Ready | Production alias updated. |
| App deployment | `dpl_5vxgALX7foWqspo745sQJ7NtB2Ud` | Ready | Canonical production build and output-boundary check passed. |
| Authenticated lifecycle | `docs/ops/tasks/2026-07-29-eve-proxy-auth-boundary.verification-proof.md` | Pass | Start 202, stream 200, terminal event present, cleanup complete. |
| Verification contract | Manifest and result beside this task | Pass | `npm run verify:contract -- --require-pass` succeeded. |
| Workspace install | `pnpm --dir frontend install --offline --frozen-lockfile` | Setup-only failure | Dependencies installed; the Unix-only frontend postinstall command fails on Windows. Product tests run successfully afterward. |

## Remaining Risk

- Publication of the reviewed source is the only remaining step for this slice.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is published.
- [ ] Deferred work, if any, has a named owner and next action.
