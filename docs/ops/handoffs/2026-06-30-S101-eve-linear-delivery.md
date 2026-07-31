# Handoff: 2026-06-30 - Eve Linear Delivery

## Intake Block

1) Session ID: S101
2) Task ID: `docs/ops/tasks/2026-06-30-eve-linear-delivery.md`
3) Linear issue: AAI-777
4) Linear URL: https://linear.app/megankharrison/issue/AAI-777/connect-eve-project-intelligence-maintainer-to-linear-delivery
5) Current status: Code complete; runtime provider delivery blocked until the Eve deployment target and Linear agent credentials exist.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer/agent/channels/linear.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer/agent/schedules/weekday-maintainer-scan.ts`; `/Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer/README.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-30-eve-linear-delivery.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-30-S101-eve-linear-delivery.md`
7) Commands run and outcome (pass/fail counts): `npm run typecheck` pass; `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info` pass with 0 errors and 0 warnings; `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval` pass 5/5 evals and 14/14 gates; compiled manifest read-back pass.
8) Evidence artifacts (screenshot/video/report/log paths): This handoff and Linear AAI-777 comments.
9) Top 3 findings:
- Eve's native Linear channel is now registered at `/eve/v1/linear`; it uses Linear Agent Sessions, not plain comments.
- Weekday schedule now hands off to Linear with `receive(linear, ...)` and a configured target issue.
- Runtime delivery is blocked until an Eve deployment target and Linear agent credentials are available.
10) Recommended next action (one line): Link/deploy the Eve package, configure Linear agent env, then dispatch the weekday schedule and verify a Linear Agent Activity on the target issue.
11) Handoff file path: `docs/ops/handoffs/2026-06-30-S101-eve-linear-delivery.md`
12) Migration ledger evidence: N/A.

## Linear Updates

- Kickoff: AAI-777 created before implementation with scope and validation plan.
- Progress: Code complete locally; Linear comment posted with verification and runtime env blocker.

## Current Status

Implementation is complete in code. This slice changes only communication and
delivery behavior:

- Added `agent/channels/linear.ts` using Eve's native `linearChannel`.
- Updated `agent/schedules/weekday-maintainer-scan.ts` to call
  `receive(linear, ...)` with a configured target issue.
- Added fail-loud missing-env logging for `EVE_PROJECT_INTELLIGENCE_LINEAR_ISSUE_ID`,
  Linear access token, and `LINEAR_WEBHOOK_SECRET`.
- Updated the package README with the Linear delivery contract.

Provider delivery remains blocked because there is no linked deployment target
or local runtime env file under `agents/project-intelligence-maintainer`.

## Verification Plan

```bash
cd /Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer
npm run typecheck
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run info
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval
```

## Risks

- Provider delivery cannot complete without valid Linear agent credentials in
  the Eve runtime environment.
- Existing unrelated local edits are present outside this task and must remain
  untouched.

## Blocker Detail

Cause: Eve Linear Agent Session delivery needs a running Eve deployment with
`LINEAR_AGENT_ACCESS_TOKEN`, `LINEAR_WEBHOOK_SECRET`, and
`EVE_PROJECT_INTELLIGENCE_LINEAR_ISSUE_ID`. The package currently has no
`.vercel/project.json`, `.env`, or equivalent deployment target to update.

Detection gap: v1 had a report-only schedule, so there was no provider
configuration read-back requirement.

Prevention: keep the schedule fail-loud until the provider env is configured and
verify future delivery with a Linear Agent Activity read-back on the target
issue.

Owner: Eve deployment/provider configuration for
`agents/project-intelligence-maintainer`.

Next action: link/deploy the Eve package, configure the three required env vars,
dispatch `weekday-maintainer-scan`, and confirm the target Linear issue receives
an Agent Activity.
