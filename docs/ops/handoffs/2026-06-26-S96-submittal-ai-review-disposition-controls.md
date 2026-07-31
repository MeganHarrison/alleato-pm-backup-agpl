# Handoff: Submittal AI Review Disposition Controls

Status: Complete
Owner: Codex S96
Task: /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-26-submittal-ai-review-disposition-controls.md
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Scope

Persist reviewer disposition for normalized AI review checks and expose the
action from the submittal detail AI Review panel.

## Changed Files

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-26-submittal-ai-review-disposition-controls.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-26-S96-submittal-ai-review-disposition-controls.md`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/schemas.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/submittals/ai-review/review-run-service.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/checks/[checkId]/route.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/checks/[checkId]/__tests__/route.test.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/use-submittals.ts`
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/features/submittals/submittal-ai-review-panel.tsx`

## Command Evidence

| Command / artifact | Result | Notes |
| ------------------ | ------ | ----- |
| `cd frontend && npx eslint --quiet ...touched files...` | PASS | Touched API/service/hook/panel files lint clean. |
| `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| `cd frontend && npm run test:unit -- --runInBand --runTestsByPath ...ai-review route tests...` | PASS | 2 suites, 5 tests passed. |
| `npm run check:routes` | PASS | No dynamic route conflicts found. |
| `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS/LIMITED | Reported no changed API routes because the new route is untracked; route tests cover handler behavior. |
| `/Users/meganharrison/Documents/alleato-pm/frontend/tests/agent-browser-runs/2026-06-26-submittal-ai-review-disposition-controls/accepted-finding.png` | PASS | Browser exact-route proof: finish conflict disposition control changed to `Accepted`. |
| `cd frontend && node --require tsx/cjs <<'EOF' ... getLatestReview(...) ... EOF` | PASS | DB-backed read-back returned `reviewerDisposition: accepted` for check `4b65ef24-29d4-4bce-b7dc-91a5b0f2ecce`. |

## Risks

- Approval/revision workflow transitions remain separate from per-finding review disposition.
- Unrelated checkout dirt exists outside this task and was not modified.

## Next Step

Recommended next step: implement final reviewer workflow actions that turn the accepted/dismissed/edited finding decisions into submittal status transitions and response history.
