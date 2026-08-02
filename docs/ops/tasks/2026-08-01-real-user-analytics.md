# Task: Live employee accountability analytics

Status: In Progress
Owner: Codex
Created: 2026-08-01
Task ID: real-user-analytics
Linear Issue: Not requested
Related Handoff: N/A

## Objective

Replace illustrative employee dashboard metrics with live, admin-only account and authenticated-session data.

## Scope

- Extend the existing `/api/admin/analytics` data owner with accountability metrics.
- Render exact account classifications, session activity, and recent activity in the dashboard prototype.
- Exclude uninstrumented workflow-completion and role-adoption claims.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/admin/analytics/route.ts`
- Existing shared primitives/services: `serviceDb`, `withApiGuardrails`, `KpiRow`, `/user-management`
- Deprecated or parallel paths: illustrative dashboard snapshots and fabricated activity events

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Dashboard metrics come from persisted account classifications and app sessions.
- [x] KPI cards retain the canonical `/user-management` destination.
- [x] The UI never presents a fabricated workflow action or role-adoption statistic as live data.
- [x] Data-source failure and a session-query safety limit are visible to the admin.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared route contract owns all dashboard metrics.
- [x] Errors are specific and actionable.
- [x] Database contract is inspected before implementation.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Live-system readback: 49 account-linked people; 38 `employee`, 0 `subcontractor`, 4 admins; 220 recorded sessions as of 2026-08-01.
- [x] Evidence artifacts are recorded.
- [x] Task-owned files were published to `origin/main` at `5312f6b09adc9e1ee513e2f853f77c47d79ddbc2`.

## Failure-Loudly Contract

- Cause surfaced as: Guardrailed API error or explicit activity-incomplete warning when more than 10,000 sessions are returned.
- Detection path: dashboard error state, activity-incomplete message, and focused route unit test.
- Recovery path: Retry a transient API failure; narrow the range or raise the reviewed safety limit before using incomplete activity for a decision.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: The prototype used illustrative snapshots and fabricated workflow events.
- Detection gap: It was labeled illustrative, but could still be mistaken for current operating data.
- Prevention: The dashboard now reads the guarded analytics API and removes uninstrumented claims.
- Guardrail evidence: Focused unit tests plus a live, aggregate-only Supabase readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Database type gate | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Blocked | Supabase returned `LegacyGenTypesUnexpectedStatusError`; current generated types were restored unchanged. |
| Live aggregate readback | Service-role Supabase read | Pass | Counts and session source verified without exposing account identities. |
| Focused unit tests | `pnpm test:unit --runInBand --runTestsByPath src/app/api/admin/analytics/__tests__/recent-logins.test.ts src/app/api/admin/analytics/__tests__/route.test.ts` | Pass | 6 tests passed. |
| Focused lint | `pnpm exec eslint src/app/api/admin/analytics/route.ts src/app/api/admin/analytics/accountability.ts src/app/api/admin/analytics/__tests__/route.test.ts src/components/admin/user-adoption-analytics-prototype.tsx` | Pass | No warnings or errors. |
| Product noise gate | `impeccable noise-gate frontend/src/components/admin/user-adoption-analytics-prototype.tsx` | Blocked | The `impeccable` CLI is not installed in this workspace; manual gate applied during implementation. |

## Remaining Risk

- The legacy `user` and `contact` classifications are not role-equivalent to Employee or Subcontractor. Their ownership is User Management; reclassify records there if they should be included.
- Fresh generated types require a Supabase credential with types-endpoint access.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
