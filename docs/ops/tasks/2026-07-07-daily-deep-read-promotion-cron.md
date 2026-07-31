# Task: Daily Deep Read Promotion Cron

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1009 - https://linear.app/megankharrison/issue/AAI-1009/finalize-daily-deep-read-backfill-and-ai-packet-first-routing
Related Handoff: Not created

## Objective

Add an operational drain so accepted Daily Deep Read candidates across projects are promoted without requiring a user to visit each project intelligence page.

## Non-Negotiable Done Rule

This task is not done until the cron route is `CRON_SECRET` protected, supports Vercel Cron invocation, drains only current-packet `status='candidate'` rows, reuses the canonical promotion writer, and has targeted tests/static checks.

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
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run.
- [x] Targeted automated test run.
- [x] Route conflict/project map guard run.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- Service can discover projects with accepted current-packet candidates.
- Service drains each project through `promoteAcceptedDailyDeepReadCandidates`.
- Cron route accepts `GET` and `POST`, requires `Authorization: Bearer $CRON_SECRET`, and returns promoted/failed totals.
- `frontend/vercel.json` schedules the route.

## Planned Files

- `frontend/src/lib/daily-briefs/daily-deep-read-promotion.ts`
- `frontend/src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts`
- `frontend/src/app/api/cron/daily-deep-read-promote-accepted/route.ts`
- `frontend/vercel.json`
- `docs/ops/tasks/2026-07-07-daily-deep-read-promotion-cron.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `./node_modules/.bin/eslint 'src/lib/daily-briefs/daily-deep-read-promotion.ts' 'src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts' 'src/app/api/cron/daily-deep-read-promote-accepted/route.ts'` | Pass | Drain service, route, and tests. |
| Static/type/lint | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` type debt. |
| Route guard | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Project map | `npm run map:project` | Pass | Regenerated `docs/architecture/PROJECT-MAP.md` and app surface inventory for the new cron route. |
| Targeted tests | `./node_modules/.bin/jest --runTestsByPath src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts` | Pass | 5 tests including cross-project drain. |
| Secret scan | `rg -n "eyJ...|sk-proj-|sk-live-|sk-ant-|auth-token|SUPABASE_SERVICE_ROLE|RAG_SUPABASE_SERVICE_ROLE" ...` | Pass | No credential-like matches in task-owned files. |

## Risks / Gaps

- The cron does not auto-accept AI candidates. Human review remains the gate.
- Existing unrelated dirty files are present in the worktree and must stay out of this commit.
- The route relies on `CRON_SECRET`, matching existing Vercel cron routes. If that env is missing, the route fails closed with 401.
- This promotes accepted candidates only; packet refresh remains owned by the existing intelligence packet refresh queue/compiler.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
