# Task: Daily Deep Read Batch Promotion

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1009 - https://linear.app/megankharrison/issue/AAI-1009/finalize-daily-deep-read-backfill-and-ai-packet-first-routing
Related Handoff: Not created

## Objective

Make accepted Daily Deep Read candidates materialize reliably into project tasks and insight cards through one canonical promotion path, without requiring one manual browser click per accepted candidate.

## Non-Negotiable Done Rule

This task is not done until the batch path promotes only current-packet `status='candidate'` rows, leaves `needs_review` and rejected rows untouched, reports per-candidate failures loudly, and the project intelligence page has a low-noise action for promoting accepted candidates.

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
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- Batch service queries only `daily_deep_read_consumers_v1` candidates for the current packet, target project, and `status='candidate'`.
- Batch service reuses `promoteDailyDeepReadCandidate` for every write so single and batch promotion cannot diverge.
- API route requires project access and returns promoted and failed candidate lists.
- UI shows one `Promote accepted` action only when accepted candidates exist.
- Successful batch promotion removes promoted candidates from the visible queue and reports any failed candidates.

## Planned Files

- `frontend/src/lib/daily-briefs/daily-deep-read-promotion.ts` - add batch promotion service.
- `frontend/src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts` - cover batch promotion.
- `frontend/src/app/api/projects/[projectId]/intelligence/daily-deep-read-candidates/promote/route.ts` - guarded batch API.
- `frontend/src/features/intelligence/daily-deep-read-candidate-review.tsx` - add quiet batch action.
- `docs/ops/evidence/2026-07-07-daily-deep-read-batch-promotion/` - verification evidence.
- `docs/ops/tasks/2026-07-07-daily-deep-read-batch-promotion.md` - task ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `./node_modules/.bin/eslint 'src/lib/daily-briefs/daily-deep-read-promotion.ts' 'src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts' 'src/app/api/projects/[projectId]/intelligence/daily-deep-read-candidates/promote/route.ts' 'src/features/intelligence/daily-deep-read-candidate-review.tsx'` | Pass | Batch service, route, tests, and UI action. |
| Static/type/lint | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` type debt. |
| Static/type/lint | `npm run check:routes` | Pass | New static `promote` API route does not conflict with `[candidateId]`. |
| Targeted tests | `./node_modules/.bin/jest --runTestsByPath src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts` | Pass | 4 tests: single promotion, duplicate block, batch promote, batch partial failure. |
| Secret scan | `rg -n "eyJ...|sk-proj-|sk-live-|sk-ant-|auth-token|SUPABASE_SERVICE_ROLE|RAG_SUPABASE_SERVICE_ROLE" ...` | Pass | No credential-like matches in task-owned files/evidence. |
| Browser/user-flow | `docs/ops/evidence/2026-07-07-daily-deep-read-batch-promotion/browser-before-batch-authenticated.png` and `.txt` | Pass | Authenticated `/1009/intelligence` showed one accepted candidate and the `Promote accepted` action. |
| Browser/user-flow | `docs/ops/evidence/2026-07-07-daily-deep-read-batch-promotion/browser-after-batch-authenticated.png` and `.txt` | Pass | Clicking `Promote accepted` removed the accepted row and left the remaining needs-review row with Accept/Reject. |
| DB/provider read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-batch-promotion/db-readback.json` | Pass | Candidate `53cbff2d-4a86-4495-bcd2-87cbae8c33b4` is `promoted/resolved`; created insight card `988cf9e2-84a0-4fca-82f3-bd130b4d23d0`; remaining candidate stays unpromoted. |
| Runtime repair | Direct Supabase update for `insight_cards.id=988cf9e2-84a0-4fca-82f3-bd130b4d23d0` | Pass | Verification exposed citation noise in promoted title; writer now strips it and the live card was repaired to the cleaned title. |
| Auth setup | `PLAYWRIGHT_BASE_URL=http://localhost:3001 ./node_modules/.bin/playwright test tests/auth.setup.ts --config=config/playwright/playwright.no-webserver.config.ts --project=chromium` | Pass | Refreshed saved auth state before agent-browser verification. |

## Files Changed

- `frontend/src/lib/daily-briefs/daily-deep-read-promotion.ts` - added accepted-candidate batch promotion and title cleanup.
- `frontend/src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts` - covered batch success, partial failure, review-row skip, and title cleanup.
- `frontend/src/app/api/projects/[projectId]/intelligence/daily-deep-read-candidates/promote/route.ts` - added guarded batch promotion API.
- `frontend/src/features/intelligence/daily-deep-read-candidate-review.tsx` - added low-noise `Promote accepted` action.
- `docs/ops/evidence/2026-07-07-daily-deep-read-batch-promotion/` - browser and DB proof.
- `docs/ops/tasks/2026-07-07-daily-deep-read-batch-promotion.md` - task ledger.

## Risks / Gaps

- Existing unrelated dirty files are present in the worktree; this task must avoid touching or reverting them.
- The action intentionally does not auto-accept `needs_review` candidates. Decisions, risks, and tasks still require review before materialization.
- One project `1009` decision candidate remains `needs_review` by design.
- Local dev auth had to be reloaded into agent-browser from `frontend/tests/.auth/user.json`; the saved auth state itself verified cleanly.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
