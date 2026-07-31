# Task: Eve Project Intelligence Linear delivery

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-777 - https://linear.app/megankharrison/issue/AAI-777/connect-eve-project-intelligence-maintainer-to-linear-delivery
Related Handoff: docs/ops/handoffs/2026-06-30-S101-eve-linear-delivery.md

## Objective

Connect the Eve Project Intelligence maintainer to Linear so scheduled maintainer
results have a durable delivery surface, ownership context, and follow-up thread.

## Scope Checklist

- [x] Eve docs for Linear channels, schedules, and MCP connections reviewed.
- [x] Existing Eve maintainer package and schedule reviewed.
- [x] Linear issue created before implementation.
- [x] Delivery target and env contract defined before coding.

## Implementation Checklist

- [x] Add Eve Linear channel configuration.
- [x] Update weekday maintainer schedule to hand off to Linear.
- [x] Fail loudly when Linear delivery configuration is missing.
- [x] Update README with delivery setup and verification commands.
- [x] Update handoff with files, risks, and evidence.

## Verification Checklist

- [x] Eve package typecheck passes.
- [x] Eve discovery reports 0 errors.
- [x] Eve evals still pass.
- [x] Linear issue receives kickoff/progress evidence.
- [x] Known unrelated local changes are documented.

## Acceptance Criteria

- `agent/channels/linear.ts` exists and uses Eve's native Linear Agent Session
  channel.
- `agent/schedules/weekday-maintainer-scan.ts` sends the maintainer run to a
  configured Linear issue through `receive(linear, ...)`.
- Missing delivery env is explicit and actionable in logs.
- The implementation does not add automatic packet mutation.

## Files To Change

- `agents/project-intelligence-maintainer/agent/channels/linear.ts`
- `agents/project-intelligence-maintainer/agent/schedules/weekday-maintainer-scan.ts`
- `agents/project-intelligence-maintainer/README.md`
- `docs/ops/tasks/2026-06-30-eve-linear-delivery.md`
- `docs/ops/handoffs/2026-06-30-S101-eve-linear-delivery.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Linear issue | AAI-777 | Pass | Created under parent AAI-774 before implementation. |
| Typecheck | `npm run typecheck` from `agents/project-intelligence-maintainer` | Pass | Linear channel and schedule compile. |
| Eve discovery | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info` | Pass | 0 errors, 0 warnings. |
| Eve evals | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval` | Pass | 5/5 evals and 14/14 gates still pass. |
| Compiled manifest read-back | `.eve/compile/compiled-agent-manifest.json` | Pass | Linear channel registered at `/eve/v1/linear`; weekday schedule has `hasRun: true`. |

## Risks / Gaps

- Provider delivery is blocked until an Eve runtime deployment target exists and
  Linear agent credentials are configured there. `agents/project-intelligence-maintainer`
  currently has no `.vercel/project.json`, local `.env`, or deployment target
  to update/read back.
- Required runtime env:
  `LINEAR_AGENT_ACCESS_TOKEN`, `LINEAR_WEBHOOK_SECRET`, and
  `EVE_PROJECT_INTELLIGENCE_LINEAR_ISSUE_ID`.
- Existing unrelated local edits are present in email/outlook feedback files and
  must not be staged with this task.

## Final Status

- [x] Code/documentation checklist items are complete.
- [x] Evidence is recorded.
- [x] Runtime provider delivery is explicitly blocked/deferred with cause, detection gap, prevention, owner, and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
