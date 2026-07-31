# Task: Submittal Detail Design-System Repair

Status: In Progress
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-937 - https://linear.app/megankharrison/issue/AAI-937/unify-submittal-detail-page-with-shared-header-actions-and-detail
Related Handoff: `docs/ops/handoffs/2026-07-04-S112-submittal-detail-design-system-repair.md`

## Objective

Audit and fix the exact submittal detail route at `/876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4` so it uses the required shared Alleato design-system patterns for header actions and detail metadata, and fix incorrect or misleading field rendering on the right-side detail surface.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: submittal detail page
One purpose: inspect and act on one submittal record
Primary user job: review the submittal, update key metadata, and take the next workflow action
Primary action: use consistent header controls and editable metadata to manage the submittal
Secondary actions: duplicate, delete, email/distribute, open AI Review
Next action after success: continue editing or move to the next workflow step
Correction path: inline metadata edits plus shared overflow actions
Keyboard path: tab through header actions and inline metadata controls; trigger overflow menu with keyboard and select commands
Information that belongs elsewhere: export configuration detail beyond the compact header action, historical/global activity views
Blessed pattern: Pattern A Header Action Dropdown + Pattern G Detail Property Bar
Complexity budget: compact header menu, shared detail metadata row, no bespoke sidebar property grid
Pass/fail: Fail before implementation; current page mixes bespoke action treatment and feature-local metadata rows

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
- [ ] Centralized/shared abstraction used when the behavior is cross-cutting.
- [ ] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [ ] Errors are specific and actionable; no silent fallback added.
- [ ] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [ ] End-to-end path wired through one owner, not separate disconnected pieces.
- [ ] All entry points for the workflow use the same canonical service/runtime.
- [ ] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [ ] Guardrail added so the same class of bug fails loudly next time.
- [ ] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [ ] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [ ] The top-right action cluster on the exact submittal detail route matches the shared Alleato compact header-action pattern.
- [ ] The overflow menu uses the standard dropdown menu primitive and consistent icon/label density.
- [ ] Header actions no longer mix icon-only and icon-plus-text treatment arbitrarily.
- [ ] The detail metadata surface uses shared property-row primitives instead of the current feature-local sidebar field stack where applicable.
- [ ] Responsible contractor renders a human-readable company name, not an ID.
- [ ] Empty date states and editable date labels are specific, non-duplicative, and not visually absurd on the exact page.
- [ ] Browser verification is captured against the exact route named by the user.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Design doctrine diagnosis | repo inspection + doctrine references | Pass | Existing page currently fails Pattern A and Pattern G. |
| Surface complexity audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/features/submittals/submittal-detail-client.tsx` | Pass | Changed UI file passes the doctrine audit after the header/property-bar repair. |
| Targeted lint | `cd frontend && ./node_modules/.bin/eslint 'src/features/submittals/submittal-detail-client.tsx' 'src/app/(main)/[projectId]/submittals/[submittalId]/page.tsx'` | Pass with existing warning | No errors. Remaining warning is the existing `design-system/require-page-shell` rule on the Next page file wrapper pattern. |
| Changed-file type gate | `cd frontend && npm run typecheck:changed` | Pass | `No new 'any' type debt detected in changed changes.` |
| Browser proof on exact production route | `agent-browser --state frontend/tests/.auth/user.json ... https://projects.alleatogroup.com/...` and `agent-browser --state frontend/config/.auth/user.json ...` | Blocked | Both saved auth states redirect the exact production route to `/auth/login`. |
| Browser proof on exact local route | `curl -I -m 10 'http://localhost:3001/876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4'`; `agent-browser --session submittal-verify-3001 auth login alleato-test-3001`; `agent-browser --session submittal-verify-3001 open 'http://localhost:3001/876/submittals/e2b8898d-d3f8-4e63-b16a-61fa9f1e12c4?...'` | Blocked | Local route returns `307` to `/auth/login`; auth-profile bootstrap failed with `page.goto: net::ERR_ABORTED`; follow-up route open timed out. Screenshot attempts produced a blank artifact instead of the page. |

## Files Changed

- `docs/ops/tasks/2026-07-04-submittal-detail-design-system-repair.md` - task ledger and done gate.
- `docs/ops/handoffs/2026-07-04-S112-submittal-detail-design-system-repair.md` - worker handoff and evidence log.
- `docs/ops/orchestration/session-board.md` - ownership claim for this task.
- `frontend/src/features/submittals/submittal-detail-client.tsx` - exact route owner for header actions and detail metadata rendering.
- `frontend/src/components/ui/detail-property-bar.tsx` - shared property bar primitive if extraction/extension is needed.

## Risks / Gaps

- The submittal detail file is already dirty in this checkout from a separate in-flight export slice, so edits must be constrained carefully to avoid clobbering unrelated work.
- Exact browser verification is still blocked by auth/bootstrap failures on both the production and local copies of the exact route.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
