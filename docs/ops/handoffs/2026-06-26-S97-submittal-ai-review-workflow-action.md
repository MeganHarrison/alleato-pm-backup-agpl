# Handoff: Submittal AI Review Workflow Action

Status: Blocked/Deferred
Owner: Codex S97
Task: /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-26-submittal-ai-review-workflow-action.md
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Scope

Add an AI Review tab action that records an assigned reviewer workflow response
through the existing submittal workflow model.

## Changed Files

- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/workflow-response-service.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/route.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/__tests__/route.test.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond/route.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/use-submittals.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/features/submittals/submittal-ai-review-panel.tsx`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/features/submittals/submittal-detail-client.tsx`

## Command Evidence

| Command / artifact | Result | Notes |
| ------------------ | ------ | ----- |
| `cd frontend && npx eslint --quiet ...touched files...` | PASS | Touched workflow action files lint clean. |
| `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| `cd frontend && npm run test:unit -- --runInBand --runTestsByPath ...workflow-response... ...checks...` | PASS | 2 suites, 4 tests passed. |
| `npm run check:routes` | PASS | No dynamic route conflicts found. |
| `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 3 changed routes passed. |
| Live DB workflow proof | PASS | Shared writer persisted `Revise and Resubmit` response `d88f16a7-69c8-4e95-897a-31dd1567d0e5` and auto-closed the submittal. |
| Fixture restore | PASS | Added pending `AI Review Follow-up` response `ed04b6f8-2240-46a9-a508-531e1ac50f59` for manual inspection. |
| Browser proof | BLOCKED | Browser restart cleared auth; saved profile points to `localhost:3000`, not running `localhost:3001`. |

## Risks

- External distribution/notification remains separate from the in-app workflow response.
- Browser proof remains deferred until an authenticated `localhost:3001` browser session or saved auth profile is available.

## Next Step

Recommended next step: restore an authenticated browser session and verify the
AI Review tab shows the pending `AI Review Follow-up` workflow action, then
record the response through the UI.
