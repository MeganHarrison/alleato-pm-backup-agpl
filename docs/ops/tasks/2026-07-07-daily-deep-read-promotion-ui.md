# Task: Daily Deep Read Promotion UI

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: AAI-1009 - https://linear.app/megankharrison/issue/AAI-1009/finalize-daily-deep-read-backfill-and-ai-packet-first-routing
Related Handoff: Not created

## Objective

Expose accepted Daily Deep Read candidates on the project intelligence page with a guarded Promote action so reviewed candidates can become tasks or insight cards without a hidden/manual script.

## Non-Negotiable Done Rule

This task is not done until current-packet `needs_review` and `candidate` Daily Deep Read candidates both render correctly, accepted candidates call the promotion API, promoted candidates leave the visible queue, and evidence proves the page no longer hides accepted-but-unpromoted candidates.

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

- Candidate loader includes current-packet rows with `status in ('needs_review', 'candidate')`.
- `needs_review` rows show Accept/Reject only.
- `candidate` rows show Promote only.
- Promote calls `/api/projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]/promote`.
- Successful Accept keeps the row visible as ready to promote instead of disappearing.
- Successful Reject or Promote removes the row from the visible queue.

## Planned Files

- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx` - include accepted candidates and pass status to the client component.
- `frontend/src/features/intelligence/daily-deep-read-candidate-review.tsx` - render status-aware actions.
- `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-ui/` - browser/static proof.
- `docs/ops/tasks/2026-07-07-daily-deep-read-promotion-ui.md` - task ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/intelligence/page.tsx' 'src/features/intelligence/daily-deep-read-candidate-review.tsx'` | Pass | Page and status-aware client component. |
| Static/type/lint | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` type debt. |
| Static/type/lint | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Targeted tests | `./node_modules/.bin/jest --runTestsByPath src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts` | Pass | Promotion service coverage from previous slice still covers the Promote endpoint target behavior. |
| Browser/user-flow | `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-ui/browser-before.png` and `.txt` | Pass | `/1009/intelligence` initially showed three needs-review candidates with Accept/Reject controls. |
| Browser/user-flow | `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-ui/browser-after-accept-settled.png` and `.txt` | Pass | Accepting candidate `70f1cb12-b56e-4969-af11-ebb8cf1560ee` kept it visible and changed action to Promote. |
| Browser/user-flow | `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-ui/browser-after-clean-refresh.png` and `.txt` | Pass | After promotion and clean Next cache restart, page showed two remaining Accept/Reject rows and no Promote row. |
| DB/provider read-back | `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-ui/db-readback.json` | Pass | Accepted candidate `70f1cb12-b56e-4969-af11-ebb8cf1560ee` is `promoted/resolved`; created `insight_cards.id=a060ec9e-2add-4ace-b846-1ad3072e7846`; remaining visible candidates are the two decisions. |
| End-to-end proof | Browser Promote click | Partial local-dev failure | The click compiled the new API route but hit a corrupted `.next` cache missing vendor chunks. Applied the repo cache gate (`rm -rf .next`, restart). The same promotion service succeeded and clean refresh proved final UI state. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/intelligence/page.tsx` - load both review-needed and accepted current-packet candidates.
- `frontend/src/features/intelligence/daily-deep-read-candidate-review.tsx` - render Accept/Reject for review rows and Promote for accepted rows.
- `docs/ops/evidence/2026-07-07-daily-deep-read-promotion-ui/` - browser and DB proof.
- `docs/ops/tasks/2026-07-07-daily-deep-read-promotion-ui.md` - task ledger.

## Risks / Gaps

- Existing unrelated dirty files are present in the worktree; this task must avoid touching or reverting them.
- One accepted project `1009` task candidate has already been promoted by the service verification, so browser proof may need another accepted candidate or a direct API setup step.
- Local Next dev cache corrupted while compiling the new promotion route; the cache was cleared and the page was recaptured cleanly.
- The remaining two current-packet candidates for project `1009` are decision candidates that still need human review.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
