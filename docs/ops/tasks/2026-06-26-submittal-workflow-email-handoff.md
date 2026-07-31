# Task: Submittal Workflow Email Handoff

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Objective

Send an email notification to the next workflow responder when a submittal workflow response advances ball-in-court, using the existing transactional email infrastructure.

## Done Checklist

- [x] Existing submittal distribution email path reviewed.
- [x] Recipient identity source chosen: `user_profiles.id = responder_id`.
- [x] Workflow handoff email component added or reused cleanly.
- [x] Shared workflow response service attempts email only when next responder has an email.
- [x] Email delivery status is returned in the workflow response result.
- [x] Email failures are written to `submittal_history`.
- [x] Focused tests/static checks pass.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Focused lint | `cd frontend && npx eslint --quiet src/lib/submittals/workflow-response-service.ts src/lib/submittals/__tests__/workflow-response-service.test.ts src/emails/submittals/SubmittalWorkflowHandoffNotification.tsx` | PASS | Service, test, and email component lint clean. |
| Focused service/API tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/submittals/__tests__/workflow-response-service.test.ts 'src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response/__tests__/route.test.ts'` | PASS | 2 suites, 8 tests passed. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 2 changed routes passed structured error handling guard. |
| Live service proof without external email | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... temporary workflow + injected emailSender ... EOF` | PASS | Real DB workflow returned `email.status = sent`, id `mock-email-live-proof`, with recipient `cgillespie@alleatogroup.com`; no external email was sent. |
| Fixture cleanup proof | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... cleanup verification ... EOF` | PASS | No proof responses or notifications remain; fixture restored to `Open` with expected ball-in-court. |

## Risks / Gaps

- No real external email was sent during verification; live proof used dependency injection to prove the service would call the sender with the correct recipient, subject, idempotency key, and metadata.
- Existing unrelated unstaged checkout dirt remains outside this task and is not owned by this work.
