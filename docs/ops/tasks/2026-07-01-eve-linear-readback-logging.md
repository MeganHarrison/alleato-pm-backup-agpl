# Task: Eve Linear Agent Session read-back logging

Status: Complete
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-847 - https://linear.app/megankharrison/issue/AAI-847/add-eve-linear-agent-session-read-back-logging-and-rerun-cron-proof
Parent Issue: AAI-846 - https://linear.app/megankharrison/issue/AAI-846/prove-live-eve-project-intelligence-delivery-through-deployed-runtime
Related Handoff: docs/ops/handoffs/2026-07-01-S103-eve-linear-readback-logging.md

## Objective

Add a real server-side read-back path for the Eve Project Intelligence
maintainer's Linear delivery so one live cron run proves the created Linear
Agent Session id and the final delivered Agent Activity payload.

## Scope Checklist

- [x] Existing live-delivery proof task and blocker reviewed.
- [x] Installed Eve Linear channel docs and runtime types reviewed.
- [x] Dedicated Linear sub-issue created for the remaining read-back scope.
- [x] Verification plan chosen: server-side structured logging plus one rerun of
      the live cron.

## Implementation Checklist

- [x] Add a shared helper for compact structured Linear delivery logs.
- [x] Log the created proactive Linear Agent Session id from the schedule path.
- [x] Log final Linear response activity creation with the created activity id.
- [x] Log a read-back snapshot of recent Linear Agent Activities after final
      response delivery.
- [x] Keep logs compact and secret-safe.

## Verification Checklist

- [x] Eve package typecheck passes after the logging changes.
- [x] Eve info/eval commands still pass.
- [x] Prebuilt deploy succeeds with the updated runtime.
- [x] One live cron rerun succeeds.
- [x] Vercel runtime logs show the created Linear Agent Session id.
- [x] Vercel runtime logs show the final Linear activity payload and read-back
      activity ids or the exact provider failure.

## Acceptance Criteria

- The runtime emits durable, structured evidence for proactive Linear delivery.
- The evidence includes the actual Linear Agent Session id used for the run.
- The evidence includes the final response payload and the resulting activity id
  or an exact failure.
- One rerun of the live cron captures the proof in deployed runtime logs.

## Files To Change

- `agents/project-intelligence-maintainer/agent/channels/linear.ts`
- `agents/project-intelligence-maintainer/agent/schedules/weekday-maintainer-scan.ts`
- `agents/project-intelligence-maintainer/agent/lib/linear-delivery-log.ts`
- `docs/ops/tasks/2026-07-01-eve-linear-readback-logging.md`
- `docs/ops/handoffs/2026-07-01-S103-eve-linear-readback-logging.md`
- `docs/ops/orchestration/session-board.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Eve Linear docs | `agents/project-intelligence-maintainer/node_modules/eve/docs/channels/linear.mdx` | Pass | Confirms `createActivity`, `listActivities`, `updateSession`, and event overrides. |
| Eve runtime session type | `agents/project-intelligence-maintainer/node_modules/eve/dist/src/channel/session.d.ts` | Pass | Confirms cross-channel `receive(...)` returns a `Session` with `continuationToken` and `getEventStream()`. |
| Eve proactive Linear receive | `agents/project-intelligence-maintainer/node_modules/eve/dist/src/public/channels/linear/linearChannel.js` | Pass | Confirms proactive Linear session ids are encoded in `continuationToken` as `agent-session:<id>`. |
| Tracking | Linear AAI-847 | Pass | Sub-issue created and moved to `In Progress`. |
| Package typecheck | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run typecheck` | Pass | Logging changes compile cleanly. |
| Package evals | `PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run eval` | Pass | 5/5 evals and 14/14 gates pass after read-back changes. |
| Deployment | `vercel deploy --prebuilt --prod --yes` | Pass | Final ready deployment `dpl_FPQEAVhjn7GRHtfwwXHhzPzhAzBp` aliased to production after Eve bundle patching and Linear OAuth app updates. |
| Live cron rerun | `vercel crons run /eve/v1/cron/CPpIQyc1wUCHnnmePfAM1YmM7X3APXTWoNwat1BCHVI` | Pass | Triggered at `2026-07-01T16:42:06.291Z`. |
| Runtime log proof | Vercel runtime logs for `dpl_FPQEAVhjn7GRHtfwwXHhzPzhAzBp` | Pass | Logs capture `proactive-session-created`, `eve-session-readback`, `linear-activity-readback`, and `final-response-delivered` for agent session `ab126816-4c3a-4b6e-99c6-7dc1fc091f68`. |

## Risks / Gaps

- Runtime log proof is only as strong as the deployed Vercel log retention for
  this service; capture exact timestamps and payload summaries in the handoff.
- The maintainer still runs with `EVE_PROJECT_INTELLIGENCE_MOCK_MODEL=true` for
  this delivery proof, so the content is deterministic and delivery-focused.
- Teams remains intentionally unconfigured and fail-loud.
- The current Linear app-actor token comes from the OAuth app's
  `client_credentials` grant and expires in 30 days; production needs a token
  rotation owner or automated refresh path before that window closes.

## Final Status

- [x] All checklist items are complete or explicitly deferred.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next
      steps.
