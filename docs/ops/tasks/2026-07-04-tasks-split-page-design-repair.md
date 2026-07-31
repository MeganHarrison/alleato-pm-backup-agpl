# Task: Tasks Split Page Design Repair

Status: Complete Locally / Publish Blocked By Unrelated Guardrail Debt
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-940 - https://linear.app/megankharrison/issue/AAI-940/repair-tasks-split-page-metadata-and-feedback-density
Related Handoff: N/A

## Objective

Audit and fix `https://projects.alleatogroup.com/tasks?scope=all&view=split` so the tasks split workspace follows the Alleato Design Doctrine for split-page work queues, detail property rows, feedback/correction controls, and source context rendering.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: tasks split-page work queue
One purpose: review and correct tasks generated from source records
Primary user job: scan the task list, select one task, inspect/edit its task properties, and record AI feedback only when needed
Primary action: update the selected task status/metadata or correct the task text
Secondary actions: delete, open source, mark generated task feedback
Next action after success: continue to the next selected task or keep editing the current task
Correction path: inline title edit, inline property controls, and one detail-pane feedback control
Keyboard path: arrow keys move through tasks; Enter opens/selects; Tab reaches detail controls; Escape exits mobile detail/edit states
Information that belongs elsewhere: repeated AI feedback buttons in list/card rows, dense source record chrome, duplicate metadata in one property row
Blessed pattern: Pattern F Split-Page Work Queue + Pattern G Detail Property Bar
Complexity budget: full-page split queue with compact list toolbar and subordinate two-row detail metadata
Pass/fail: Fail before implementation; the selected task detail row is overloaded, AI feedback appears in multiple places, and source context can render with inconsistent visual treatment.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules.

## Integration Checklist

- [x] The split route keeps using `SplitPageFrame` and `SplitPage`.
- [x] Detail metadata uses shared `DetailPropertyBar` and `DetailPropertyItem`.
- [x] List, board, and detail surfaces no longer duplicate the same AI feedback action.
- [x] Source context rendering stays visually subordinate to the selected task title and metadata.
- [x] Run/task/session ledger records meaningful attempts.
- [x] Artifacts link back to source evidence and run logs.

## Regression Guardrails

- [x] Focused unit/component test added or updated for duplicate feedback controls.
- [x] Doctrine audit scripts run on changed UI files.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] On `/tasks?scope=all&view=split`, generated-task feedback appears in one detail-pane location, not in both the selected list row/card and detail metadata.
- [x] The selected task metadata is split into two balanced property rows: workflow ownership fields first, source/history fields second.
- [x] The detail metadata remains icon-plus-value/action via the shared property bar pattern.
- [x] Source context, including the St. Pete showroom proposal content, renders in the same quiet detail-pane style as other source context blocks.
- [x] The split view keeps the shared list-left/detail-right behavior and existing keyboard navigation.
- [x] Browser evidence is captured against the exact route, or the auth/tool blocker is recorded explicitly.

## Planned Files

- `docs/ops/tasks/2026-07-04-tasks-split-page-design-repair.md`
- `frontend/src/features/tasks/tasks-inbox.tsx`
- `frontend/src/features/tasks/tasks-board-view.tsx`
- `frontend/src/features/tasks/__tests__/tasks-inbox-feedback.test.tsx`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Design doctrine diagnosis | doctrine refs + repo inspection | Pass | Current implementation fails due metadata explosion and duplicate feedback controls. |
| Linear tracking | `AAI-940` | Pass | Issue created before code edits. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/features/tasks/tasks-inbox.tsx' 'src/features/tasks/tasks-board-view.tsx' 'src/features/tasks/__tests__/tasks-inbox-feedback.test.tsx'` | Pass | No output; no lint errors. |
| Surface complexity audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/features/tasks/tasks-inbox.tsx frontend/src/features/tasks/tasks-board-view.tsx` | Pass | Both changed UI files passed. |
| Split-page consistency audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-split-page-consistency.mjs frontend/src/features/tasks/tasks-inbox.tsx` | Pass | Split workspace file passed. |
| Changed-file type debt gate | `cd frontend && npm run typecheck:changed` | Pass | `No new 'any' type debt detected in changed changes.` |
| Incorrect test command | `cd frontend && npm test -- --runTestsByPath src/features/tasks/__tests__/tasks-inbox-feedback.test.tsx --runInBand` | Expected failure | `npm test` is Playwright in this repo and does not accept Jest `--runTestsByPath`. Re-run through `test:unit`. |
| Targeted unit test | `cd frontend && npm run test:unit -- --runTestsByPath src/features/tasks/__tests__/tasks-inbox-feedback.test.tsx --runInBand` | Pass | 1 suite, 3 tests passed. |
| Production browser route | `agent-browser --session tasks-split-prod --state frontend/tests/.auth/user.json open 'https://projects.alleatogroup.com/tasks?scope=all&view=split'` | Blocked | Saved state redirected to `/auth/login?callbackUrl=%2Ftasks%3Fscope%3Dall%26view%3Dsplit`. |
| Local browser route | `agent-browser --session tasks-split-local --state frontend/tests/.auth/user.json open 'http://localhost:3001/tasks?scope=all&view=split'` | Pass | Reached local tasks split route. |
| Local visual evidence | `docs/ops/evidence/2026-07-04-tasks-split-page-design-repair/local-tasks-split.png` | Pass | Screenshot shows two metadata rows, normalized St. Pete source property, and only two feedback vote controls. |
| Source link check | `agent-browser --session tasks-split-local click @e2035 && agent-browser --session tasks-split-local wait 1000 && agent-browser --session tasks-split-local get url` | Pass | Source link click did not navigate away; source treatment remains inline in the detail property bar. |
| Local source visual evidence | `docs/ops/evidence/2026-07-04-tasks-split-page-design-repair/local-tasks-split-source-link.png` | Pass | Follow-up screenshot captured after source interaction. |
| Finish flow | `npm run codex:finish -- --message "Repair tasks split-page design density" --files ...` | Blocked | `quality:changed` failed on unrelated `frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/pdf/route.ts` due a new `as unknown as BodyInit` double-cast outside this task scope. |
| Wider first pane API | `SplitPage firstPaneWidth="30rem"` + `TASKS_SPLIT_FIRST_PANE_WIDTH` | Pass | Shared primitive owns the first-pane width; email/default split-page behavior remains unchanged. |
| Wider first pane browser measurement | `agent-browser --session tasks-split-width eval ...` | Pass | Loaded local tasks split page measured first pane at `480px` with `1000` task rows present. |
| Wider first pane visual evidence | `docs/ops/evidence/2026-07-04-tasks-split-page-design-repair/local-tasks-split-wider-column-loaded.png` | Pass | Loaded-state screenshot captured after applying the wider tasks column. |

## Files Changed

- `docs/ops/tasks/2026-07-04-tasks-split-page-design-repair.md`
- `docs/ops/evidence/2026-07-04-tasks-split-page-design-repair/local-tasks-split.png`
- `docs/ops/evidence/2026-07-04-tasks-split-page-design-repair/local-tasks-split-source-link.png`
- `docs/ops/evidence/2026-07-04-tasks-split-page-design-repair/local-tasks-split-wider-column.png`
- `docs/ops/evidence/2026-07-04-tasks-split-page-design-repair/local-tasks-split-wider-column-loaded.png`
- `frontend/src/components/ui/split-page.tsx`
- `frontend/src/components/ui/__tests__/split-page.test.tsx`
- `frontend/src/features/tasks/tasks-inbox.tsx`
- `frontend/src/features/tasks/tasks-board-view.tsx`
- `frontend/src/features/tasks/__tests__/tasks-inbox-feedback.test.tsx`

## Risks / Gaps

- The checkout has unrelated dirty files from other active tasks; this task must only stage/report task-owned files.
- Exact production browser proof is auth-blocked by saved-state redirect. Local authenticated route proof succeeded on port 3001.
- Publish is blocked by unrelated guardrail debt in `frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/pdf/route.ts`. Cause: `quality:changed` checks the broader dirty frontend worktree, not only this task's file scope. Detection gap: an unrelated in-flight submittal export edit introduced a guarded unsafe double-cast before this finish attempt. Prevention step: repair that typed response path or finish it in its owning task, then rerun `codex:finish` with the same explicit file list.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
