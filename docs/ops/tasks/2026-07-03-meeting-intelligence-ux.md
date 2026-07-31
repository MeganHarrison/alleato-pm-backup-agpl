# Task: Meeting Intelligence UX

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: Blocked - connector exposes comments only, not issue creation
Linear URL: N/A
Related Handoff: N/A

## Objective

Implement the highest-value meeting workflow recommendations: meeting prep suggestions before agenda creation, stronger action-item value, source-backed minutes/transcript affordances, and removal of low-value clutter where the existing contracts support it.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Doctrine Gate

Surface: Meeting creation and agenda workspace
One purpose: help a project user create and run a meeting around the work that actually needs coordination.
Primary user job: accept/remove useful prep suggestions, create the agenda, manage real follow-up work, and review transcript/sources/minutes without mode switching.
Primary action: Create agenda from selected planning context; add/update agenda and action rows in the meeting workspace.
Secondary actions: remove suggestions, inspect quick links, manage attendees, open transcript/sources/minutes, export, create follow-up, delete.
Next action after success: route to the created agenda with accepted prep suggestions seeded as agenda/action rows.
Correction path: remove suggestions before create, edit agenda rows after create, update owner/status/due/priority in action items, delete rows.
Keyboard path: tab through form/suggestions, Enter creates rows in fast-add fields, Escape cancels transient edits.
Information that belongs elsewhere: full project-task management, full transcript review, global RFI/submittal/change-event tables.
Blessed pattern: Form page plus detail page with compact rows and quiet rail.
Complexity budget: Full page, pass if suggestion list remains compact and optional.
Pass/fail: Pass.

## Acceptance Criteria

- [x] Create meeting page includes a compact meeting prep section with removable suggestions for prior actions, RFIs, submittals, change events, schedule, and project context.
- [x] Accepted prep suggestions are seeded into the created meeting agenda without adding a new persistence contract.
- [x] Suggestions are optional and do not block manual meeting creation.
- [x] Low-value static controls are hidden/demoted where they do not support the main workflow.
- [x] Agenda workspace keeps action items separate from agenda discussion rows.
- [x] Minutes and transcript affordances make the source-backed workflow clear without a convert/revert mode.
- [x] Browser verification proves create-to-agenda with accepted suggestions and cleanup.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Map existing meeting-prep, task, and project context contracts before edits.
- [x] Implement prep suggestions within existing create meeting form contract.
- [x] Seed accepted suggestions after meeting creation using existing agenda item mutation/API.
- [x] Improve agenda action/minutes/source affordances without migrations unless required.
- [x] Preserve existing validation, attendee selection, template selection, and redirect behavior.

## Planned Files

- `docs/ops/tasks/2026-07-03-meeting-intelligence-ux.md`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`
- `frontend/src/components/domain/meetings/agenda-section.tsx`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
- Supporting hook/API files only if existing contracts require them.

## Integration Checklist

- [x] Doctrine surface complexity audit passes for touched UI files.
- [x] Focused ESLint passes for touched UI files.
- [x] Browser verification runs on the real route or blocker is recorded.

## Regression Guardrails

- [x] No duplicate primary CTA.
- [x] No nested cards or page-level bordered wrapper shells.
- [x] No new database contract unless applied and verified.
- [x] Suggestion failure does not block basic meeting creation.
- [x] Created test meetings are cleaned up after browser verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task template gate | `ls docs/ops/tasks \| rg 'TASK|template|meeting|agenda'` | Process gap | The AGENTS-referenced `docs/ops/tasks/TASK-TEMPLATE.md` is absent, so this task mirrors current `docs/ops/tasks/*` format. |
| Linear issue gate | `tool_search Linear create issue comment` | Blocked | Available Linear MCP tools expose comments, not issue creation. |
| Supabase type gate | `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts` | Blocked/restored | Command failed with `LegacyInvalidAccessTokenError`; the generated file was restored immediately with `git checkout -- frontend/src/types/database.types.ts`. No new database-backed route was added. |
| Sub-agent: meeting prep mapping | `multi_agent_v1` code mapper `019f2986-6c80-74e0-84d8-478409552c20` | Pass | Confirmed existing AI prep is post-create and depends on persisted meeting/transcript; not reusable directly on create page. |
| Sub-agent: task-link mapping | `multi_agent_v1` code mapper `019f2986-8b30-7e62-bbe9-098a99cd2d09` | Pass | Confirmed agenda-item-linked tasks use `POST /api/projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks` and `tasks.meeting_item_id`. |
| Doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/domain/meetings/create-meeting-form.tsx frontend/src/hooks/use-meeting-planning-suggestions.ts frontend/src/components/domain/meetings/agenda-section.tsx 'frontend/src/app/(main)/[projectId]/meetings/[meetingId]/agenda/page.tsx'` | Pass | All touched UI files passed. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/components/domain/meetings/create-meeting-form.tsx' 'src/hooks/use-meeting-planning-suggestions.ts' 'src/components/domain/meetings/agenda-section.tsx' 'src/app/(main)/[projectId]/meetings/[meetingId]/agenda/page.tsx'` | Pass | No lint errors. |
| Whitespace diff | `git diff --check -- docs/ops/tasks/2026-07-03-meeting-intelligence-ux.md frontend/src/components/domain/meetings/create-meeting-form.tsx frontend/src/hooks/use-meeting-planning-suggestions.ts frontend/src/components/domain/meetings/agenda-section.tsx 'frontend/src/app/(main)/[projectId]/meetings/[meetingId]/agenda/page.tsx'` | Pass | No whitespace errors. |
| Create page suggestions | `agent-browser eval` on `/760/meetings/new` | Pass | Loaded four removable prep suggestions from open project tasks/change events plus project context. |
| Remove/restore suggestions | Browser click/eval on suggestion remove and restore controls | Pass | Remove count dropped from four to three; restore returned removed suggestions. |
| Create-to-agenda seeding | Created `Codex meeting intelligence test` from `/760/meetings/new` | Pass | Redirected to `/760/meetings/4eb9b7db-c065-43d1-a65c-8d1c9488cc5e/agenda` with four seeded agenda rows. |
| Action task linking | Clicked `Create task` for first action item | Pass | Created linked task through meeting item task route; reload showed one `Task linked` and three remaining `Create task` actions. |
| Mobile verification | `agent-browser set viewport 375 780` on seeded agenda | Pass | Four seeded rows, one linked task, no horizontal overflow. |
| Browser screenshots | `/tmp/alleato-meeting-intelligence/desktop-agenda-seeded.png`, `/tmp/alleato-meeting-intelligence/mobile-agenda-seeded.png` | Pass | Captured after seeded agenda/action-task verification. |
| Browser errors | `agent-browser errors` | Pass | No browser errors after verification. |
| Test cleanup | `fetch("/api/projects/760/meetings/4eb9b7db-c065-43d1-a65c-8d1c9488cc5e", { method: "DELETE" })` | Pass | Soft delete returned `200` with `success: true`. |

## Files Changed

- `docs/ops/tasks/2026-07-03-meeting-intelligence-ux.md`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`
- `frontend/src/components/domain/meetings/agenda-section.tsx`
- `frontend/src/hooks/use-meeting-planning-suggestions.ts`
