# Task: Trade schedule visibility and alerts

Status: In Progress
Owner: SROOT1193B
Created: 2026-07-22
Task ID: AAI-1193
Linear Issue: [AAI-1193](https://linear.app/megankharrison/issue/AAI-1193/provide-tradevendor-schedule-visibility-and-change-alerts)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT1193A-trade-visibility-alerts.md`

## Objective

An authorized trade/vendor user can read only their relevant published schedule activities and receives one traceable, actionable alert for a published schedule/submittal/dependency change.

## Scope

- Reuse `collaboration_notifications` for durable in-app alerts and existing project membership/assignment data for visibility.
- Add schedule-specific idempotency and causal metadata; expose a guarded trade schedule read path.
- Excludes an independent notification subsystem, generic project-wide schedule access, and alerting for drafts.

## Source of Truth

- Canonical notification owner: `collaboration_notifications` and `use-collaboration-notifications.ts`.
- Canonical schedule state: published `schedule_revisions` snapshots and schedule revision events.
- Existing shared primitives/services: `frontend/src/lib/collaboration/notification-links.ts`, `frontend/src/hooks/use-collaboration-notifications.ts`, schedule revision APIs.
- Deprecated or parallel paths: direct live `schedule_tasks` visibility and ad-hoc toast/email alerts.

Verification contract: Required

## Acceptance Criteria

- [ ] Out-of-scope users cannot read activities.
- [ ] Draft changes cannot emit alerts; a replay creates no duplicate.
- [ ] Published date, dependency, and linked-submittal changes emit actionable alerts with causal source metadata.
- [ ] API, database readback, browser proof, screenshot, and independent review are recorded before closeout.

## Implementation Checklist

- [x] Task, owner, canonical route/data contract, and shared notification owner identified before behavior edits.
- [x] Add red tests for out-of-scope read, unpublished alert, and duplicate replay.
- [x] Add durable schedule-alert idempotency/causality contract.
- [x] Add guarded trade visibility API and alert emission path.
- [x] Add canonical user-facing alert/read experience.
- [ ] Add E2E coverage and live published-assignment proof.

## Integration and Verification

- [x] Targeted tests pass.
- [ ] Live database readback and canonical user-flow prove behavior.
- [ ] Screenshot and Linear evidence are attached.
- [x] Task-owned files are published and `HEAD == origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: explicit access denial, no-published-revision result, or idempotency conflict; never a blank broad schedule or duplicated alert.
- Detection path: negative unit/API tests, unique event key, collaboration notification readback, canonical route alert.
- Recovery path: assign the relevant activity/user, publish the revision, then retry once with the source event key.

## Incident Learning

- Failure fingerprint: A globally valid person can be assigned to a project schedule task but cannot read its published snapshot without an active project membership.
- Root cause: `schedule_tasks.assignee_person_id` referenced any global person, while published trade reads require an active membership in the same project.
- Detection gap: API tests proved read-time filtering but did not prove invalid assignments could never be written and later disappear from the recipient's view.
- Prevention: a database trigger rejects non-member assignees before insert/update; the migration test and transactional production probe prove both acceptance and rejection paths.
- Guardrail evidence: AAI-1193 red/green test matrix plus migration `20260722132000` remote-ledger and transaction evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Full-process TDD and verification gate recorded before code. |
| Removed-relation alert guard | Supabase migration ledger `20260722071604_alert_removed_schedule_relations` | Pass | Published alert function now detects removed predecessor and linked-submittal relationships while retaining the unique event key delivery guard. |
| API contract suite | `npx jest --runTestsByPath src/lib/scheduling/__tests__/schedule-alerts.test.ts src/app/api/projects/[projectId]/scheduling/trade-alerts/__tests__/route.test.ts src/app/api/projects/[projectId]/scheduling/trade-activities/__tests__/route.test.ts --runInBand --silent` | Pass (7/7) | Covers unpublished suppression, replay idempotency, authenticated alert emission, no published mutable fallback, and recipient-scoped published activity reads. |
| Canonical read surface | `frontend/src/components/scheduling/trade-schedule-activities.tsx` rendered by `frontend/src/app/(main)/[projectId]/schedule/page.tsx` | Pass | The canonical Schedule route displays only the signed-in member's published assignments, links each assignment back to its source activity, and makes unavailable data explicit. |
| Trade read + alert regression suite | `npx jest --runTestsByPath src/components/scheduling/__tests__/trade-schedule-activities.test.tsx src/lib/collaboration/__tests__/notification-links.test.ts src/lib/scheduling/__tests__/schedule-alerts.test.ts src/app/api/projects/[projectId]/scheduling/trade-alerts/__tests__/route.test.ts src/app/api/projects/[projectId]/scheduling/trade-activities/__tests__/route.test.ts --runInBand --silent` | Pass (20/20) | Covers the published-only recipient boundary, action link, unavailable state, notification deep link, and alert delivery contract. |
| Route contract | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Browser-auth preflight | `npm run verify:browser-auth -- --base-url https://projects.alleatogroup.com --route /43/schedule --session company-table-prod` | Pass | Reuses a valid authenticated production browser session before any credential refresh; rejects login redirects and cross-origin state. |
| Assignment write guard | `node --test scripts/verification/__tests__/schedule-assignee-membership-migration.test.mjs` | Pass (1/1) | Red/green guardrail requires the project, person, and active membership predicates plus the explicit rejection code. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260722132000_require_active_schedule_assignee_membership.sql` | Pass | Remote ledger includes `20260722132000`; bulk migration push was intentionally avoided because the remote history has unrelated pending entries. |
| Production database probe | Transactional `psql` probe | Pass | An active project member assignment was accepted and an outsider was rejected with `SCHEDULE_ASSIGNEE_NOT_ACTIVE_PROJECT_MEMBER`; the enclosing transaction was rolled back. |

## Remaining Risk

- Schedule activities remain person-scoped rather than company-scoped. Company-level distribution needs an explicit assignment-target model; it must not be inferred from a vendor's primary contact.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A with a prevention guardrail.
- [ ] Deferred work records cause, detection gap, prevention, owner, and next action.
