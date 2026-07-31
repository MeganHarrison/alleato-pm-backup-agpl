# Handoff: 2026-06-30 - Eve Teams Delivery

## Intake Block

1) Session ID: S102
2) Task ID: `docs/ops/tasks/2026-06-30-eve-teams-delivery.md`
3) Linear issue: AAI-778
4) Linear URL: https://linear.app/megankharrison/issue/AAI-778/connect-eve-project-intelligence-maintainer-to-teams-delivery
5) Current status: Code complete; runtime Teams provider delivery blocked until Bot Framework credentials and a proactive conversation reference exist.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer/agent/channels/teams.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer/agent/schedules/weekday-maintainer-scan.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer/README.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-30-eve-teams-delivery.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-30-S102-eve-teams-delivery.md`
7) Commands run and outcome (pass/fail counts): `npm run typecheck` pass; `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info` pass with 0 errors and 0 warnings; `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval` pass 5/5 evals and 14/14 gates; compiled manifest read-back pass.
8) Evidence artifacts (screenshot/video/report/log paths): This handoff and Linear AAI-778 comments.
9) Top 3 findings:
- Eve Teams uses Bot Framework Activities and mounts at `/eve/v1/teams`.
- Proactive Teams delivery requires `serviceUrl` and `conversationId`; optional team/channel/thread fields are supported.
- Teams delivery should be secondary to Linear so Linear remains the durable record.
10) Recommended next action (one line): Configure Azure Bot/Teams provider env and proactive target values, then dispatch the weekday schedule and verify a Teams message.
11) Handoff file path: `docs/ops/handoffs/2026-06-30-S102-eve-teams-delivery.md`
12) Migration ledger evidence: N/A.

## Linear Updates

- Kickoff: AAI-778 created before implementation with scope and validation plan.

## Current Status

Implementation is complete in code. This slice adds Teams delivery as an
optional second channel while preserving Linear as the required durable delivery
surface.

- Added `agent/channels/teams.ts` using Eve's native `teamsChannel`.
- Updated `agent/schedules/weekday-maintainer-scan.ts` to call
  `receive(teams, ...)` when Teams env is configured.
- Kept Linear as the required durable delivery path.
- Added fail-loud missing-env logging for Bot Framework credentials and the
  Teams proactive conversation target.
- Updated the package README with Teams setup requirements.

## Verification Plan

```bash
cd /Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer
npm run typecheck
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval
```

## Blocker Detail

Cause: Eve Teams proactive delivery needs Azure Bot Framework credentials and an
existing Teams conversation reference. The package currently has no deployment
target/env configured for `MICROSOFT_APP_ID`, `MICROSOFT_APP_PASSWORD`,
`EVE_PROJECT_INTELLIGENCE_TEAMS_SERVICE_URL`, or
`EVE_PROJECT_INTELLIGENCE_TEAMS_CONVERSATION_ID`.

Detection gap: prior delivery work only wired Linear, so Teams provider values
were not part of the read-back contract.

Prevention: keep Teams delivery fail-loud and optional until provider env is
configured and a schedule dispatch proves a Teams message lands in the target
conversation.

Owner: Eve deployment/provider configuration for
`agents/project-intelligence-maintainer`.

Next action: register/configure the Teams bot endpoint at `/eve/v1/teams`, add
the runtime env values, dispatch `weekday-maintainer-scan`, and verify the
Teams message.
