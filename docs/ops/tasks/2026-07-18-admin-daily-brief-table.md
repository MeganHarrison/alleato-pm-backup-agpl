# Task: Admin Daily Brief Table

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-18
Task ID: Local task — Linear issue creation connector unavailable in this session
Linear Issue: unavailable — no Linear issue-creation connector was callable
Related Handoff: `docs/ops/handoffs/2026-07-18-S-admin-daily-brief-table.md`

## Objective

Provide a distinct admin Daily Brief table that exposes each canonical packet's technical fanout and RAG review state and opens the existing admin fanout detail, while preserving the executive table as written-brief history only.

## Scope

- Add `/admin/daily-briefs` using the shared `UnifiedTablePage` table pattern.
- Reuse `intelligence_packets`, the existing Daily Brief history loader, and the existing `/admin/daily-briefs/[briefId]` fanout review.
- Excludes packet generation, RAG mutation, source edits, and executive-page content.

## Source of Truth

- Canonical runtime/data owner: `intelligence_packets` via `canonical-packets.ts` and fanout readback.
- Existing shared primitives/services: `UnifiedTablePage`, `useUnifiedTableState`, `DailyBriefFanoutReview`, `loadDailyBriefFanoutReadback`.
- Deprecated or parallel paths: N/A. The executive history table remains `/daily-briefs`.

Verification contract: Required

## Acceptance Criteria

- [x] `/daily-briefs` remains an executive-only history table and opens executive assessment detail.
- [x] `/admin/daily-briefs` is an admin-only table with technical packet, source/RAG, and fanout indicators.
- [x] Admin rows open `/admin/daily-briefs/[briefId]`; executive rows never open that route.
- [x] The admin table fails loudly with an actionable error state if technical readback cannot load.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared table abstraction owns table behavior.
- [x] Errors are specific and actionable.
- [x] Admin access is enforced at the admin route boundary.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Authenticated browser proof captures both list routes and their distinct destinations. Blocked: no `ADMIN_E2E_EMAIL` / `ADMIN_E2E_PASSWORD` for a pre-existing allowlisted account exists in local or Vercel secure configuration; the available normal test user correctly redirects to access denied.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: `Daily Brief admin readback failed` with the returned dependency message.
- Detection path: server route error state and focused loader test.
- Recovery path: inspect the named packet/source/fanout dependency, then reopen the packet's existing admin review route.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The application had an executive list table and an admin detail route but no admin list-table owner.
- Detection gap: Detail-route proof was incorrectly treated as proof of a two-table split.
- Prevention: Route-level browser verification must include both expected list routes and their distinct row destinations.
- Guardrail evidence: This task's dual-route browser contract.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Unit | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/daily-briefs/__tests__/admin-history.test.ts` | PASS | 2 tests: packet revisions/RAG states and failure-loud behavior. |
| Static | Targeted ESLint for changed source/test files | PASS | No lint errors. |
| Routes | `npm run check:routes && git diff --check` | PASS | No dynamic route conflicts or whitespace errors. |
| Browser authorization | `agent-browser --state ... open http://localhost:3109/admin/daily-briefs` | BLOCKED | Redirected to `/access-denied?reason=admin-dashboard-allowlist`; no screenshot retained because it would prove the wrong surface. Owner: admin E2E credential/state. |
| Executive browser route | `agent-browser open http://localhost:3109/daily-briefs` | PASS | Authenticated executive history loaded. Screenshot: `docs/ops/evidence/2026-07-18-admin-daily-brief-table/executive-table-local.png`. |
| Executive production flow | `AUTH_BASE_URL=https://projects.alleatogroup.com node scripts/verify/agent-browser-auth.mjs --role user`, then agent-browser | PASS | `/daily-briefs` loaded as the normal test user and its `2026-07-16` row opened `/daily-briefs/b9c98810-168e-439d-aec4-d252aa6a0111`. The rendered detail contained only Executive Assessment content. Screenshots: `docs/ops/evidence/2026-07-18-admin-daily-brief-table/executive-table-production-final.png`, `docs/ops/evidence/2026-07-18-admin-daily-brief-table/executive-detail-production-final.png`. |
| Executive visual review | Production executive detail screenshot | PASS | Quiet written-brief hierarchy, no technical fanout/RAG elements, no visual overflow or unnecessary containers. |

## Remaining Risk

- An authenticated, allowlisted admin browser state is required to capture the canonical admin list and row destination. Cause: test user intentionally fails the fixed admin allowlist. Detection gap: prior browser bootstrap only guarantees user authentication, not admin authorization. Prevention: `scripts/verify/agent-browser-auth.mjs --role admin` now requires a separate existing `ADMIN_E2E_EMAIL` and `ADMIN_E2E_PASSWORD`, persists only `tests/.auth/admin.json`, and refuses to create or reset that account. Owner: admin E2E credential/state. Next action: configure those two secure variables, then run the enabled Playwright/agent-browser proof and attach desktop/mobile screenshots.

## Final Status

- [ ] All required checklist items are complete. Blocked on authenticated admin browser proof.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
