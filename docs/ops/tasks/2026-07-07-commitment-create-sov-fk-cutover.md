# Task: Commitment Create SOV FK Cutover

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Protect subcontract and purchase-order create flows from writing text-only SOV
budget-code references.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before implementation.
- [x] Regenerate Supabase database types before touching database-backed code.
- [x] Extract shared commitment SOV budget-code FK resolver.
- [x] Update subcontract create SOV inserts to write `project_budget_code_id`.
- [x] Update purchase-order create SOV inserts to write `project_budget_code_id`.
- [x] Preserve legacy display text during transition.
- [x] Reject ambiguous or unresolved budget-code text.
- [x] Add targeted tests.
- [x] Avoid committing unrelated pre-existing route changes.

## Verification Checklist

- [x] Targeted route tests pass.
- [x] Focused lint passes.
- [x] Changed-file guardrails pass except unrelated dirty-file blocker documented.
- [x] Publish only task-owned hunks/files.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| FK audit skill | Pass | Loaded `.claude/skills/fk-audit/SKILL.md`; this is another FK-backed form/write-path repair. |
| DB types preflight | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded with the existing inbucket deprecation warning. |
| Dirty worktree check | Pass | Purchase-order route already had an unrelated accounting-method hunk; this task must not sweep that hunk into the commit. |
| Targeted tests | Pass | `cd frontend && npm run test:unit -- --runTestsByPath 'src/lib/commitments/__tests__/sov-budget-code-resolution.server.test.ts' 'src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/commitments/[commitmentId]/line-items/import/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/subcontracts/__tests__/route.test.ts' 'src/app/api/projects/[projectId]/purchase-orders/__tests__/route.test.ts' --runInBand` passed: 13 tests. |
| Focused ESLint | Pass | `cd frontend && ./node_modules/.bin/eslint ...` passed for the shared resolver, create routes, schemas, and tests. |
| Changed lint debt | Pass | `cd frontend && npm run lint:changed:debt` passed. |
| Changed type debt | Pass | `cd frontend && npm run typecheck:changed` passed. |
| Changed route guardrails | Pass | `cd frontend && npm run guardrails:changed` passed for 3 changed routes. |
| Unsafe-pattern guardrail | Blocked by unrelated dirty file | `cd frontend && npm run guardrails:unsafe-patterns` failed only on `frontend/src/app/(admin)/site-map/site-map-client.tsx`, which is unrelated and pre-existing dirty work in this checkout. |
| Project map gate | Pass | Initial commit attempt blocked because route/API changes require the project map. Ran `npm run map:project` and staged the generated map artifacts. |

## Final Status

- [x] Code changes complete.
- [x] Verification complete.
- [x] Remaining risks documented.

## Behavior Implemented

- Added shared server resolver for commitment SOV budget-code FK resolution.
- Subcontract create SOV rows now write `project_budget_code_id`.
- Purchase-order create SOV rows now write `project_budget_code_id`.
- The direct line-items API now uses the shared resolver.
- Ambiguous/unresolved legacy budget-code text fails loudly instead of creating new text-only references.

## Remaining Risks

- Remaining write paths still need cutover: bulk commitment import, legacy commitment route, AI action tools, and Acumatica projection.
- Existing unrelated dirty files remain in the checkout and were intentionally not included.
