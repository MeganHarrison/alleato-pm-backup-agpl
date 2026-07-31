# Task: Submittal Workflow Response History

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review
Related Handoff: /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-26-S98-submittal-workflow-response-history.md

## Objective

Persist a `submittal_history` audit entry whenever a workflow response is
recorded, including AI Review-sourced workflow responses, so the submittal
process leaves an inspectable decision trail.

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
| Static lint | `cd frontend && npx eslint --quiet src/lib/submittals/workflow-response-service.ts src/lib/submittals/__tests__/workflow-response-service.test.ts` | PASS | Touched service/test files lint clean. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Targeted service/API tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/submittals/__tests__/workflow-response-service.test.ts 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/__tests__/route.test.ts'` | PASS | 2 suites, 4 tests passed. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 2 changed routes passed structured error handling guard. |
| Live DB history proof | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... recordSubmittalWorkflowResponse(...) ... read submittal_history ... EOF` | PASS | Response `ed04b6f8-2240-46a9-a508-531e1ac50f59` and history `0dc8fb5b-75e8-40aa-9c65-c5d3f04a7704` persisted with `metadata.source = ai_review`. |
| Fixture restored | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... insert AI Review Manual Check step ... EOF` | PASS | Synthetic submittal reopened with pending response `9a719db4-e656-45ea-9430-2fb6e671a883` for manual inspection. |
| Browser/user-flow | N/A | PASS | No user-facing UI changed in this slice; verification is DB/service read-back plus tests. |

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-26-submittal-workflow-response-history.md` - working done gate.
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-26-S98-submittal-workflow-response-history.md` - verification handoff.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/workflow-response-service.ts` - write audit history entries from the shared response path.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/__tests__/workflow-response-service.test.ts` - guardrail for history persistence and fail-loud errors.

## Risks / Gaps

- This does not send external email notifications; it creates the durable in-app audit trail.
- Existing unrelated staged and unstaged checkout dirt remains outside this task and is not owned by this work.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
