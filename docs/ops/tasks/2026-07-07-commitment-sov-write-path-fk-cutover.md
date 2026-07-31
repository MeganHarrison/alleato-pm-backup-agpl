# Task: Commitment SOV Write Path FK Cutover

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Move new commitment SOV writes toward the canonical `project_budget_code_id`
relationship so newly saved subcontract and purchase-order SOV rows no longer
depend only on freeform budget-code text.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before implementation.
- [x] Regenerate Supabase database types before touching database-backed code.
- [x] Update core commitment line-items API to accept and validate `project_budget_code_id`.
- [x] Update SOV import API to write `project_budget_code_id` from `budget_lines.project_budget_code_id`.
- [x] Preserve legacy budget-code display text during transition.
- [x] Avoid unrelated dirty frontend files unless required.
- [x] Record verification evidence.

## Verification Checklist

- [x] Static route/API checks run.
- [x] Targeted tests updated.
- [x] Database type expectations verified.
- [x] Remaining write paths documented.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| FK audit skill | Pass | Loaded `.claude/skills/fk-audit/SKILL.md`; this slice is a dropdown/form-to-FK write-path repair. |
| DB types preflight | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded with the existing inbucket deprecation warning. |
| Dirty worktree check | Pass | Existing checkout has unrelated dirty files; this task will use exact file scope and avoid broad cleanup. |
| PUT route tests | Pass | `cd frontend && npm run test:unit -- --runTestsByPath 'src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/__tests__/route.test.ts' --runInBand` passed: 5 tests. |
| Focused ESLint | Pass with pre-existing warnings | `cd frontend && ./node_modules/.bin/eslint ...` passed with 3 existing explicit-any warnings in the import route; changed-file debt gate confirmed no new ESLint debt. |
| Changed lint debt | Pass | `cd frontend && npm run lint:changed:debt` passed. |
| Changed type debt | Pass | `cd frontend && npm run typecheck:changed` passed. |
| Changed route guardrails | Pass | `cd frontend && npm run guardrails:changed` passed for 3 changed routes. |
| Unsafe-pattern guardrail | Pass | `cd frontend && npm run guardrails:unsafe-patterns` passed. |
| Root quality script | Blocked by unrelated package drift | `npm run quality:changed` from repo root is currently unavailable (`Missing script: "quality:changed"`), likely because root `package.json` is dirty outside this task. Ran the constituent frontend checks directly instead. |

## Final Status

- [x] Code changes complete.
- [x] Verification complete.
- [x] Remaining risks documented.

## Behavior Implemented

- `PUT /api/projects/[projectId]/commitments/[commitmentId]/line-items` now accepts `project_budget_code_id` / `projectBudgetCodeId`.
- If only legacy budget-code text is supplied, the API resolves it to exactly one active `project_budget_codes` row for the project.
- Ambiguous or unresolved legacy budget-code text now fails with a specific 400 instead of saving a fake link.
- `POST /line-items/import` now writes `project_budget_code_id` from `budget_lines.project_budget_code_id`.
- Budget import skips lines that do not have a canonical project budget code FK.

## Remaining Risks

- Other write paths still need cutover: subcontract create, purchase-order create, bulk commitment import, legacy commitment route, AI action tools, and Acumatica projection.
- The SOV UI still submits legacy display text today; the API resolves it, but the UI should be updated to send the selected `project_budget_code_id` directly.
