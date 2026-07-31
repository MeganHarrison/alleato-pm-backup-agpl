# Task: AI Commitment SOV FK Write

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Stop the AI `createCommitment` action tool from creating subcontract or
purchase-order SOV rows with only model-provided text budget-code references.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before implementation.
- [x] Load required AI SDK guidance for AI tool work.
- [x] Load FK audit guidance for FK-backed financial writes.
- [x] Regenerate Supabase database types before touching database-backed code.
- [x] Resolve confirmed AI commitment SOV line budget codes to `project_budget_codes.id`.
- [x] Write `project_budget_code_id` on AI-created subcontract SOV rows.
- [x] Write `project_budget_code_id` on AI-created purchase-order SOV rows.
- [x] Fail before base commitment insert when a submitted budget code is ambiguous or inactive.
- [x] Add targeted unit tests.

## Verification Checklist

- [x] Targeted AI action-tool tests pass.
- [x] Focused lint/type checks pass or blockers are documented.
- [x] Task-owned diff excludes unrelated dirty worktree files.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| AI SDK skill | Pass | Loaded `/Users/meganharrison/.agents/skills/ai-sdk/SKILL.md`; no new AI SDK API introduced. |
| FK audit skill | Pass | Loaded `.claude/skills/fk-audit/SKILL.md`; this is a FK-backed financial write-path repair. |
| DB types preflight | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded with existing inbucket deprecation warning. |
| Targeted tests | Pass | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/tools/__tests__/action-tools.test.ts --runInBand` passed: 25 tests. Added a Jest `ai.tool` shim because the installed `ai@7` package is ESM-only under this Jest config. |
| Focused ESLint | Pass | `cd frontend && ./node_modules/.bin/eslint src/lib/ai/tools/action-tools.ts src/lib/ai/tools/__tests__/action-tools.test.ts` passed. |
| Whitespace check | Pass | `git diff --check -- frontend/src/lib/ai/tools/action-tools.ts frontend/src/lib/ai/tools/__tests__/action-tools.test.ts docs/ops/tasks/2026-07-07-ai-commitment-sov-fk-write.md` passed. |
| Changed type debt | Pass | `cd frontend && npm run typecheck:changed` passed with no new `any` debt. |
| Changed lint debt | Pass | `cd frontend && npm run lint:changed:debt` passed across the dirty checkout. |
| Changed route guardrails | Pass | `cd frontend && npm run guardrails:changed` passed for 5 changed routes. |

## Final Status

- [x] Code changes complete.
- [x] Verification complete.
- [x] Remaining risks documented.

## Behavior Implemented

- Confirmed AI `createCommitment` writes now fetch active `project_budget_codes` for the project before inserting the base commitment.
- AI-created subcontract and purchase-order SOV rows now include `project_budget_code_id`.
- Legacy display text in `budget_code` is normalized from the resolved project budget code.
- Invalid, inactive, or ambiguous AI-provided budget-code text fails before the commitment shell is inserted and records an AI write-audit error.

## Remaining Risks

- Preview still displays model-provided budget-code text; confirmed write is the enforcement point.
- Existing unrelated dirty files remain in the checkout, including generated DB type drift from remote `app_page_tags`; those are intentionally excluded from this task.
