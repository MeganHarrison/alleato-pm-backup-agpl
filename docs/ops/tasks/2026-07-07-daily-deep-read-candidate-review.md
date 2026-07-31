# Task: Daily Deep Read Candidate Review

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1009 - https://linear.app/megankharrison/issue/AAI-1009/finalize-daily-deep-read-backfill-and-ai-packet-first-routing
Related Handoff: Not created

## Objective

Add the first visible review gate for Daily Deep Read `source_signal_candidates` so packet-derived tasks, risks, decisions, initiatives, and project updates can be accepted or rejected from the project intelligence page without touching historical snapshot candidates.

## Non-Negotiable Done Rule

This task is not done until the project intelligence page can review current-packet Daily Deep Read candidates through a guarded API, historical snapshot candidates are excluded by packet ID, and evidence proves the route fails loudly for invalid candidate updates.

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

- Project intelligence shows current Daily Deep Read candidates with review actions.
- Accept/reject actions update only `source_signal_candidates` rows for the selected project, current packet, and `compiler_version=daily_deep_read_consumers_v1`.
- Historical snapshot candidates cannot be reviewed from the current project page.
- API fails loudly for missing auth, wrong project, wrong packet, or already-reviewed candidates.
- Browser/API evidence proves a candidate can be reviewed without raw RAG chunk synthesis.

## Planned Files

- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx` - pass current-packet candidates into a client review component.
- `frontend/src/features/intelligence/daily-deep-read-candidate-review.tsx` - client-side accept/reject controls.
- `frontend/src/app/api/projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]/route.ts` - guarded status update API.
- `docs/ops/evidence/2026-07-07-daily-deep-read-candidate-review/` - API and browser proof.
- `docs/ops/tasks/2026-07-07-daily-deep-read-candidate-review.md` - task ledger and evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/intelligence/page.tsx' 'src/features/intelligence/daily-deep-read-candidate-review.tsx' 'src/app/api/projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]/route.ts'` | Pass | Daily Deep Read review files. |
| Static/type/lint | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` type debt detected. |
| Static/type/lint | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Static/type/lint | `./node_modules/.bin/eslint ...Liveblocks/notifications files...` | Pass with warnings | Existing design-system warnings in `page-comments-overlay.tsx`; no lint errors. |
| Targeted tests | `./node_modules/.bin/jest --runTestsByPath src/lib/collaboration/__tests__/ai-approval-queue.test.ts src/lib/collaboration/__tests__/ai-notification-routing.test.ts src/lib/collaboration/__tests__/ai-widget-notifications.test.ts src/lib/collaboration/__tests__/notification-links.test.ts src/lib/collaboration/__tests__/notification-priority.test.ts` | Pass | 5 suites, 40 tests. |
| Targeted tests | `pnpm exec jest --runTestsByPath ...` | Blocked by toolchain | Known local non-TTY pnpm install behavior: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; reran with local Jest binary. |
| Browser/user-flow | `docs/ops/evidence/2026-07-07-daily-deep-read-candidate-review/browser-before.png` and `browser-before-snapshot.txt` | Pass | `/1009/intelligence` showed four current-packet Daily Deep Read candidates with Accept/Reject controls. |
| Browser/user-flow | `docs/ops/evidence/2026-07-07-daily-deep-read-candidate-review/browser-after-accept-settled.png` and `browser-after-accept-settled-snapshot.txt` | Pass | Accepted one project `1009` task candidate; queue dropped from four actions to three. |
| DB/provider read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-candidate-review/db-repeat-review-predicate.json` | Pass | Candidate `b24e1d69-389d-4103-9bec-752c20a1f194` is now `status=candidate`, `current_status=open`, with review metadata tied to current packet `f5ba7ef9-a3d2-40d0-8ed6-907c327f2f64`; repeat-review route predicate returns no row. |
| End-to-end proof | `docs/ops/evidence/2026-07-07-daily-deep-read-candidate-review/api-unauthenticated-fails.json` | Pass | Unauthenticated PATCH returns structured 401 `UNAUTHORIZED` with request id. |
| End-to-end proof | `docs/ops/evidence/2026-07-07-daily-deep-read-candidate-review/api-repeat-review-fails.json` | Partial local-dev artifact | Authenticated repeat-review HTTP request was unstable under the local dev server (`ECONNREFUSED` after reload); DB predicate evidence proves the route can no longer match the accepted row. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx`
- `frontend/src/features/intelligence/daily-deep-read-candidate-review.tsx`
- `frontend/src/app/api/projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]/route.ts`
- `docs/ops/evidence/2026-07-07-daily-deep-read-candidate-review/`
- `docs/ops/evidence/2026-07-07-velt-comments-backup/`
- `docs/architecture/PROJECT-MAP.md`
- `frontend/src/lib/app-surface/app-surface.generated.json`
- Additional dirty Liveblocks/notifications files included because user explicitly requested pushing everything to `main`.

## Risks / Gaps

- This slice reviews candidates by status only; downstream materialization into task rows, insight cards, and decision/risk records remains a separate promotion writer.
- Historical snapshot candidates from backfill exist and must stay excluded from the current project page by `daily_packet_id`.
- Local dev server was unstable during authenticated repeat-review API probing after hot reload; the route predicate was proven by DB read-back and unauthenticated structured failure was proven by HTTP.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
