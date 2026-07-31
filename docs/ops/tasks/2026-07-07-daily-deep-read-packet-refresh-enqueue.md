# Task: Daily Deep Read Packet Refresh Enqueue

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1009 - https://linear.app/megankharrison/issue/AAI-1009/finalize-daily-deep-read-backfill-and-ai-packet-first-routing

## Objective

Ensure Daily Deep Read promotions enqueue the existing project intelligence packet refresh job so promoted cards/tasks can flow into the current project intelligence packet.

## Done Rule

Promotion is not complete unless it creates the task/card, marks the candidate promoted, and queues or updates a `packet_refresh_jobs` row for the promoted target through the existing RAG queue.

## Checklist

- [x] Existing packet refresh queue ownership verified.
- [x] Promotion writer enqueues or updates an active packet refresh job.
- [x] Tests cover packet refresh enqueue and dedupe behavior.
- [x] Static checks and route guards pass.
- [x] Task-owned files only are committed.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Targeted tests | `./node_modules/.bin/jest --runTestsByPath src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts` | Pass | 6 tests including packet refresh insert and active-job dedupe. |
| Static/type/lint | `./node_modules/.bin/eslint 'src/lib/daily-briefs/daily-deep-read-promotion.ts' 'src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts'` | Pass | Promotion writer and tests. |
| Static/type/lint | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` type debt. |
| Route guard | `npm run check:routes` | Pass | No route conflicts. |
| Secret scan | `rg -n "eyJ...|sk-proj-|sk-live-|sk-ant-|auth-token|SUPABASE_SERVICE_ROLE|RAG_SUPABASE_SERVICE_ROLE" ...` | Pass | No credential-like matches. |
| DB/provider read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-packet-refresh-enqueue.json` | Pass | Live promoted card `988cf9e2-84a0-4fca-82f3-bd130b4d23d0` has queued packet refresh job `6728a0b6-1794-4522-b4f9-688ac1f1be04`. |

## Risks / Gaps

- Existing unrelated dirty files are present in the worktree and must stay out of this commit.
- This only queues refresh; the existing intelligence compiler drain remains responsible for compiling packets.
- Live RAG queue evidence showed existing successful `packet_refresh_jobs` use `compiler_version='ai_intelligence_compiler_v0_1'`; the promotion writer matches that drain version.

## Final Status

- [x] Complete
