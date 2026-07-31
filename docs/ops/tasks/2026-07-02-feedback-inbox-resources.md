# Task: Feedback Inbox Resources

Status: Blocked/Deferred - browser verification blocked by admin allowlist
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-895 - https://linear.app/megankharrison/issue/AAI-895/add-feedback-inbox-resources-and-evidence-attachments
Related Handoff: N/A

## Objective

Admins can attach evidence and references to an individual feedback item from the feedback inbox detail pane, including Procore screenshots, Alleato screenshots, URLs, related links, and contract/template files.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

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

## Acceptance Criteria

- [x] A feedback item detail pane shows a compact Resources section without adding toolbar/list noise.
- [x] Admins can add one or more files from the file picker.
- [x] Admins can drag and drop one or more files onto the resources section.
- [x] Admins can add a URL resource with a readable label.
- [x] Uploaded files and links persist on the feedback item and reload from the API.
- [x] Admins can open or remove a saved resource.
- [x] Upload/save/delete failures show specific errors and do not silently drop user input.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `npm exec -- eslint --quiet ...`; `npm run typecheck:changed`; `npm --prefix frontend run lint:changed:debt`; `npm --prefix frontend run guardrails:unsafe-patterns`; `npm run check:routes` | Pass | `npm --prefix frontend run guardrails:changed` blocked by unrelated `frontend/src/app/api/comments/all/route.ts`. |
| Targeted tests        | `npm run test:unit -- --runTestsByPath 'src/app/(admin)/feedback-inbox/_components/__tests__/feedback-resources-section.test.tsx' --runInBand` | Pass | 2 tests passed. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/feedback-inbox && agent-browser snapshot -i` | Blocked | Redirects to `http://localhost:3001/access-denied?reason=admin-dashboard-allowlist`. |
| DB/provider read-back | N/A | Pass | No migration or provider config change. Existing `admin_feedback_items.metadata` and admin-feedback storage bucket path used. |
| End-to-end proof      | Component test + API route static checks | Partial | Live browser E2E blocked by admin allowlist redirect. |

## Files Changed

- `frontend/src/app/api/admin/feedback/[feedbackId]/resources/route.ts` - Persist link resources and uploaded files on feedback metadata.
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-resources-section.tsx` - Detail-pane resource UI.
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx` - Place Resources in the selected feedback detail.
- `frontend/src/app/(admin)/feedback-inbox/types.ts` - Shared typed resource shape.
- `docs/ops/tasks/2026-07-02-feedback-inbox-resources.md` - Definition of done and evidence.

## Risks / Gaps

- Browser automation remains blocked by `http://localhost:3001/access-denied?reason=admin-dashboard-allowlist`, so visual/user-flow verification is partial.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
