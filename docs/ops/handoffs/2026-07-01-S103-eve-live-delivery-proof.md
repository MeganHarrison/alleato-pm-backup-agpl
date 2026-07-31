# Handoff: 2026-07-01 - Eve Live Delivery Proof

## Intake Block

1) Session ID: S103
2) Task ID: `docs/ops/tasks/2026-07-01-eve-live-delivery-proof.md`
3) Linear issue: AAI-846
4) Linear URL: https://linear.app/megankharrison/issue/AAI-846/prove-live-eve-project-intelligence-delivery-through-deployed-runtime
5) Current status: Blocked/Deferred after live runtime proof; deployment and cron invocation succeeded, but exact Linear Agent Session activity read-back remains unproved.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-01-eve-live-delivery-proof.md`; `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-01-S103-eve-live-delivery-proof.md`
7) Commands run and outcome (pass/fail counts): `PATH="/opt/homebrew/opt/node@24/bin:$PATH" VERCEL=1 npx eve build` pass; `vercel project add alleato-eve-project-intelligence-maintainer` pass; `vercel link --yes --project alleato-eve-project-intelligence-maintainer` pass; `vercel env list production` pass after env add; first `vercel deploy --prod --yes` mixed (ready deployment but empty routes); `vercel deploy --prebuilt --prod --yes` pass; `GET /eve/v1/health` pass 200; `vercel crons list` pass; `vercel crons run <path>` pass; Vercel runtime logs partial.
8) Evidence artifacts (screenshot/video/report/log paths): Vercel deployment `dpl_6Q9WEPGPR9HyNqmYTb9WBA4UpSaH`; Vercel project `prj_KGTpeskPS8avFeH1L9mgxVbEuU7A`; task doc evidence table.
9) Top 3 findings:
- The maintainer package needed a dedicated Vercel project plus a `--prebuilt` deploy; a normal `vercel deploy` produced a ready deployment with no Eve routes or crons.
- The corrected deployment serves `/eve/v1/health` and registers the weekday maintainer cron path.
- The live cron invocation ran and logged the expected Teams fail-loud block, but the current tool surface did not provide direct read-back of Linear Agent Session activities.
10) Recommended next action (one line): add or obtain an authorized Linear Agent Session read-back surface, then rerun the cron proof and capture the exact posted activity.
11) Handoff file path: `docs/ops/handoffs/2026-07-01-S103-eve-live-delivery-proof.md`
12) Migration ledger evidence: N/A.

## Current Status

Live runtime proof is partially complete:

- Dedicated Vercel project created: `alleato-eve-project-intelligence-maintainer`
- Local link created under `agents/project-intelligence-maintainer/.vercel/project.json`
- Production env configured for delivery-path proof:
  - `LINEAR_API_KEY`
  - `LINEAR_WEBHOOK_SECRET`
  - `EVE_PROJECT_INTELLIGENCE_LINEAR_ISSUE_ID=AAI-846`
  - `EVE_PROJECT_INTELLIGENCE_MOCK_MODEL=true`
- Prebuilt production deployment succeeded:
  - deployment id: `dpl_6Q9WEPGPR9HyNqmYTb9WBA4UpSaH`
  - alias: `https://alleato-eve-project-intelligence-ma.vercel.app`
- Health route returned `200` with ready status.
- Cron registration exists and `vercel crons run` triggered it successfully at `2026-07-01T15:21:15.050Z`.

Read-back remains blocked:

- Vercel runtime logs prove the cron route executed and did not hit the Linear env gate.
- Runtime logs also prove the expected Teams fail-loud block.
- Linear issue comments do not expose Agent Session activities.
- Direct GraphQL read-back with the available local API key could introspect schema but did not authenticate for issue data reads.

## Exact Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm/agents/project-intelligence-maintainer
PATH="/opt/homebrew/opt/node@24/bin:$PATH" VERCEL=1 npx eve build
vercel project add alleato-eve-project-intelligence-maintainer --scope team_lZighRY9Xpkb6qZBqDApczKZ
vercel link --yes --project alleato-eve-project-intelligence-maintainer --scope team_lZighRY9Xpkb6qZBqDApczKZ
vercel deploy --prebuilt --prod --yes
vercel crons list
vercel crons run /eve/v1/cron/52WFv8gd5eUCpQmUT8gGNVAUO08fVmfSyYL-yIwbaDE
```

## Blocker Detail

Cause: exact Linear Agent Session activity read-back is not available through the current Linear MCP tools, and direct GraphQL issue reads were not authorized with the locally available API key.

Detection gap: prior delivery work stopped at code wiring and runtime config, so there was no provider-level transcript proof requirement for Agent Activities.

Prevention: add a supported verification path for Agent Sessions before calling Eve Linear delivery fully verified.

Owner: Eve delivery verification / Linear provider read-back path.

Next action: obtain an authorized Agent Session read surface or add explicit server-side success logging for created session ids and final activity payloads, then rerun the cron proof.
