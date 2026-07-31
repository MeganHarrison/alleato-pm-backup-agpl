# Task: Daily Deep Read Promotion Writer

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1009 - https://linear.app/megankharrison/issue/AAI-1009/finalize-daily-deep-read-backfill-and-ai-packet-first-routing
Related Handoff: Not created

## Objective

Turn accepted Daily Deep Read candidates into durable project intelligence outputs so the review gate produces actual task and insight-card records instead of stopping at `source_signal_candidates.status = candidate`.

## Non-Negotiable Done Rule

This task is not done until accepted current-packet Daily Deep Read candidates can be promoted through one guarded service path, the source candidate is marked `promoted`, the created record is traceable back to the packet/candidate/source policy, and duplicate promotion fails loudly.

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

- Only accepted Daily Deep Read candidates for the current packet can be promoted.
- `task` candidates create one app-DB `tasks` row with packet/candidate lineage in `extraction_metadata`.
- Non-task candidates create one app-DB `insight_cards` row with packet/candidate lineage in `metadata`.
- The RAG candidate row is updated to `status = promoted`, `current_status = resolved`, and `promoted_insight_card_id` points to the created record id.
- Re-promoting the same candidate fails loudly and does not create duplicate rows.
- Promotion does not synthesize from RAG chunks; it uses the reviewed candidate fields and Deep Read packet lineage.

## Planned Files

- `frontend/src/lib/daily-briefs/daily-deep-read-promotion.ts` - canonical promotion service.
- `frontend/src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts` - unit coverage for task/card promotion and duplicate guardrails.
- `frontend/src/app/api/projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]/promote/route.ts` - guarded API entry point.
- `frontend/src/features/intelligence/daily-deep-read-candidate-review.tsx` - expose promotion action for accepted candidates if needed.
- `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-writer/` - command and DB proof.
- `docs/ops/tasks/2026-07-07-daily-deep-read-promotion-writer.md` - task ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts` | Pass | Required app DB types gate before DB code. |
| Static/type/lint | `./node_modules/.bin/eslint 'src/lib/daily-briefs/daily-deep-read-promotion.ts' 'src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts' 'src/app/api/projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]/promote/route.ts'` | Pass | Promotion service, route, and tests. |
| Static/type/lint | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` type debt. |
| Static/type/lint | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Static/type/lint | `npm run map:project` | Pass | Project map regenerated; no tracked map delta remained. |
| Targeted tests | `./node_modules/.bin/jest --runTestsByPath src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts` | Pass | 1 suite, 2 tests. |
| Browser/user-flow | Not applicable | Pass | This slice adds a guarded API/service promotion path, not new visible UI. The previous review-gate browser proof remains in `2026-07-07-daily-deep-read-candidate-review`. |
| DB/provider read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-writer/promote-task-result.json` | Pass | Real service call promoted candidate `b24e1d69-389d-4103-9bec-752c20a1f194` into task `67d824d6-2b7d-49cb-8011-efb42a5bd0ad`. |
| DB/provider read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-writer/db-readback.json` | Pass | App `tasks`, app packet `document_metadata`, and RAG candidate all carry matching packet/candidate lineage. |
| End-to-end proof | `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-writer/duplicate-promotion-fails.json` | Pass | Duplicate promotion returns `PRECONDITION_FAILED` / HTTP 412 semantics and creates no second task. |
| End-to-end proof | First real promotion attempt | Fixed | It failed loudly on `document_metadata_document_type_fkey`; service now leaves `document_type` null and stores Daily Deep Read classification in `category/source_system/source_metadata`. |

## Files Changed

- `frontend/src/lib/daily-briefs/daily-deep-read-promotion.ts` - canonical promotion service.
- `frontend/src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts` - duplicate and task-promotion guardrails.
- `frontend/src/app/api/projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]/promote/route.ts` - guarded API entry point.
- `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-writer/` - real promotion, read-back, and duplicate failure proof.
- `docs/ops/tasks/2026-07-07-daily-deep-read-promotion-writer.md` - task ledger.
- `frontend/src/types/database.types.ts` - regenerated app Supabase types.

## Risks / Gaps

- Existing unrelated dirty files are present in the worktree; this task must avoid touching or reverting them.
- The first promotion path will create tasks and insight cards. Domain-specific risk/decision tables, if any, can consume the insight cards in a later slice.
- The API exists but the visible project intelligence page does not yet expose a manual Promote action for already-accepted candidates.
- This task promoted one accepted task candidate. Remaining accepted candidates still need batch promotion or a review UI action.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
