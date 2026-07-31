# Task: Executive Brief Weekday Schedule

Status: Complete
Owner: Codex S142
Created: 2026-07-14
Task ID: AAI-1065
Linear Issue: AAI-1065 — https://linear.app/megankharrison/issue/AAI-1065/schedule-canonical-executive-daily-brief-generation-at-600-am-et
Related Handoff: `docs/ops/handoffs/2026-07-14-S142-executive-brief-weekday-schedule.md`

## Objective

Generate the canonical Daily Executive Brief automatically at 6:00 AM
America/New_York every weekday and prove the live scheduler and packet ledger.

## Scope

- Own the Render cron definition, scheduled compiler wrapper, container runtime,
  focused tests/verifier, and live Render configuration for this workflow.
- Preserve `intelligence_packets` / `daily-executive-brief` as the only generated
  artifact source of truth.
- Exclude Teams delivery; this task generates the packet and does not re-enable
  the separately gated outbound delivery path.

## Source of Truth

- Canonical runtime/data owner: Render cron plus
  `public.intelligence_packets` target slug `daily-executive-brief`.
- Existing shared primitives/services:
  `scripts/intelligence/daily-executive-brief.mjs`,
  `scripts/verify/app-db-connection.mjs`, and
  `backend/Dockerfile.executive-brief`.
- Deprecated or parallel paths: retired morning/evening delivery crons and
  legacy `fresh=true` / `daily_recaps` generation.

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.
- [x] One Render cron targets 6:00 AM ET on Monday-Friday across EDT and EST.
- [x] Monday generation covers Friday rather than Sunday.
- [x] Duplicate scheduler invocations cannot create duplicate packets.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

Owned implementation paths:

- `render.yaml`
- `backend/Dockerfile.executive-brief`
- `scripts/intelligence/daily-executive-brief.mjs`
- `scripts/intelligence/daily-executive-brief-schedule.mjs`
- `scripts/intelligence/run-scheduled-daily-executive-brief.mjs`
- `scripts/intelligence/__tests__/run-scheduled-daily-executive-brief.test.mjs`
- `scripts/verify/verify_daily_executive_brief_schedule.mjs`
- `package.json`
- task/handoff/evidence and S142 orchestration rows

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: scheduled wrapper exits non-zero with the canonical compiler
  failure; live verifier fails on missing/suspended/drifted cron or stale packet.
- Detection path: Render cron job status/logs plus
  `npm run verify:executive-daily-brief-schedule`.
- Recovery path: repair the named runtime/env/compiler failure, rerun the Render
  job, then confirm the canonical packet ledger timestamp and business date.

## Incident Learning

- Failure fingerprint: `operations.provider-runtime-drift`
- Root cause: the former morning/evening jobs were intentionally removed and
  suspended on 2026-05-18, leaving the canonical manual compiler with no active
  scheduler; the surviving runner only delivered an existing packet.
- Detection gap: no guard failed when a weekday passed without a new canonical
  brief packet.
- Prevention: one repo-owned Render cron, DST-safe local-time gate, idempotency
  guard, and live scheduler-plus-ledger verifier.
- Guardrail evidence: `node --test scripts/intelligence/__tests__/run-scheduled-daily-executive-brief.test.mjs scripts/intelligence/__tests__/daily-brief-v3.test.mjs` passed 22/22; live verifier is the remaining deployment gate.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1065 | Pass | Scope and done gate captured before implementation. |
| Root cause | `render.yaml` retired-cron comment + live packet readback | Pass | Latest pre-repair packet was generated 2026-07-10; no active canonical generation owner existed. |
| Focused tests | `node --test scripts/intelligence/__tests__/run-scheduled-daily-executive-brief.test.mjs scripts/intelligence/__tests__/daily-brief-v3.test.mjs` | Pass | 22/22 tests passed, including DST, Monday-to-Friday, and duplicate protection. |
| Live generation | Packet `0a93bcf9-8773-48cb-9bd0-e2f01601cd42` | Pass | July 13 ET window read 7 meeting/transcript, 118 email, 14 Teams, and 1 document row. |
| Consumer integration | `docs/ops/evidence/2026-07-07-daily-deep-read-consumers/2026-07-13/consumer-run-summary.json` | Pass | 17 review candidates, 15 tasks, 11 rich project updates, and 12 progress reports. |
| Browser proof | `docs/ops/evidence/2026-07-14-executive-brief-weekday-schedule/executive-july-13.png` | Pass | Production Executive page rendered the generated brief and source health. |
| Render deploy | `dep-d9asucbeo5us73dh6h4g` | Pass | Docker build/deploy is live; post-deploy cron run succeeded at 2026-07-14T05:57:40Z. |
| Live verifier | `npm run verify:executive-daily-brief-schedule -- --expect-business-date 2026-07-13` | Pass | Active cron, repo/config contract, last successful run, and canonical packet readback passed. |
| Publish | `npm run codex:finish -- --message "Schedule weekday executive brief generation" --files ...` | Pass | Implementation commit `49bb2363cc` published to `origin/main`; deployed main contains it. |
| Local Docker | `docker build -f backend/Dockerfile.executive-brief -t alleato-executive-brief:test .` | Blocked (unrelated) | Docker daemon was off; no Dockerfile evaluation occurred. Render's successful Docker deploy is the relevant runtime proof. |

## Remaining Risk

- The July 13 source window contains one document row; source health now makes
  low-volume lanes visible rather than silently implying broader coverage.
- Teams delivery remains intentionally out of scope and disabled; this task
  restores canonical packet generation only.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
