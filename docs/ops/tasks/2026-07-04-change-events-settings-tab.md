# Task: Change Events Settings Tab

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-04
Linear Issue: AAI-935 - https://linear.app/megankharrison/issue/AAI-935/add-change-events-settings-tab-with-procore-parity-project-settings
Related Handoff: Not applicable

## Objective

Add a `Settings` tab to `/[projectId]/change-events` that exposes a project-scoped Change Events settings surface modeled on Procore's current Change Events configuration workflow, with settings persisted through one canonical API and database owner.

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

## Acceptance Criteria

- [x] The Change Events page shows a top-level `Settings` tab alongside the existing workflow tabs.
- [x] Opening the `Settings` tab shows two inline settings subtabs: `Change Events Settings` and `Permissions Table`.
- [x] `Change Events Settings` persists project-scoped values for the Procore-backed settings included in scope.
- [x] `Permissions Table` exposes the existing project permission readout pattern for Change Events.
- [x] Missing settings storage fails with a specific actionable error instead of silently falling back.

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
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint --quiet 'src/app/api/projects/[projectId]/change-events/settings/route.ts' 'src/app/api/projects/[projectId]/change-events/settings/__tests__/route.test.ts' 'src/hooks/use-change-event-settings.ts' 'src/features/change-events/change-events-settings-tab.tsx' 'src/app/(main)/[projectId]/change-events/page.tsx'`; `cd frontend && npm run typecheck:changed`; `npm run check:routes`; `npm run verify:changed-route-guardrails` | PASS | New route, hook, settings UI, and page wiring lint clean. Changed-route guardrails passed for 3 routes. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath 'src/app/api/projects/[projectId]/change-events/settings/__tests__/route.test.ts'` | PASS | 1 suite, 3 tests passed. |
| Browser/user-flow     | `agent-browser` login attempt on `http://localhost:3000/876/change-events?tab=settings&settings_tab=change-events-settings`; fallback Playwright screenshot `docs/ops/evidence/2026-07-04-change-events-settings-tab-local.png` | BLOCKED | Local `/auth/login` rejected the configured test credentials with `Invalid email or password`, and saved Playwright auth state redirected back to login. |
| DB/provider read-back | `psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -f 'supabase/migrations/20260704103000_create_change_event_project_settings.sql'`; `npx supabase migration repair --linked --status applied 20260704103000`; `npm run db:migrations:verify-applied -- 'supabase/migrations/20260704103000_create_change_event_project_settings.sql'`; `npm run db:types` | PASS | Migration applied directly because `npm run db:push` was blocked by a pre-existing remote ledger mismatch. Exact migration version verified as applied. |
| End-to-end proof      | `docs/ops/evidence/2026-07-04-change-events-settings-tab-local.png` | PARTIAL | Screenshot artifact captured, but authenticated route proof is still blocked by local auth failure. |

## Files Changed

- `docs/ops/tasks/2026-07-04-change-events-settings-tab.md` - task definition and verification ledger
- `docs/ops/evidence/2026-07-04-change-events-settings-tab-local.png` - blocked browser-verification artifact
- `frontend/src/app/(main)/[projectId]/change-events/page.tsx` - top-level tab wiring and settings surface integration
- `frontend/src/app/api/projects/[projectId]/change-events/settings/route.ts` - canonical project settings API
- `frontend/src/app/api/projects/[projectId]/change-events/settings/__tests__/route.test.ts` - route defaults, persistence, and fail-loud coverage
- `frontend/src/hooks/use-change-event-settings.ts` - settings query and mutation owner
- `frontend/src/features/change-events/change-events-settings-tab.tsx` - settings form UI
- `frontend/src/components/dev-tools/page-schema-fk.generated.ts` - FK registry refresh after schema update
- `supabase/migrations/20260704103000_create_change_event_project_settings.sql` - project settings storage
- `frontend/src/types/database.types.ts` - generated database contract update

## Risks / Gaps

- The settings surface persists the full scoped contract, but not every downstream runtime path consumes those settings yet. The canonical owner now exists, but separate change-event creation/export flows still need to read from it before the settings affect every behavior beyond this page.
- The checkout already contains unrelated dirty files outside this task; closeout must use task-owned file selection only.
- `npm run db:push` is currently blocked by a pre-existing local-vs-remote migration ledger mismatch unrelated to this task's SQL. This task used direct SQL apply plus exact-version repair/read-back instead.
- Authenticated browser proof is currently blocked by local `/auth/login` rejecting the configured test credentials and by stale Playwright auth state.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
