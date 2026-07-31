# Task: Restricted executive views over the shared operating model

Status: In Progress
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1108
Linear Issue: [Add restricted executive views without forking the operating model](https://linear.app/megankharrison/issue/AAI-1108/add-restricted-executive-views-without-forking-the-operating-model)
Related Handoff: `docs/ops/handoffs/2026-07-16-S178-restricted-executive-views.md`

## Objective

Add one shared executive visibility policy over the canonical operating artifact. The policy must restrict sensitive claims, source evidence, actions, lineage, health detail, and artifacts without creating a second projection, report, writer, or route family.

## Canonical owners

- Admission and role capability: `frontend/src/lib/permissions-shared.ts` and `frontend/src/lib/app-capabilities.ts`.
- Governed executive state/artifact: `frontend/src/lib/executive/governed-executive-artifact.ts`.
- Shared restricted-view adapter: `frontend/src/lib/executive/**` (new policy owner only).
- Consumer routes: existing `/daily-brief`, `/weekly-operating-review`, `/daily-briefs/[briefId]`, and existing `/api/executive/**` routes.

## Acceptance criteria

- [ ] Briefing-only and restricted-detail roles receive exactly their permitted executive representation from the same governed artifact.
- [ ] Attention, conflicts, lineage, health, portfolio state, and recurring-artifact routes use the same policy; no endpoint exposes prohibited source details or URLs.
- [ ] Detail/action permission failures return explicit `403 FORBIDDEN` guardrails before any protected reader runs.
- [ ] Canonical executive page renders the restricted representation without a duplicate report route.
- [ ] Focused policy and route tests, authenticated browser screenshot proof, independent review, verification contract, and Linear evidence pass.

## Implementation checklist

- [x] Claim S178 and record Linear kickoff.
- [x] Define the single capability/tier contract and shared policy adapter.
- [x] Apply the policy at every AAI-1108-owned executive reader/API boundary.
- [x] Add regression tests for full-detail, restricted, and denial behavior.
- [x] Capture canonical-route browser evidence and attach it to Linear.
- [x] Obtain independent review and complete task/Linear/handoff closeout.

## Failure-loudly contract

- Cause surfaced as: a request lacks the required executive detail capability, or a reader attempts to return restricted material without a known scope.
- Detection path: capability guard executes before the reader; policy tests assert no source excerpts, URLs, claim statements, or action identifiers are present in restricted payloads.
- Recovery path: grant the company-level capability or use the full-detail role; never create a second executive projection to work around access control.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Claim | S178 session-board row and Linear kickoff | Pass | Recorded before product code. |
| Capability migration | `npm run db:migrations:verify-applied -- supabase/migrations/20260716210609_add_executive_detail_capability.sql` | Pass | Remote ledger version `20260716210609`; API-applied. |
| Policy and routes | Focused Jest: 6 suites / 12 tests | Pass | Summary/detail/denial plus attention, conflict, and portfolio guards. |
| Route guard | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Summary-role browser / API | `summary-role-daily-brief.png`, `summary-role-weekly-review.png`, Linear attachment `b0184d2c-3d3a-4c1f-a916-9bb0c5c431d8` | Pass | Temporary non-admin role with only `view_executive_briefing` rendered redacted canonical views; artifact API returned loud `403`. Temporary principal and session were fully removed after proof. |

## Remaining risk

- AAI-1107 owns the separate monthly-review page/route. It now consumes the shared detail policy and passed cross-surface review, but its final independent implementation review found a separate non-atomic issuance-audit defect that must be repaired before that task publishes.

## Final status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Published to `origin/main` at `948be725a`.
