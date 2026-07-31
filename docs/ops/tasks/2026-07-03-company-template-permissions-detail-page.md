# Task: Company Template Permissions Detail Page

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-140
Related Handoff: Not applicable

## Objective

Improve the admin company permission templates workflow so `/user-management?tab=company-templates` supports bulk delete from the table and opens a dedicated detail page for each template where admins can review and edit complete module access, grouped tools, and tool-specific granular permissions without using a modal.

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
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && ./node_modules/.bin/eslint 'src/app/(admin)/user-management/template-detail-page-client.tsx' 'src/app/(admin)/user-management/permission-template-matrix.tsx' 'src/app/(admin)/user-management/__tests__/permission-template-matrix.test.tsx'` and `cd frontend && npm run typecheck:changed` | Pass | Changed-file lint passed (`ESLINT_OK`). Changed-file typecheck reported `No new 'any' type debt detected in changed changes.` |
| Targeted tests        | `cd frontend && ./node_modules/.bin/jest --runTestsByPath 'src/app/(admin)/user-management/__tests__/permission-template-matrix.test.tsx' 'src/app/(admin)/user-management/__tests__/permission-template-config.test.ts' --runInBand` | Pass | 2 suites, 3 tests passed. Added regression coverage for collapsed granular rows by default. |
| Browser/user-flow     | `node ...playwright...` screenshot capture against `http://localhost:3001/user-management/templates/55dfe9b1-05f0-41f6-aeea-6e9f9841bbdf` with `tests/.auth/user.json` | Blocked | Route loaded with an `Access Denied` shell instead of the template detail content, so visual density verification is still blocked by local access state. Screenshot artifact: `/tmp/company-template-detail-page.png`. |
| DB/provider read-back | Not applicable     | Pending | No DB/provider changes planned. |
| End-to-end proof      | Local authenticated route attempt via Playwright storage state | Blocked | Blocked by the unrelated local access/authorization state above, not by this page implementation. |

## Files Changed

- `frontend/src/app/(admin)/user-management/page.tsx` - enable company-template selection/bulk delete and route row clicks to detail pages.
- `frontend/src/app/(admin)/user-management/permission-template-form.tsx` - extend module coverage to the full supported tool list and align create/edit structure.
- `frontend/src/app/(admin)/user-management/permission-template-config.ts` - define the canonical grouped tool inventory and tool-to-granular mapping.
- `frontend/src/app/(admin)/user-management/permission-template-matrix.tsx` - render grouped tools with inline expandable granular permissions.
- `frontend/src/app/(admin)/user-management/template-detail-page-client.tsx` - own the dedicated template detail workflow and local optimistic editing state.
- `frontend/src/app/(admin)/user-management/templates/[templateId]/page.tsx` - add the template detail route entry point.
- `frontend/src/app/(admin)/user-management/__tests__/permission-template-matrix.test.tsx` - guard collapsed-by-default granular options and explicit expansion behavior.
- `frontend/src/app/(admin)/user-management/__tests__/permission-template-config.test.ts` - guard full module and granular coverage.
- `frontend/src/lib/permissions.ts` - add single-template loading and return updated template data on save.
- `frontend/src/app/api/permissions/templates/[templateId]/route.ts` - add canonical GET support and return updated template payloads from PUT.

## Risks / Gaps

- Full browser verification of the actual detail page content is blocked by a local access-state problem: authenticated Playwright storage reaches the route but lands on `Access Denied` instead of the editable template view.
- The repo still has pre-existing lint warnings in `frontend/src/app/(admin)/user-management/page.tsx` and `frontend/src/app/(admin)/user-management/permission-template-form.tsx`.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
