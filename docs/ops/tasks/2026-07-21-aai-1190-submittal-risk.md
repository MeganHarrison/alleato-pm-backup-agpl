# Task: Link Submittals to Schedule Activities and Surface Risk

Status: In Progress
Owner: Codex SROOT1190A
Created: 2026-07-21
Task ID: AAI-1190
Linear Issue: [AAI-1190](https://linear.app/megankharrison/issue/AAI-1190/link-submittals-to-activities-and-surface-schedule-risk)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT1190A-submittal-risk.md`
Architecture documentation: [`docs/architecture/SCHEDULE-SUBMITTAL-RISK.md`](../../architecture/SCHEDULE-SUBMITTAL-RISK.md)

## Objective

On the canonical schedule task editor, a project member can link or unlink project submittals and see a specific, source-linked risk when approval status or required approval date threatens the task or its dependent work.

## Scope

- Immutable project-scoped task↔submittal relationships, authorization-safe APIs, and deterministic risk calculation.
- Schedule task editor rendering and browser acceptance are a follow-on owned UI slice after the data contract is complete.
- Excludes automated notifications, vendor visibility, baseline comparison, and AI risk summaries.

## Source of Truth

- Canonical runtime/data owner: `schedule_tasks`, `submittals`, `submittal_responses`, and task dependency records.
- Existing shared primitives/services: `frontend/src/components/scheduling/task-edit-modal.tsx`, `frontend/src/hooks/use-submittals.ts`, `frontend/src/lib/scheduling/schedule-network-analysis.ts`.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [x] Users can link and remove only same-project submittals from an activity.
- [x] Risk evaluation compares required approval dates and rejected/pending status with the task and dependency context.
- [x] At-risk work names the blocking submittal, reason, approval date, and source route.
- [x] Cross-project, unauthorized, stale, pending, and rejected paths fail loudly and cannot report a false-safe activity.
- [x] End-to-end canonical-route proof and database readback are recorded.
- [ ] Independent review is accepted before closeout.

## Implementation Checklist

- [x] Files/modules are enumerated in the isolated ownership boundary before edits.
- [x] Red/green tests cover link, unlink, cross-project authorization, and each risk state. The evaluator and link-post slices cover rejected, late pending, timely approved, unauthenticated, and cross-project paths; unlink has specific authentication/RPC coverage.
- [x] Migration creates project-safe links and read contract.
- [x] API validates link input and forwards same-project writes only through the guarded RPC with specific authentication/authorization errors.
- [x] Shared risk evaluator owns status/date/dependency semantics.
- [x] Editor reuses its existing field-update section pattern to render links and risks, refreshes after an unlink, and makes link failures visible.

## Integration and Verification

- [x] Targeted unit and route tests pass.
- [x] Migration ledger and live database readback pass.
- [x] Canonical browser flow passes on desktop and mobile; screenshots are attached to AAI-1190.
- [x] Task-owned implementation files are published; this evidence update will be published before review handoff.

## Failure-Loudly Contract

- Cause surfaced as: a specific 400/403/404 response for invalid, cross-project, or unauthorized links; visible risk reason for a linked blocking submittal.
- Detection path: focused unit/route tests, canonical browser flow, and database readback.
- Recovery path: select a same-project submittal, update its approval workflow/date, or remove the invalid link.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: TDD contract for link authorization and false-safe risk outcomes.
- Guardrail evidence: focused red then green tests recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and TDD gate captured before implementation. |
| Architecture documentation | [`SCHEDULE-SUBMITTAL-RISK.md`](../../architecture/SCHEDULE-SUBMITTAL-RISK.md) | Pass | Canonical routes, API/RPC ownership, risk semantics, recovery, and test links are recorded. |
| Risk evaluator TDD | `jest --runInBand --runTestsByPath src/lib/scheduling/__tests__/submittal-risk.test.ts` | Pass (3/3) | Red failed because the evaluator was absent; green evaluates rejected and late pending work as at risk. |
| Link API TDD | `jest --runInBand --runTestsByPath .../submittals/__tests__/route.test.ts` | Pass (3/3) | Red failed because the route was absent; green guards unauthenticated and cross-project links. |
| Full focused contract suite | `jest --runInBand --runTestsByPath submittal-risk + link route + unlink route + modal` | Pass (10/10) | Validates rejected, late pending, timely approved, unauthenticated, cross-project, unlink RPC, visible risk, and visible link failure. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260722000000_schedule_task_submittal_links.sql` | Pass | Live readback confirms table plus link/unlink RPCs. |
| Browser-auth preflight | `npm run verify:browser -- --url 'https://projects.alleatogroup.com/43/schedule' --name aai1190-auth-preflight` | Pass | Repository-owned preflight refreshed the Clerk state and recorded screenshots/video in `frontend/tests/agent-browser-runs/2026-07-22T00-35-10-500Z-aai1190-auth-preflight/`. |
| Canonical desktop flow | AAI-1190 attachment: `AAI-1190 desktop linked-submittal flow` | Pass | On deployed `/43/schedule`, linked a real same-project submittal to `Install Sanitary Sewer`, observed `Unlink`, then removed it and confirmed it returned to the picker. |
| Canonical mobile flow | AAI-1190 attachment: `AAI-1190 mobile linked-submittal flow` | Pass | Repeated the link state at 390×844 and then unlinked it, leaving the production fixture clean. |
| Production deployment | `https://project-management-agent-8zch7evaw-the-alleato-group.vercel.app` (`65657cf22`) | Pass | Ready; build verified 542,822,885 bytes and no nested Next.js output directories. |

## Remaining Risk

- Independent code review and formal handoff acceptance remain required before closure.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
