# Task: Real Meeting Agenda Page

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: Blocked - connector exposes comments only, not issue creation
Linear URL: N/A
Related Handoff: N/A

## Objective

Develop the real post-create meeting agenda workspace so the create meeting flow lands on a fast, dense, calm live meeting page that follows the design system and yesterday's agenda-page feedback.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Doctrine Gate

Surface: Meeting agenda workspace
One purpose: run and prepare a project meeting from the agenda.
Primary user job: review and edit agenda items quickly, then manage action items as a separate primary section.
Primary action: add/edit agenda rows and action items in place.
Secondary actions: view transcript, sources, minutes, attendees, decisions, parking lot, quick links, export, follow-up, delete.
Next action after success: stay on the agenda and continue entering the next row.
Correction path: inline edits, delete row/category, attendance toggles, action item edits, and route-level retry on load failure.
Keyboard path: tab through agenda rows and quick-add fields; Enter adds a row from quick-add.
Information that belongs elsewhere: full source review, full transcript reading, and historical minutes review beyond on-demand disclosure.
Blessed pattern: Detail page plus compact section rows and quiet right rail.
Complexity budget: Full page, pass if tabs separate modes and agenda/action items remain visually distinct.
Pass/fail: Pass.

## Acceptance Criteria

- [x] `/[projectId]/meetings/[meetingId]/agenda` is the real post-create workspace and not a separate-feeling mock tool.
- [x] Header has an eyebrow status above the meeting title, no redundant status pill competing with actions, and no unnecessary lower border.
- [x] Tabs include Agenda, Transcript, Sources, and Minutes; minutes is a tab, not a convert/revert mode switch.
- [x] Agenda rows are condensed and focused on agenda content; task/action-item controls are not embedded inside agenda item rows.
- [x] Sections are collapsible and support fast add rows with concise `Add item` copy.
- [x] Action items appear as a separate main section below agenda with explanatory subheading.
- [x] The right rail stays quiet and includes attendees, decisions, parking lot, sources, and quick links.
- [x] Browser verification runs on the real route or blocker is recorded.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Refactor agenda route tabs/actions without changing API contracts.
- [x] Simplify agenda item row density and remove embedded task section from agenda rows.
- [x] Add separate action item section using existing meeting-item mutation contract where possible.
- [x] Add quiet quick links to the meeting rail.
- [x] Preserve existing attendee, category, item, transcript, export, follow-up, delete, and attachment behaviors where still in scope.

## Planned Files

- `docs/ops/tasks/2026-07-03-real-meeting-agenda-page.md`
- `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/agenda/page.tsx`
- `frontend/src/components/domain/meetings/agenda-section.tsx`
- `frontend/src/components/domain/meetings/agenda-item-row.tsx`

## Integration Checklist

- [x] Doctrine surface complexity audit passes for touched UI files.
- [x] Focused ESLint passes for touched UI files.
- [x] Browser verification runs on the real route with an actual created meeting or existing authorized meeting.

## Regression Guardrails

- [x] No duplicate primary CTA.
- [x] No nested cards or page-level bordered wrapper shells.
- [x] No page-local reinvention of shared dropdown/action primitives.
- [x] No agenda task controls reintroduced inside individual agenda rows.
- [x] Route-scoped API calls retain both `projectId` and `meetingId`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task template gate | `ls docs/ops/tasks \| rg 'TASK|template|meeting|agenda'` | Process gap | The AGENTS-referenced `docs/ops/tasks/TASK-TEMPLATE.md` is absent, so this task mirrors current `docs/ops/tasks/*` format. |
| Linear issue gate | `tool_search Linear create issue comment` | Blocked | Available Linear MCP tools expose comments, not issue creation. |
| Doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs 'frontend/src/app/(main)/[projectId]/meetings/[meetingId]/agenda/page.tsx' frontend/src/components/domain/meetings/agenda-section.tsx frontend/src/components/domain/meetings/agenda-item-row.tsx` | Pass | All touched UI files passed. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/meetings/[meetingId]/agenda/page.tsx' 'src/components/domain/meetings/agenda-section.tsx' 'src/components/domain/meetings/agenda-item-row.tsx'` | Pass | Fixed raw heading, raw button, and raw date input findings before final pass. |
| Whitespace diff | `git diff --check -- docs/ops/tasks/2026-07-03-real-meeting-agenda-page.md 'frontend/src/app/(main)/[projectId]/meetings/[meetingId]/agenda/page.tsx' frontend/src/components/domain/meetings/agenda-section.tsx frontend/src/components/domain/meetings/agenda-item-row.tsx` | Pass | No whitespace errors. |
| Create-to-agenda browser flow | Created `Codex agenda page UI test` from `/760/meetings/new` | Pass | Redirected to `/760/meetings/fc6290b0-9443-41ce-866e-be5d9d148e3a/agenda`. |
| Agenda route DOM verification | `agent-browser eval` on `/760/meetings/fc6290b0-9443-41ce-866e-be5d9d148e3a/agenda` | Pass | Agenda/Transcript/Sources/Minutes tabs present, convert/revert absent, agenda and action-item sections present, 7 quick links, no horizontal overflow. |
| Minutes empty state | Clicked Minutes tab with `agent-browser eval` | Pass | Shows `Meeting minutes will populate after the meeting has been completed.` |
| Mobile DOM verification | `agent-browser set viewport 375 780` then DOM eval | Pass | No horizontal overflow; tabs, agenda, action items, and quick links render. |
| Keyboard add row | Filled agenda `Add item` and pressed Enter | Pass | Added `Review storefront lead time`; row appeared in agenda and separate action-item section with owner/status/due/priority controls. |
| Browser screenshots | `/tmp/alleato-real-meeting-agenda/desktop-agenda.png`, `/tmp/alleato-real-meeting-agenda/mobile-agenda.png` | Pass | Captured after desktop and mobile verification. |
| Browser errors | `agent-browser errors` | Pass | No browser errors after verification. |
| Test cleanup | `fetch("/api/projects/760/meetings/fc6290b0-9443-41ce-866e-be5d9d148e3a", { method: "DELETE" })` | Pass | Soft delete returned `200` with `success: true`. |

## Files Changed

- `docs/ops/tasks/2026-07-03-real-meeting-agenda-page.md`
- `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/agenda/page.tsx`
- `frontend/src/components/domain/meetings/agenda-section.tsx`
- `frontend/src/components/domain/meetings/agenda-item-row.tsx`
