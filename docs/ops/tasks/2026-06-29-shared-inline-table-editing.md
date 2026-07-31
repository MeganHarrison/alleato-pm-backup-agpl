# Task: Shared Inline Table Editing

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-29
Linear Issue: Not created - exposed Linear connector only has comment/list tools in this session.
Related Handoff: N/A

## Objective

Make inline table editing reusable across Alleato table pages by moving the common
column and patch wiring into shared helpers, then migrate one representative
table so future pages can opt in through configuration instead of one-off
editor code.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Attention Brief

Primary user: Alleato operators working from table views.
Primary job: Update operational fields without opening a detail drawer/page.
Primary decision: Which cell value should change, and whether the save actually
completed.
Tier 1: Editable cells, successful save, specific failure reason.
Tier 2: Column-specific editor type and validation behavior.
Hidden until requested: Advanced/custom editors for multi-select or relationship
fields.
Removal candidates: Per-page duplicated text/select editor wiring.
Primary action: Click an editable cell, change value, save through the table's
canonical update path.
Failure-loudly behavior: Editable column helpers require an edit value and a
write handler; failed writes surface the server error message through the shared
table toast.

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
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result       | Notes                                                               |
| --------------------- | ------------------ | ------------ | ------------------------------------------------------------------- |
| Static/type/lint      | `./node_modules/.bin/eslint 'src/components/tables/unified/editable-columns.tsx' 'src/components/tables/unified/__tests__/editable-columns.test.tsx' 'src/components/tables/unified/index.ts' 'src/app/(main)/directory/contacts/page.tsx'` | Pass         | No lint errors on helper, barrel, test, or migrated contacts table. |
| Static/type/lint      | `npm run typecheck:changed` | Pass         | No new `any` type debt detected.                                    |
| Targeted tests        | `npm run test:unit -- --runInBand --runTestsByPath src/components/tables/unified/__tests__/editable-columns.test.tsx` | Pass         | 3 tests passed for text columns, select columns, and patch handler normalization. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/directory/contacts && agent-browser snapshot -i` | Auth-blocked | Redirected to `/auth/login?callbackUrl=%2Fdirectory%2Fcontacts`; authenticated inline-edit proof still needed. |
| DB/provider read-back | N/A                | N/A          | No schema, migration, provider, or external config change expected. |

## Files Changed

- `docs/ops/tasks/2026-06-29-shared-inline-table-editing.md` - Task done gate and evidence ledger.
- `frontend/src/components/tables/unified/editable-columns.tsx` - Shared inline editable column helpers and typed patch handler.
- `frontend/src/components/tables/unified/__tests__/editable-columns.test.tsx` - Regression coverage for the shared helper contract.
- `frontend/src/components/tables/unified/index.ts` - Barrel exports for the new helpers.
- `frontend/src/app/(main)/directory/contacts/page.tsx` - Contacts table migrated from local editor wiring to shared helper configuration.

## Risks / Gaps

- The current checkout contains many unrelated dirty files; finish commands must
  stage only task-owned files.
- Some tables have domain-specific validation and should not be bulk-converted
  without a typed PATCH route and permission guard.
- Browser and end-to-end proof are blocked by the unauthenticated automation
  session. Next owner action: verify `/directory/contacts` in an authenticated
  browser by editing email, phone, type, and company cells and confirming rows
  refresh with the saved values.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
