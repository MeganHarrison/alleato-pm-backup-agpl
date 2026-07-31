# Task: Eve Project Intelligence Teams delivery

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-778 - https://linear.app/megankharrison/issue/AAI-778/connect-eve-project-intelligence-maintainer-to-teams-delivery
Related Handoff: docs/ops/handoffs/2026-06-30-S102-eve-teams-delivery.md

## Objective

Connect the Eve Project Intelligence maintainer to Microsoft Teams delivery
using Eve's native Teams channel while preserving Linear as the durable record.

## Scope Checklist

- [x] Eve Teams channel docs and receive target types reviewed.
- [x] Existing Linear delivery schedule reviewed.
- [x] Linear issue created before implementation.
- [x] Provider env and proactive Teams target requirements identified.

## Implementation Checklist

- [x] Add Eve Teams channel configuration.
- [x] Update weekday schedule to optionally hand off to Teams.
- [x] Keep Linear delivery intact.
- [x] Fail loudly when Teams provider configuration is incomplete.
- [x] Update README and handoff with Teams setup requirements.

## Verification Checklist

- [x] Eve package typecheck passes.
- [x] Eve discovery reports 0 errors.
- [x] Eve evals still pass.
- [x] Compiled manifest includes Teams channel.
- [x] Linear issue receives implementation evidence.

## Acceptance Criteria

- `agent/channels/teams.ts` exists and uses Eve's native Teams channel.
- `weekday-maintainer-scan` supports Teams proactive handoff when configured.
- Missing Teams config is explicit and does not silently claim delivery.
- No automatic Project Intelligence mutation is added.

## Files To Change

- `agents/project-intelligence-maintainer/agent/channels/teams.ts`
- `agents/project-intelligence-maintainer/agent/schedules/weekday-maintainer-scan.ts`
- `agents/project-intelligence-maintainer/README.md`
- `docs/ops/tasks/2026-06-30-eve-teams-delivery.md`
- `docs/ops/handoffs/2026-06-30-S102-eve-teams-delivery.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Linear issue | AAI-778 | Pass | Created under parent AAI-774 before implementation. |
| Typecheck | `npm run typecheck` from `agents/project-intelligence-maintainer` | Pass | Teams channel and optional schedule handoff compile. |
| Eve discovery | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info` | Pass | 0 errors, 0 warnings. |
| Eve evals | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval` | Pass | 5/5 evals and 14/14 gates still pass. |
| Compiled manifest read-back | `.eve/compile/compiled-agent-manifest.json` | Pass | Teams channel registered at `/eve/v1/teams`; Linear remains registered at `/eve/v1/linear`; weekday schedule has `hasRun: true`. |

## Risks / Gaps

- Runtime Teams delivery is blocked until the Eve runtime has Azure Bot
  credentials and a proactive Teams conversation reference.
- Cause: proactive Bot Framework delivery requires `MICROSOFT_APP_ID`,
  `MICROSOFT_APP_PASSWORD`, `EVE_PROJECT_INTELLIGENCE_TEAMS_SERVICE_URL`, and
  `EVE_PROJECT_INTELLIGENCE_TEAMS_CONVERSATION_ID`.
- Detection gap: Teams was not part of the previous Linear delivery read-back
  contract.
- Prevention: schedule logs an explicit Teams blocked message while preserving
  Linear delivery as the durable record.
- Owner: Eve deployment/provider configuration for
  `agents/project-intelligence-maintainer`.
- Next action: configure the Teams bot endpoint and target conversation env,
  then dispatch the schedule and verify a Teams message.
- Existing unrelated local edits are present in email/outlook feedback files and
  must not be staged with this task.

## Final Status

- [x] Code/documentation checklist items are complete.
- [x] Evidence is recorded.
- [x] Runtime provider delivery is explicitly blocked/deferred with cause, detection gap, prevention, owner, and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
