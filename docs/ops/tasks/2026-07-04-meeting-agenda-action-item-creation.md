# Task: Meeting Agenda Action Item Creation

Status: Complete
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-928
Linear URL: https://linear.app/megankharrison/issue/AAI-928/make-agenda-row-action-item-creation-first-class

## Objective

Make the agenda row action-item flow useful after the duplicate action-items cleanup by letting a meeting owner create a real linked task from an agenda item with title, owner, and due date.

## Product Contract

Action items should be real linked tasks, not duplicate agenda rows. Creating one from the agenda should keep the meeting source link through `meeting_item_id`, inherit agenda-row defaults when useful, and allow the user to intentionally leave owner or due date empty.

## Acceptance Criteria

- [x] Expanded agenda rows can create a linked task with title, owner, and due date.
- [x] Empty owner and due date can intentionally override inherited agenda item values.
- [x] The Action items section remains quiet until linked tasks exist.
- [x] Focused tests cover the create-task payload and nullable owner/due-date schema.
- [x] Focused lint/type/route guardrails pass.
- [x] Commit is pushed to `origin/main`.
- [x] Vercel production deploy is Ready and assigned to `projects.alleatogroup.com`.
- [x] Live production browser/API verification proves a linked action item appears in the Action items section.

## Implementation Checklist

- [x] Use current `origin/main` as the base.
- [x] Preserve the existing meeting item task API and source-stub behavior.
- [x] Avoid database migrations.
- [x] Keep the agenda row dense; no card or secondary panel.
- [x] Delete production verification meetings/tasks after testing.
- [x] Post kickoff, evidence, and closeout to Linear.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Kickoff | Linear `AAI-928` | Pass | Issue created under Meetings project. |
| Focused unit tests | `npm run test:unit -- --runInBand --runTestsByPath src/components/domain/meetings/__tests__/agenda-section.test.tsx 'src/app/api/projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks/__tests__/route.test.ts' src/lib/meetings/__tests__/schemas.test.ts` | Pass | 3 suites, 46 tests. |
| Immediate section refresh regression | `npm run test:unit -- --runInBand --runTestsByPath src/hooks/__tests__/use-meetings.test.tsx src/components/domain/meetings/__tests__/agenda-section.test.tsx 'src/app/api/projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks/__tests__/route.test.ts' src/lib/meetings/__tests__/schemas.test.ts` | Pass | 4 suites, 49 tests; covers cache `task_count` increment after linked task creation. |
| Whitespace check | `git diff --check` | Pass | No whitespace errors. |
| Changed-file typecheck | `npm run typecheck:changed` | Pass | Verification sub-agent: no new any type debt. |
| Changed-file lint debt | `npm run lint:changed:debt` | Pass | Verification sub-agent: no new ESLint debt across 6 changed frontend files. |
| Route guardrails | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | Pass | Verification sub-agent: 1 changed route, 0 raw error routes. |
| Route conflicts | `npm run check:routes` | Pass | Verification sub-agent: no route conflicts. |
| Publish | `git push origin HEAD:main` | Pass | Code commit `ac43ed64613f12fd8a6cacb8b4761f5aaa67bbbe` pushed; `HEAD` matched `origin/main`. |
| Vercel production deploy | `vercel inspect https://alleato-e0ftsse67-meganharrisons-projects.vercel.app --scope team_lZighRY9Xpkb6qZBqDApczKZ` | Pass | Deployment `dpl_rGQJFJK8ZQpdXKWRNwekGdiyTpy6` Ready and aliased to `projects.alleatogroup.com`. |
| Production quiet state | `agent-browser` eval on `/760/meetings/8050c371-8f22-42b9-af5c-8b0f98ae18cd/agenda` before task creation | Pass | `hasActionItemsSection: false`. |
| Production linked task API | `GET /api/projects/760/meetings/8050c371-8f22-42b9-af5c-8b0f98ae18cd` and item tasks API | Pass | Detail reported `task_count: 1`; task row had title `Codex linked task proof`, due date `2026-07-08`, owner id, and matching `meeting_item_id`. |
| Production linked task UI | `agent-browser` fresh navigation and DOM eval | Pass | `data-testid=meeting-action-items-section` rendered with agenda item `1.1 Confirm stamped drawings and calculations are ready for landlord`. Screenshot: `/tmp/meeting-action-item-prod-proof-after-nav.png`. |
| Production cleanup | `DELETE /api/projects/760/meetings/8050c371-8f22-42b9-af5c-8b0f98ae18cd` | Pass | Verification meeting deleted with HTTP 200. |
| Linear closeout | Linear comment `0ce7b5af-ac4c-4f61-ba25-bd51c00024c3` | Pass | Closeout evidence posted to `AAI-928`. |
