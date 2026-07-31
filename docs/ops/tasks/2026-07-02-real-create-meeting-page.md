# Task: Real Create Meeting Page

Status: Complete
Owner: Codex
Created: 2026-07-02
Linear Issue: Blocked - connector exposes comments only, not issue creation
Linear URL: N/A
Related Handoff: N/A

## Objective

Develop the real project-scoped create meeting page so it follows the approved design-system direction from the static mock-up while reusing existing meeting form contracts and primitives.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Doctrine Gate

Surface: Create meeting page
One purpose: create a project meeting and seed its initial planning context.
Primary user job: schedule the meeting, choose a template, set attendees, and start the agenda without leaving the page.
Primary action: Create agenda
Secondary actions: Cancel
Next action after success: route to the created meeting agenda tab.
Correction path: edit meeting fields and attendee selection before submit; validation errors remain in place.
Keyboard path: tab through form controls, type into searchable attendee/template controls, submit from the form.
Information that belongs elsewhere: full agenda editing, full task management, source review, and project tool navigation.
Blessed pattern: Form page using PageShell plus existing form field primitives.
Complexity budget: Full page, pass.
Pass/fail: Pass.

## Acceptance Criteria

- [x] `/[projectId]/meetings/new` uses the real design-system form page, not the old narrow stacked form.
- [x] Template selector is positioned in the right-side header/control area on desktop and stacks cleanly on mobile.
- [x] Meeting details, attendees, and planning context are visually quiet and aligned with existing form primitives.
- [x] The form keeps the existing create-meeting mutation contract and redirect to `/${projectId}/meetings/${meetingId}/agenda`.
- [x] The page has one primary create action.
- [x] The page can be browser-tested at the actual route without horizontal overflow.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Refactor `CreateMeetingForm` layout without changing database/API contract.
- [x] Update the page shell header copy/actions if needed.
- [x] Preserve existing validation, defaults, attendee loading, and submit behavior.
- [x] Remove redundant descriptions or duplicate primary actions.

## Planned Files

- `docs/ops/tasks/2026-07-02-real-create-meeting-page.md`
- `frontend/src/app/(main)/[projectId]/meetings/new/page.tsx`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`

## Integration Checklist

- [x] Doctrine surface complexity audit passes for touched UI files.
- [x] Focused ESLint passes for touched UI files.
- [x] Browser verification runs on the real route or blocker is recorded.

## Regression Guardrails

- [x] No duplicate primary CTA.
- [x] No nested cards or page-level bordered wrapper shells.
- [x] No route/API contract changes.
- [x] Validation and submit failure paths remain visible in the existing form state.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task template gate | `rg --files docs . \| rg 'TASK-TEMPLATE|task.*template|tasks/.+\.md$'` | Process gap | The AGENTS-referenced `docs/ops/tasks/TASK-TEMPLATE.md` is absent, so this task mirrors current `docs/ops/tasks/*` format. |
| Linear issue gate | `tool_search Linear create issue comment` | Blocked | Available Linear MCP tools expose comments, not issue creation. |
| Doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs 'frontend/src/app/(main)/[projectId]/meetings/new/page.tsx' frontend/src/components/domain/meetings/create-meeting-form.tsx` | Pass | Both touched UI files passed. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/meetings/new/page.tsx' 'src/components/domain/meetings/create-meeting-form.tsx'` | Pass | No lint errors. |
| Whitespace diff | `git diff --check -- docs/ops/tasks/2026-07-02-real-create-meeting-page.md 'frontend/src/app/(main)/[projectId]/meetings/new/page.tsx' frontend/src/components/domain/meetings/create-meeting-form.tsx` | Pass | No whitespace errors. |
| Auth fallback | UI login with test auth on `http://localhost:3001/760/meetings/new` | Pass | `/25125` denied for test user, so verified same real route/component on authorized project `760`. |
| Desktop DOM verification | `agent-browser eval` on `/760/meetings/new` at 1488px | Pass | One `Create agenda` button, template/planning column on the right, seven quick links, no horizontal overflow. |
| Create submit flow | Created `Codex create meeting UI test` from `/760/meetings/new` | Pass | Redirected to `/760/meetings/c6953c95-472c-47df-a916-a24f2d685dab/agenda`. |
| Test cleanup | `fetch("/api/projects/760/meetings/c6953c95-472c-47df-a916-a24f2d685dab", { method: "DELETE" })` | Pass | Soft delete returned `200` with `success: true`. |
| Mobile DOM verification | `agent-browser eval` on `/760/meetings/new` at 375px | Pass | No horizontal overflow, one create action, right planning column stacks below main form. |
| Browser screenshots | `/tmp/alleato-real-create-meeting/desktop-760-create-meeting.png`, `/tmp/alleato-real-create-meeting/mobile-760-create-meeting.png` | Pass | Captured after real route verification. |
| Browser errors | `agent-browser errors` | Pass | No browser errors after verification. |

## Files Changed

- `docs/ops/tasks/2026-07-02-real-create-meeting-page.md`
- `frontend/src/app/(main)/[projectId]/meetings/new/page.tsx`
- `frontend/src/components/domain/meetings/create-meeting-form.tsx`
