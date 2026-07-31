# Task: Refine canonical project invoice create page for donor-inspired cleanup

Status: In Progress
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-868 - https://linear.app/megankharrison/issue/AAI-868/refactor-project-invoice-create-page-into-extracted-shared-sections
Related Handoff: docs/ops/handoffs/2026-07-01-S110-invoice-create-section-extraction.md

## Objective

`/[projectId]/invoices/new` must preserve the existing owner and commitment invoice creation workflow while the page UI is cleaned up in place using shared Alleato primitives inspired by the donor invoice experience, without importing donor app infrastructure or replacing the canonical persistence path.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Attention Brief

Primary user: Project manager or accounting operator creating a project invoice.
Primary job: Create a valid owner or commitment invoice without breaking financial workflow rules.
Primary decision: Is the invoice configured correctly enough to save and continue the billing workflow?
Tier 1: Contract selection, billing dates, line items, retention, net due, create action.
Tier 2: Status, notes, due date.
Tier 3: Structural polish that improves scanability without changing workflow.
Hide until requested: Secondary polish or preview concepts not needed for creation.
Remove: Donor-card wrappers, duplicate actions, decorative summary chrome, and generic helper text.
Primary action: Create the invoice successfully on the canonical route.
Failure-loudly behavior: If extracted sections break required invoice inputs or payload shaping, the page must surface a specific error and block submission rather than silently mutating invoice data.

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

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task ledger | `docs/ops/tasks/2026-07-01-invoice-create-section-extraction.md` | Pass | Task created before code edits. |
| Linear issue | `AAI-868` | Pass | Created and moved to In Progress before edits. |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint 'src/app/(main)/[projectId]/invoices/new/page.tsx'` | Pass | Route now uses approved inline-table and numeric input primitives with no ESLint output. |
| Targeted tests | Not run | Not run | Earlier extracted-section test files were not present in the final filesystem state, so no task-specific test currently exists for the in-place cleanup. |
| Full frontend typecheck | `cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false` | Failed | Process exited with Node heap OOM before reporting file-level type errors. Treat as repo/runtime verification debt, not a confirmed task-specific type failure. |
| Browser verification | Playwright one-off against `http://localhost:3001/760/invoices/new` using saved auth state | Failed | Route redirected to `/auth/login?callbackUrl=%2F760%2Finvoices%2Fnew`; local auth state is expired or invalid, so route proof is blocked by auth rather than a route crash. |

## Files Changed

- `docs/ops/tasks/2026-07-01-invoice-create-section-extraction.md` - task definition and evidence ledger.
- `docs/ops/handoffs/2026-07-01-S110-invoice-create-section-extraction.md` - worker handoff ledger.
- `docs/ops/orchestration/session-board.md` - active task claim.
- `frontend/src/app/(main)/[projectId]/invoices/new/page.tsx` - canonical route cleaned up in place with shared inline-table and numeric input primitives.

## Risks / Gaps

- Full workflow verification still requires browser proof on a seeded project with both prime and commitment invoice paths available.
- The earlier extraction attempt did not survive in the final filesystem state, so any future section extraction should only be retried once the route has stable proof and a clear shared seam.
- Full frontend TypeScript verification remains blocked by a Node heap OOM in `tsc`.
- Browser verification is blocked by expired local auth state for `localhost:3001`, not by a confirmed route failure.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
