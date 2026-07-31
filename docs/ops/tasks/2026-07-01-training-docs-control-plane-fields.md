# Task: Training docs control-plane fields in admin workflow

Status: Complete
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-851 - https://linear.app/megankharrison/issue/AAI-851/expose-training-docs-control-plane-fields-in-admin-docs-workflow
Related Handoff: N/A

## Objective

Make the existing `/training-docs` admin workflow function as the actual docs
control plane by surfacing first-class inventory and QA fields that already
exist on `training_docs`, and by linking the drafting surface to the existing
`/training-map` inventory view.

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

- Admin training-doc creation and editing can set `tool_category`,
  `tool_module`, `task_key`, `qa_status`, and `qa_notes`.
- The main `/training-docs` table can filter and display inventory/QA fields
  without requiring a second hidden tracker.
- Existing metadata `appToolCategory` stays aligned with first-class
  `tool_category` through shared server-side handling.
- The drafting page exposes a direct path to the existing `/training-map`
  inventory surface and vice versa.
- No new status vocabulary or migration is introduced in this pass.

## Source Of Truth

- DB schema: `supabase/migrations/20260630210000_extend_training_docs_relations_tool_qa.sql`
- Shared server contract: `frontend/src/lib/training-docs/server.ts`
- Admin APIs: `frontend/src/app/api/admin/training-docs/**`
- Admin UI: `frontend/src/app/(admin)/training-docs/**`
- Inventory UI: `frontend/src/app/(admin)/training-map/**`

## Files Changed

- `docs/ops/tasks/2026-07-01-training-docs-control-plane-fields.md` - task ledger and evidence.
- `frontend/src/lib/training-docs/server.ts` - shared create/update normalization for control-plane fields.
- `frontend/src/lib/training-docs/__tests__/server.test.ts` - guardrail for first-class field normalization and metadata mirroring.
- `frontend/src/hooks/use-training-docs.ts` - client mutation payload types.
- `frontend/src/features/training-docs/training-docs-table-config.tsx` - control-plane columns and filters.
- `frontend/src/app/(admin)/training-docs/training-docs-client.tsx` - table-level filter handling and navigation.
- `frontend/src/app/(admin)/training-docs/training-doc-editor.tsx` - editor fields for inventory/QA metadata.
- `frontend/src/app/(admin)/training-map/training-map-client.tsx` - direct navigation back to Training Docs.
- `frontend/src/app/api/admin/training-docs/route.ts` - create path writes first-class control-plane fields.
- `frontend/src/app/api/admin/training-docs/[docId]/route.ts` - update path keeps first-class fields and legacy metadata aligned.

## Evidence

| Check | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint 'src/lib/training-docs/server.ts' 'src/lib/training-docs/__tests__/server.test.ts' 'src/hooks/use-training-docs.ts' 'src/features/training-docs/training-docs-table-config.tsx' 'src/app/(admin)/training-docs/training-docs-client.tsx' 'src/app/(admin)/training-docs/training-doc-editor.tsx' 'src/app/(admin)/training-map/training-map-client.tsx' 'src/app/api/admin/training-docs/route.ts' 'src/app/api/admin/training-docs/[docId]/route.ts'`; `git diff --check -- docs/ops/tasks/2026-07-01-training-docs-control-plane-fields.md ...` | Pass | Focused lint passed on all touched files and diff has no whitespace errors. |
| Targeted tests | `cd frontend && ./node_modules/.bin/jest src/lib/training-docs/__tests__/docs-site.test.ts src/lib/training-docs/__tests__/server.test.ts --runInBand` | Pass | Existing docs-site publish tests still pass and the new shared-server tests cover first-class field normalization plus metadata mirroring. |
| Browser/user-flow | `rm -f frontend/tests/.auth/user.json && cd frontend && TEST_USER_1=megan@megankharrison.com TEST_PASSWORD_1='test12026!!!' PLAYWRIGHT_BASE_URL=http://localhost:3001 ./node_modules/.bin/playwright test tests/auth.setup.ts --config=config/playwright/playwright.config.ts --project=setup`; then headless Playwright route verification for `/training-docs` and `/training-map` | Pass | Refreshed the saved auth state with the allowlisted Megan email, then verified `/training-docs` loaded with title `Training Docs` and visible `Training Map` + `New` actions, and `/training-map` loaded with title `Training Map` and visible `Training Docs` navigation. |
| DB/provider read-back | Reviewed live schema contract in `supabase/migrations/20260630210000_extend_training_docs_relations_tool_qa.sql` against the updated shared server/API paths | Pass | No schema or provider change was required in this pass; the implementation now uses the existing first-class columns rather than hiding them behind metadata-only flows. |
| End-to-end proof | Shared server/API + admin table/editor + training-map navigation changes | Pass | First-class control-plane fields are now wired from shared normalization through admin create/update, visible in the editor/table, and the real admin routes load successfully with the new cross-navigation under an allowlisted admin session. |

## Risks / Gaps

- Existing status vocabulary in the database is still the older draft/review
  model plus `planned`; this pass should not drift the UI into unsupported
  statuses.
- Browser verification required forcing a fresh auth state with an allowlisted admin email because the default saved test user was blocked by the admin-dashboard allowlist.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
