# Task: Published training docs in app knowledge

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-771 - https://linear.app/megankharrison/issue/AAI-771/add-published-training-docs-to-app-knowledge-base
Related Handoff: docs/ops/handoffs/2026-06-30-S99-training-docs-app-knowledge.md

## Objective

After a training doc is published, `/knowledge/app` includes it in the app
knowledge base under the Training Docs category with a link to the published
docs-site article.

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

## Acceptance Criteria

- `/knowledge/app` renders published `training_docs` rows together with existing app help articles.
- Published training docs use `training_docs.published_doc_path` for the user-facing link.
- Training docs appear under a visible Training Docs category, not Other.
- If the published training-doc query fails, the page fails with the concrete query error instead of silently hiding training docs.

## Source Of Truth

- Publish state: `training_docs.published_doc_path` and `last_published_at`.
- Published article URL: shared helper in `frontend/src/lib/training-docs/constants.ts`.
- App knowledge display: `frontend/src/app/(main)/knowledge/app/page.tsx`.

## Files Changed

- `frontend/src/lib/training-docs/constants.ts` - shared docs-site URL helper.
- `frontend/src/features/training-docs/training-docs-table-config.tsx` - reuse shared URL helper.
- `frontend/src/app/(main)/knowledge/app/page.tsx` - merge app-help and published training docs.
- `frontend/src/features/knowledge/knowledge-base-page.tsx` - add Training Docs app category.
- `frontend/src/features/knowledge/__tests__/knowledge-base-page.test.tsx` - category rendering guardrail.
- `frontend/src/lib/training-docs/__tests__/docs-site.test.ts` - URL helper guardrail.
- `docs/ops/tasks/2026-06-30-training-docs-app-knowledge.md` - task evidence.
- `docs/ops/handoffs/2026-06-30-S99-training-docs-app-knowledge.md` - worker handoff.
- `docs/ops/orchestration/session-board.md` - S99 ownership claim.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `./node_modules/.bin/eslint ...`; `npm run typecheck:changed`; `npm run codex:finish ...` | Pass | `codex:finish` quality:changed passed and pushed commit `9e7d233b56` to `origin/main`. |
| Targeted tests        | `jest --runInBand --runTestsByPath src/features/knowledge/__tests__/app-help-page.test.tsx src/lib/training-docs/__tests__/docs-site.test.ts` | Pass | 2 suites / 8 tests passed in clean main worktree. Develop checkout also passed 3 suites / 11 tests for the broader knowledge page branch. |
| Browser/user-flow     | `agent-browser open http://localhost:3002/knowledge/app` | Blocked | Redirected to `/auth/login?callbackUrl=%2Fknowledge%2Fapp`; profile API returned `AUTH_EXPIRED`. |
| DB/provider read-back | Supabase read of `training_docs` with non-null `published_doc_path`; Vercel deployment list | Partial | Supabase returned published-path rows. Vercel production deployment `dpl_APAvH4EKbMdZCetsKQip5qbo68jX` for `9e7d233b56` was still `BUILDING` at last check. |
| End-to-end proof      | Focused route/component tests plus Supabase read-back | Partial | Code path is proved; authenticated production visual proof remains deferred. |

## Risks / Gaps

- Existing checkout has unrelated dirty files and pre-existing edits in email/admin/develop knowledge work; production patch was applied and pushed from a clean main worktree.
- Authenticated browser proof remains blocked by `AUTH_EXPIRED`.
- Production deployment was still building at final poll; verify Vercel becomes `READY` before treating the production page as visually verified.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
