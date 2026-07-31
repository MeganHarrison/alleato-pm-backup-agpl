# Task: Restrict admin dashboard access to Megan and Brandon

Status: Partial - implementation complete; browser proof deferred
Owner: Codex
Created: 2026-06-29
Linear Issue: Blocked - Linear issue creation tool unavailable in this session
Related Handoff: N/A

## Objective

Make the admin dashboard and admin API controls available only to
`Megan@megankharrison.com` and `bclymer@alleatogroup.com`, regardless of broader
`user_profiles.is_admin` data.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Attention Brief

Primary user: Megan managing Alleato internal admin surfaces.
Primary job: Keep admin/dashboard controls restricted to the two named accounts.
Primary decision: Whether a signed-in account can render admin pages or call
admin APIs.
Tier 1: Server-side route-group guard and shared admin API guard.
Tier 2: Allowlist helper with focused regression coverage.
Hide until requested: No new UI, panels, or dashboards.
Remove: Broad `is_admin`-only access to admin surfaces.
Primary action: Sign in with an allowed account.
Failure-loudly behavior: Non-allowed users redirect from pages or receive a
specific 403 from admin APIs.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Acceptance Criteria

- [x] `(admin)` route-group pages are gated before page children render.
- [x] `/api/admin/*` routes reject non-allowlisted accounts.
- [x] The allowed accounts are matched case-insensitively.
- [x] Wider `user_profiles.is_admin=true` does not grant admin dashboard access.
- [x] Guardrail test proves allowed, mixed-case, and denied email behavior.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/type/lint | `./node_modules/.bin/eslint 'src/lib/auth/admin-dashboard.ts' 'src/lib/auth/admin-dashboard-allowlist.ts' 'src/lib/auth/__tests__/admin-dashboard.test.ts' 'src/lib/supabase/middleware.ts' 'src/lib/supabase/__tests__/middleware.test.ts' 'src/app/(admin)/layout.tsx' 'src/app/(admin)/admin-layout-client.tsx' 'src/app/api/admin/_shared.ts' --quiet` | Pass | Targeted lint on touched files. |
| Static/type/lint | `npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Targeted tests | `./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/auth/__tests__/admin-dashboard.test.ts src/lib/supabase/__tests__/middleware.test.ts` | Pass | 2 suites, 12 tests. Covers allowlist normalization, narrow allowlist, `/api/admin` denial and allowed-owner behavior. |
| Browser/user-flow | Not run | Deferred | Needs authenticated local sessions for both an allowed account and a denied account. |
| DB/provider read-back | N/A | N/A | No database or provider changes. |
| End-to-end proof | Focused middleware unit proof | Partial | Proves direct `/api/admin/*` access rejects non-allowlisted emails and allows `Megan@megankharrison.com`; route-group browser redirect still needs an authenticated browser artifact. |

## Files Changed

- `frontend/src/lib/auth/admin-dashboard.ts` - canonical admin dashboard allowlist and page guard.
- `frontend/src/lib/auth/__tests__/admin-dashboard.test.ts` - allowlist guardrail tests.
- `frontend/src/app/(admin)/layout.tsx` - server-side route-group gate.
- `frontend/src/app/(admin)/admin-layout-client.tsx` - existing admin chrome moved behind the server gate.
- `frontend/src/app/api/admin/_shared.ts` - shared admin API guard uses the same allowlist.
- `frontend/src/lib/supabase/middleware.ts` - global `/api/admin/*` allowlist gate before route handlers.
- `frontend/src/lib/supabase/__tests__/middleware.test.ts` - regression coverage for admin API direct access.
- `docs/ops/tasks/2026-06-29-admin-dashboard-allowlist.md` - working definition of done.

## Risks / Gaps

- Some admin API routes still define local one-off admin checks, but the
  middleware now blocks `/api/admin/*` before route handlers for non-allowlisted
  accounts.
- Browser proof may be blocked by unavailable local sessions for both an allowed
  and denied account.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
