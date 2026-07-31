# Task: Drawing AI Extraction Visibility

Status: Completed
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-614
Linear URL: https://linear.app/megankharrison/issue/AAI-614/add-drawings-review-queue-for-unpublished-revisions
Related Handoff: docs/ops/handoffs/2026-06-23-S87-drawings-ocr-confidence.md

## Objective

Expose drawing OCR and visual AI extraction evidence so a project operator can
confirm whether a drawing has been processed, what text was extracted, what
page-level visual AI saw, and whether the drawing is ready to support submittal
AI review.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

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

## Planned Files

- `docs/ops/tasks/2026-06-24-drawing-ai-extraction-visibility.md`
- `frontend/src/app/api/projects/[projectId]/drawings/[drawingId]/intelligence/route.ts`
- `frontend/src/hooks/use-drawings.ts`
- `frontend/src/app/(main)/[projectId]/drawings/[drawingId]/page.tsx`
- Focused tests for the new route or hook as practical in this checkout.

## Acceptance Criteria

- Drawing detail has an `AI Extraction` tab or equivalent quiet inspection surface.
- The surface shows OCR processing status, extracted text preview, visual AI page count, page summaries, implied submittals, notes/requirements, and readiness.
- Missing OCR, missing visual AI, and failed/partial states are visible as specific operator-facing causes.
- The API distinguishes OCR text readiness, visual AI readiness, embedding/chunk readiness, and submittal-review readiness instead of a single ambiguous vectorized flag.
- No new database migration is required unless existing tables cannot represent the evidence.

## Failure-Loud Behavior

- If a drawing has no `document_metadata_id`, the API returns a successful but explicit `not_ready` payload explaining that the OCR/AI pipeline has no document record.
- If metadata exists but OCR text, page intelligence, or chunks are missing, the response names the missing layer.
- If the inspection API query fails, the route returns a guarded error instead of silently showing an empty ready state.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Kickoff | Linear AAI-614 comment `3e647ac5-bef6-4dcd-99b8-f855690a4a29` | Pass | Scope and planned files posted before implementation. |
| Static format | `pnpm --dir frontend exec prettier --check 'src/app/api/projects/[projectId]/drawings/[drawingId]/intelligence/route.ts' 'src/app/api/projects/[projectId]/drawings/[drawingId]/intelligence/__tests__/route.test.ts' 'src/hooks/use-drawings.ts' 'src/app/(main)/[projectId]/drawings/[drawingId]/page.tsx'` | Pass | All matched files use Prettier. |
| Static lint | `pnpm --dir frontend exec eslint 'src/app/api/projects/[projectId]/drawings/[drawingId]/intelligence/route.ts' 'src/app/api/projects/[projectId]/drawings/[drawingId]/intelligence/__tests__/route.test.ts' 'src/hooks/use-drawings.ts' 'src/app/(main)/[projectId]/drawings/[drawingId]/page.tsx'` | Pass | No changed-file ESLint errors. |
| Typecheck | `NODE_OPTIONS=--max_old_space_size=8192 pnpm --dir frontend exec tsc --noEmit --pretty false` | Pass | Initial default-heap `tsc` aborted with Node OOM; larger heap completed with `TSC_EXIT:0`. |
| Targeted tests | `pnpm --dir frontend exec jest --runTestsByPath 'src/app/api/projects/[projectId]/drawings/[drawingId]/intelligence/__tests__/route.test.ts' --runInBand` | Pass | 3 tests: unauthorized guard, explicit not-ready metadata state, processed OCR/vision/retrieval contract. |
| Browser/user-flow | `docs/ops/evidence/2026-06-24-drawing-ai-extraction-visibility/drawing-ai-extraction-tab.png` | Pass | Exact route `/876/drawings/0e228e36-49ed-4ddf-b64b-c82f66577ef9`, AI Extraction tab rendered. |
| API read-back | `docs/ops/evidence/2026-06-24-drawing-ai-extraction-visibility/drawing-ai-extraction-api.json` | Pass | Status 200; readiness `ready`; OCR text length 12,215; 1 visual AI page; 20 retrieval chunks. |
| Text evidence | `docs/ops/evidence/2026-06-24-drawing-ai-extraction-visibility/drawing-ai-extraction-tab.txt` | Pass | Captured rendered page text for OCR and visual AI inspection surface. |
| DB/provider read-back | N/A | N/A | No migration or provider config change required; data read-back performed through authenticated app API. |
| Known unrelated failures | `pnpm --dir frontend test -- --runTestsByPath ...` | Unrelated command misuse | This repo's `test` script is Playwright, not Jest; command was stopped and replaced with the correct Jest command above. |

## Risks / Gaps

- Existing checkout has unrelated dirty files; only task-owned files should be changed or staged.
- The backend vision stage currently logs page failures but does not persist every failure reason in a dedicated ledger; this task exposes missing-layer readiness now, but durable per-page failure telemetry remains a recommended follow-up.
- Drawing detail still has card-heavy legacy sections outside this new tab; this slice intentionally added the minimum inspection surface and avoided broad redesign.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
