# Task: Submittal Workflow Required Contract Cleanup

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-421 - https://linear.app/megankharrison/issue/AAI-421/ai-submittal-drawing-review

## Objective

Remove the stale `required` field from active submittal workflow step creation because the live `submittal_workflow_steps` table does not have that column and the workflow engine treats every pending response as required.

## Done Checklist

- [x] Live schema drift reproduced and traced.
- [x] Generated Supabase types checked for `submittal_workflow_steps.required`.
- [x] Active workflow step UI no longer shows an unenforced Required checkbox.
- [x] Active workflow API/input types no longer accept or forward `required`.
- [x] Workflow template compatibility remains tolerant of older JSON with `required`.
- [x] Focused tests/static checks pass.
- [x] Live DB proof confirms workflow step creation works without the stale column.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Drift reproduction | Live Supabase insert with `required` in `submittal_workflow_steps` | FAIL as expected | Remote schema returned `PGRST204`: missing `required` column. |
| Focused lint | `cd frontend && npx eslint --quiet src/hooks/use-submittals.ts src/features/submittals/submittal-detail-client.tsx src/features/submittals/submittal-form-page.tsx src/lib/submittals/create-workflow.ts src/lib/submittals/__tests__/create-workflow.test.ts 'src/app/api/projects/[projectId]/submittals/route.ts' 'src/app/api/projects/[projectId]/submittals/[submittalId]/route.ts' 'src/app/api/projects/[projectId]/submittals/[submittalId]/workflow-steps/route.ts'` | PASS | Touched workflow contract files lint clean. |
| Focused helper tests | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/lib/submittals/__tests__/create-workflow.test.ts` | PASS | 1 suite, 3 tests passed. |
| Changed type guard | `cd frontend && npm run typecheck:changed` | PASS | No new `any` type debt detected. |
| Route conflict guard | `npm run check:routes` | PASS | No dynamic route conflicts found. |
| Changed route guard | `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | PASS | 5 changed routes passed structured error handling guard. |
| Live DB proof | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... insert workflow step without required and pending response ... EOF` | PASS | Created temporary step `28056ba4-4c10-4c9b-b3af-1915018dd593` and response `5c040843-759e-4c15-952a-a932cb8a7461` without the stale column. |
| Fixture cleanup proof | `set -a; source .env; source frontend/.env.local; set +a; cd frontend && node --require tsx/cjs <<'EOF' ... verify cleanup ... EOF` | PASS | No proof responses remain; fixture restored to `Open` with expected ball-in-court. |

## Risks / Gaps

- If optional workflow responses are needed later, they require a real product design and migration. This cleanup does not add optional-response semantics.
- Existing unrelated unstaged checkout dirt remains outside this task and is not owned by this work.
