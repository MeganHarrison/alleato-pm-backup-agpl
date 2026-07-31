# Task: Tasks Split Page Noise Repair

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-940 - https://linear.app/megankharrison/issue/AAI-940/repair-tasks-split-page-metadata-and-feedback-density
Related Task: `docs/ops/tasks/2026-07-04-tasks-split-page-design-repair.md`

## Objective

Reduce visual noise and duplicate visual weight on `http://localhost:3001/tasks?scope=all&view=split` while preserving the shared split-page workspace pattern and task-detail editing workflow.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: tasks split-page work queue
One purpose: review and correct task records from a shared company task queue
Primary user job: scan tasks, select one, understand its ownership/state fast, and edit the selected task without UI distraction
Primary action: select and edit the active task
Secondary actions: switch views, change scope, search, bulk-edit selected tasks, open source
Next action after success: continue to the next relevant task in the queue
Correction path: selected task stays editable in the detail pane; bulk actions stay in list context
Keyboard path: arrow keys move selection; Enter opens/selects; Tab reaches detail controls; Escape exits mobile detail state
Information that belongs elsewhere: stat-style summaries, decorative lane coloring, repeated emphasis badges, and selection chrome that competes with task text
Blessed pattern: Pattern F Split-Page Work Queue + Pattern G Detail Property Bar
Complexity budget: full-page split queue with compact list header, quiet rows, and subordinate board/list metadata
Pass/fail: Fail before implementation; current split/list/board surfaces still spend too much attention on selection chrome, counts, and color treatment.

## Scope Checklist

- [x] Existing architecture and prior task ledger reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Centralized/shared abstraction used when behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors remain specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows product noise gate and design-system rules.

## Integration Checklist

- [x] Split route keeps using `SplitPageFrame` and `SplitPage`.
- [x] Selected task detail keeps using shared `DetailPropertyBar` and `DetailPropertyItem`.
- [x] Split list rows no longer use banned left-accent selection treatment.
- [x] Empty detail state no longer uses stat-card/hero-metric treatment.
- [x] Board view no longer relies on loud lane/card color treatment to explain status.

## Regression Guardrails

- [x] Doctrine audit scripts run on changed UI files.
- [x] Targeted tests updated only for intentional behavior changes.

## Verification Checklist

- [x] Targeted lint/type/unit checks run, or explicitly delegated where expensive.
- [ ] Browser/user-flow verification run for the exact split route.
- [x] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] Split list selected rows read as quiet row selection, not a highlighted card with a side stripe.
- [x] Empty detail state explains the next action without surfacing stat counts or dashboard treatment.
- [x] Board view uses restrained neutral treatment; status remains understandable without loud lane fills or repeated badges.
- [x] Split workspace header/list controls keep the current workflow but with less competing chrome.
- [x] The selected task detail pane remains editable and visually dominant over supporting metadata.

## Planned Files

- `docs/ops/tasks/2026-07-06-tasks-split-page-noise-repair.md`
- `frontend/src/features/tasks/tasks-inbox.tsx`
- `frontend/src/features/tasks/tasks-board-view.tsx`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Browser diagnosis | `agent-browser --auto-connect get html body` | Pass | Route renders locally; exact split surface reachable in the open in-app browser session. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/features/tasks/tasks-inbox.tsx' 'src/features/tasks/tasks-board-view.tsx'` | Pass | Clean after flattening the board card treatment. |
| Changed-file type debt gate | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Targeted unit test | `cd frontend && npm run test:unit -- --runTestsByPath src/features/tasks/__tests__/tasks-inbox-feedback.test.tsx --runInBand` | Pass | Existing split-view regression suite still passes. |
| Surface complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/features/tasks/tasks-inbox.tsx frontend/src/features/tasks/tasks-board-view.tsx` | Pass | Both changed UI files passed. |
| Split-page consistency audit | `node .agents/skills/impeccable/scripts/alleato/audit-split-page-consistency.mjs frontend/src/features/tasks/tasks-inbox.tsx` | Pass | Split workspace file passed. |
| Local browser screenshot | `/tmp/tasks-split-autoconnect.png` | Blocked | Auto-connected browser stayed visually blank despite the route HTML being present, so visual verification is not complete. |

## Risks / Gaps

- The checkout has unrelated dirty files across docs, screenshots, frontend, and migrations; only task-owned files may be staged.
- Local browser auth/state is noisy and returns unrelated 401/412 console noise; split-route verification must focus on rendered behavior rather than a clean console.
- Browser automation currently reaches the local route URL and HTML body, but screenshots from the open browser session remain blank and expose no interactive tree. Cause: the open browser session carries stale auth/hydration state unrelated to this task. Detection gap: route reachability alone does not prove a visually usable render. Prevention step: reset to a clean authenticated local browser session before calling the UI visually verified.
