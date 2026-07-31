# Task: Acumatica Commitment SOV FK Projection

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Stop Acumatica commitment projection from creating subcontract and purchase-order
SOV rows with only text budget-code references.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before implementation.
- [x] Regenerate Supabase database types before touching database-backed code.
- [x] Resolve Acumatica detail `CostCode` values to `project_budget_codes.id`.
- [x] Write `project_budget_code_id` on projected subcontract SOV rows.
- [x] Write `project_budget_code_id` on projected purchase-order SOV rows.
- [x] Fail loudly by skipping and counting unresolved SOV cost-code lines.
- [x] Add targeted backend tests.

## Verification Checklist

- [x] Targeted backend Acumatica commitment tests pass.
- [x] Task-owned diff excludes unrelated dirty worktree files.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| FK audit skill | Pass | Loaded `.claude/skills/fk-audit/SKILL.md`; Acumatica projection writes FK-backed commitment SOV rows. |
| DB types preflight | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded with existing inbucket deprecation warning. Generated output includes unrelated remote `app_page_tags` drift and will not be committed in this backend-only slice. |
| Targeted backend tests | Pass | `cd backend && python -m pytest tests/test_acumatica_commitments_sync.py -q` passed: 6 tests. Existing FastAPI/datetime deprecation warnings only. |

## Final Status

- [x] Code changes complete.
- [x] Verification complete.
- [x] Remaining risks documented.

## Behavior Implemented

- Acumatica subcontract SOV projection now resolves detail `CostCode` values to `project_budget_codes.id`.
- Acumatica purchase-order SOV projection now resolves detail `CostCode` values to `project_budget_codes.id`.
- Projected SOV rows keep normalized display text in `budget_code` while writing canonical `project_budget_code_id`.
- Lines whose cost code cannot resolve are skipped, counted, and logged instead of creating text-only SOV references.

## Remaining Risks

- Existing unrelated dirty changes remain in `backend/src/services/acumatica_sync.py`; commit staging must be hunk-scoped.
- The generated frontend DB type file already has unrelated remote/page-tag drift in this checkout and must not be included in this backend commit.
