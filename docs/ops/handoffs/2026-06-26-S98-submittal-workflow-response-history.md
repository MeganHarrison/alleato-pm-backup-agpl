# Handoff: Submittal Workflow Response History

Status: Complete
Owner: Codex S98
Task: /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-26-submittal-workflow-response-history.md
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Scope

Persist `submittal_history` entries for shared workflow responses, including
AI Review workflow responses.

## Changed Files

- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/workflow-response-service.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/__tests__/workflow-response-service.test.ts`

## Command Evidence

| Command / artifact | Result | Notes |
| ------------------ | ------ | ----- |
| `cd frontend && npx eslint --quiet src/lib/submittals/workflow-response-service.ts src/lib/submittals/__tests__/workflow-response-service.test.ts` | PASS | Touched service/test files lint clean. |
| `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/submittals/__tests__/workflow-response-service.test.ts 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/__tests__/route.test.ts'` | PASS | 2 suites, 4 tests passed. |
| `npm run check:routes` | PASS | No dynamic route conflicts found. |
| `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 2 changed routes passed. |
| Live DB history proof | PASS | History row `0dc8fb5b-75e8-40aa-9c65-c5d3f04a7704` persisted with matching response id and `source: ai_review`. |
| Fixture restore | PASS | Synthetic submittal reopened with pending `AI Review Manual Check` response `9a719db4-e656-45ea-9430-2fb6e671a883`. |

## Risks

- External email notification remains separate from in-app decision history.
- Unrelated staged and unstaged checkout dirt exists outside this task and was not modified.

## Next Step

Recommended next step: implement external notification/email for workflow
responses using the existing submittal email settings.
