# Task: Restore Production Route Headroom

Status: Implemented Locally, Publication Deferred
Owner: Codex
Created: 2026-07-31
Task ID: production-route-headroom-2026-07-31
Linear Issue: N/A, local route-graph maintenance
Related Handoff: N/A, single-session Standard work

## Objective

Move the Vercel generated-route estimate safely away from the 2,048 limit and
replace the false-positive orphan audit with explicit repository and external
ownership evidence.

## Scope

- Next.js API route graph, route budget, generated application map, and orphan audit.
- No production deployment, provider configuration, database mutation, or access change.

## Source of Truth

- Route graph: `frontend/src/app/api/**/route.ts`
- Production budget: `frontend/scripts/build/nonprod-routes.json`
- External ownership: `scripts/audits/external-api-routes.json`
- Audit: `scripts/audits/audit-orphaned-api-routes.mjs`

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Generated-route estimate has at least 50 routes of headroom.
- [x] Every no-browser-caller route has repository or explicit external ownership evidence.
- [x] Cron, webhook, provider, embedded, and operational routes are protected from blind deletion.
- [x] Removed routes have no runtime caller, test, automation, deployment entry, or OpenAPI contract.
- [x] Route and generated application inventories are synchronized.

## Implementation Checklist

- [x] Removed 37 unowned API route handlers and one route-only test.
- [x] Removed unauthenticated service-key password diagnostics and GET email resend operations.
- [x] Removed unused generic table mutation and Supabase Management API proxy routes.
- [x] Removed blocked/development-only previews and the retired pre-Velt comments API.
- [x] Removed unowned dynamic project mutation endpoints without callers or contracts.
- [x] Preserved externally linkable avatar and executive artifact routes.

## Integration and Verification

- [x] `npm run verify:nonprod-routes` passes at 630 dynamic files and 1,970 estimated generated routes.
- [x] `npm run check:routes` reports no conflicts.
- [x] `npm run audit:orphan-routes` scans 719 routes and reports zero unexplained orphans.
- [x] Project map and generated app-surface inventory were regenerated.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: exceeded locked dynamic/generated route budget or invalid external ownership manifest.
- Detection path: `npm run verify:nonprod-routes` and `npm run audit:orphan-routes`.
- Recovery path: consolidate/remove an owned route or add a complete external owner and reason; never increase the budget silently.

## Incident Learning

- Failure fingerprint: `deployment.vercel-generated-route-limit`
- Root cause: internal, retired, generic, and unwired route handlers accumulated beside externally invoked endpoints while the audit searched only frontend runtime source.
- Detection gap: tests, scripts, deployment configuration, OpenAPI contracts, and external ownership were not included in classification.
- Prevention: lock the reduced budget and require exact external owner entries with path, owner, reason, and live route-file validation.
- Guardrail evidence: the route budget and orphan audit both pass after regeneration.

## Evidence

| Check | Before | After |
| --- | ---: | ---: |
| API route handlers scanned | 756 | 719 |
| Dynamic production route files | 654 | 630 |
| Estimated generated routes | 2,042 | 1,970 |
| Estimated Vercel headroom | 6 | 78 |
| Unexplained orphan candidates | 93 | 0 |
| Repository-witness borderline routes | 48 | 33 |
| Explicit externally owned routes | 0 | 26 |

## Remaining Risk

- The 1,970 value is the repository's estimator, not a completed Vercel production deployment readback.
- External ownership entries are protected operational contracts; owners should remove an entry and route together when an integration is retired.
- The shared checkout contains unrelated active work, so publication remains deferred to the owning integration session.

## Final Status

- [x] Implementation and targeted verification are complete locally.
- [x] Deferred production proof and publication are explicit.
- [ ] Publication is complete.
