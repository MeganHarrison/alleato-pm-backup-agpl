# Task: Eve Project Intelligence live delivery proof

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-846 - https://linear.app/megankharrison/issue/AAI-846/prove-live-eve-project-intelligence-delivery-through-deployed-runtime
Related Handoff: docs/ops/handoffs/2026-07-01-S103-eve-live-delivery-proof.md

## Objective

Provision a real runtime target for the Eve Project Intelligence maintainer,
configure the required delivery environment, trigger one real maintainer send,
and read back exactly what Eve delivered.

## Scope Checklist

- [x] Existing Eve maintainer package, delivery code, and prior blocked tasks reviewed.
- [x] Bundled Eve deployment docs reviewed against the installed `eve` version.
- [x] Dedicated Linear tracking issue created before provider changes.
- [x] Runtime host choice and verification plan recorded before deployment work.

## Implementation Checklist

- [x] Create or link a dedicated Vercel runtime target for `agents/project-intelligence-maintainer`.
- [x] Configure required runtime env for Linear delivery.
- [ ] Keep Teams delivery optional and fail-loud when not configured.
- [x] Update task and handoff evidence with exact deployment target and commands.

## Verification Checklist

- [x] Eve package discovery/typecheck/evals still pass after deployment wiring.
- [x] Live deployment health route responds.
- [x] One real maintainer dispatch is triggered against the live runtime.
- [ ] Linear target receives a real Eve-delivered activity/message.
- [ ] Read-back captures the exact sent content or exact provider failure.

## Acceptance Criteria

- A deployable runtime exists for `agents/project-intelligence-maintainer`.
- Required Linear delivery env is present on that runtime.
- A real dispatch proves whether Eve can send to Linear today.
- Final evidence distinguishes configured code, deployed runtime, and actual outbound result.

## Files To Change

- `docs/ops/tasks/2026-07-01-eve-live-delivery-proof.md`
- `docs/ops/handoffs/2026-07-01-S103-eve-live-delivery-proof.md`
- `agents/project-intelligence-maintainer/**` only if runtime-specific fixes are needed

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Eve deployment docs | `agents/project-intelligence-maintainer/node_modules/eve/docs/guides/deployment.md` | Pass | Confirms Vercel deploy path and live route verification sequence. |
| Prior blocker review | `docs/ops/tasks/2026-06-30-eve-linear-delivery.md` | Pass | Confirms runtime target/env was the unresolved blocker. |
| Project creation | `vercel project add alleato-eve-project-intelligence-maintainer --scope team_lZighRY9Xpkb6qZBqDApczKZ` | Pass | Created dedicated Vercel project `prj_KGTpeskPS8avFeH1L9mgxVbEuU7A`. |
| Project link | `vercel link --yes --project alleato-eve-project-intelligence-maintainer` | Pass | Created `agents/project-intelligence-maintainer/.vercel/project.json`. |
| Eve build | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" VERCEL=1 npx eve build` | Pass | Produced `.vercel/output` with `/eve/v1/health`, `/eve/v1/linear`, and cron route. |
| Env read-back | `vercel env list production` | Pass | Production env now includes `LINEAR_API_KEY`, `LINEAR_WEBHOOK_SECRET`, `EVE_PROJECT_INTELLIGENCE_LINEAR_ISSUE_ID`, and `EVE_PROJECT_INTELLIGENCE_MOCK_MODEL`. |
| First deploy | `vercel deploy --prod --yes` | Mixed | Ready deployment but no Eve routes/crons; Vercel ignored build output. |
| Corrected deploy | `vercel deploy --prebuilt --prod --yes` | Pass | Ready deployment `dpl_6Q9WEPGPR9HyNqmYTb9WBA4UpSaH` with live Eve routes and cron. |
| Health check | `GET /eve/v1/health` on `alleato-eve-project-intelligence-ma.vercel.app` | Pass | Returned `200` with `{\"ok\":true,\"status\":\"ready\"...}`. |
| Cron discovery | `vercel crons list` | Pass | Reported 1 cron at `/eve/v1/cron/52WFv8gd5eUCpQmUT8gGNVAUO08fVmfSyYL-yIwbaDE`. |
| Cron invocation | `vercel crons run /eve/v1/cron/52WFv8gd5eUCpQmUT8gGNVAUO08fVmfSyYL-yIwbaDE` | Pass | Triggered at `2026-07-01T15:21:15.050Z`. |
| Runtime logs | Vercel runtime logs for `dpl_6Q9WEPGPR9HyNqmYTb9WBA4UpSaH` | Partial | Show cron route `200` and expected Teams fail-loud block; no Linear env block logged. |

## Risks / Gaps

- Exact Linear Agent Session activity read-back is still unproved with the currently available tools. The Linear MCP connector exposes issues/comments, but not Agent Session activity, and direct GraphQL reads against the local API key failed auth.
- The deployment-path proof currently runs with `EVE_PROJECT_INTELLIGENCE_MOCK_MODEL=true` so the sent content is deterministic and delivery-focused, not a live Project Intelligence health scan.
- Teams delivery remains intentionally fail-loud and unconfigured.

## Blocker Detail

- Cause: the live cron invocation can be proved, but the current local/provider tool surface does not expose Linear Agent Session activities for direct read-back, and direct GraphQL access with the available local API key was not authorized.
- Detection gap: earlier delivery work proved code wiring but did not include a provider-readable Agent Session transcript check.
- Prevention: add a durable read-back path for Agent Sessions (provider API, connector support, or explicit success logging) before calling Eve Linear delivery fully verified.
- Owner: Eve delivery verification / Linear provider read-back path.
- Next action: either configure a real Linear Agent token + matching webhook app and query Agent Sessions through an authorized surface, or add explicit server-side logging of created Agent Session ids and final activity payloads for verification.

## Final Status

- [x] All achievable checklist items are complete or explicitly deferred.
- [ ] Evidence is recorded.
- [x] Any deferred work is explicitly recorded with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
