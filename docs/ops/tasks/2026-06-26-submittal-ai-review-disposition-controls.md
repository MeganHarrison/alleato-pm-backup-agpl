# Task: Submittal AI Review Disposition Controls

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Related Handoff: /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-26-S96-submittal-ai-review-disposition-controls.md

## Objective

Make AI submittal review findings actionable by letting a reviewer persist a
disposition on each normalized review check from the submittal detail AI Review
panel.

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

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static lint | `cd frontend && npx eslint --quiet src/features/submittals/submittal-ai-review-panel.tsx src/hooks/use-submittals.ts src/lib/submittals/ai-review/schemas.ts src/lib/submittals/ai-review/review-run-service.ts 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/checks/[checkId]/route.ts' 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/checks/[checkId]/__tests__/route.test.ts'` | PASS | Touched frontend/API files lint clean. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Targeted route tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/checks/[checkId]/__tests__/route.test.ts'` | PASS | 2 suites, 5 tests passed. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS/LIMITED | Reported no changed API routes to validate because the new route is untracked; targeted route tests cover the new handler. |
| Browser/user-flow | `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-disposition-controls/accepted-finding.png` | PASS | Exact synthetic route shows the finish conflict disposition control updated to `Accepted`. |
| DB/service read-back | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... getLatestReview(25125, '7dfbccac-6ccf-4d69-8129-7de7918c5248') ... EOF` | PASS | Normalized check `4b65ef24-29d4-4bce-b7dc-91a5b0f2ecce` persisted `reviewerDisposition: accepted`. |
| Command correction | `node --check ...route.ts`; root `npx eslint --quiet ...`; `cd frontend && npm test -- --runInBand ...` | N/A | These were invalid verification entry points: Node cannot `--check` `.ts` ESM files, root ESLint could not resolve `next/core-web-vitals`, and `frontend npm test` is Playwright rather than Jest. Corrected commands above passed. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-26-submittal-ai-review-disposition-controls.md` - working done gate.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-26-S96-submittal-ai-review-disposition-controls.md` - verification handoff.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/schemas.ts` - expose normalized check ids for reviewer actions.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/review-run-service.ts` - persist reviewer dispositions through the shared review service.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/checks/[checkId]/route.ts` - authenticated disposition update endpoint.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/use-submittals.ts` - mutation hook for reviewer disposition updates.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/features/submittals/submittal-ai-review-panel.tsx` - quiet per-check reviewer controls.

## Risks / Gaps

- This does not implement final approve/revise-and-resubmit workflow transitions yet; it only makes individual AI findings reviewer-actionable.
- Existing unrelated checkout dirt remains outside this task and is not owned by this work, including admin URL resources, AI field-guide edits, project status report edits, backend script deletions, and generated DB inventory changes.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
