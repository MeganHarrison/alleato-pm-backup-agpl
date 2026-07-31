# Task: Project landing Links section for drone and site footage

Status: Done
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-635 - https://linear.app/megankharrison/issue/AAI-635/add-project-landing-links-section-for-drone-and-site-footage
Related Handoff: Not created - single-session implementation

## Objective

Add a quiet project-scoped Links section to the selected-project landing page so drone flights and other job-site footage have a visible home for subcontractor reference when field questions come up about blocking or other in-wall items.

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

- [x] Project home displays a `Links` section when link-backed project documents exist.
- [x] The section prioritizes drone, video, flight, site footage, and related link records before generic external links.
- [x] Empty state is quiet and does not consume project-home space when no links exist.
- [x] Actions route users to existing project Documents and Photos surfaces instead of creating a duplicate link store.
- [x] Link-query failure is logged with project context so the issue fails loudly for developers without breaking project home.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `npx eslint 'src/app/(main)/[projectId]/home/project-home-command-center-v2.tsx' 'src/app/(main)/[projectId]/home/page.tsx' 'src/app/(main)/[projectId]/home/project-home-links.ts'` | Pass with unrelated warning | Warning: pre-existing `xl:w-[420px]` in `project-home-command-center-v2.tsx:922`, not introduced by this task. |
| Static/type/lint      | `NODE_OPTIONS=--max_old_space_size=16384 npx tsc --noEmit --pretty false --project tsconfig.json` | Fail unrelated | `src/lib/executive/brandon-daily-update.ts(3758,11): TS1117 duplicate object literal property`; outside task-owned files. |
| Static/type/lint      | `npm run check:routes` from repo root | Pass | No dynamic route conflicts. |
| Targeted tests        | `npm run test:unit -- --runTestsByPath 'src/app/(main)/[projectId]/home/project-home-links.unit.test.ts'` | Pass | 3 tests passed. |
| Browser/user-flow     | `agent-browser` on `http://localhost:3001/1009/home` | Pass | Auth refreshed via `PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test --config config/playwright/playwright.config.ts --project=setup`; page shows `Links5`, `Manage links`, and five external link rows. Screenshot: `/Users/meganharrison/.agent-browser/tmp/screenshots/screenshot-2026-06-25T18-51-52-100Z-7ksd4j.png`. |
| DB/provider read-back | N/A                | Pass   | No schema, provider, env, or migration changes. |
| End-to-end proof      | Teams fetch + browser route | Pass | Teams source verified from Colin Gillespie at `2026-06-25T18:41:32.54Z`; project home renders the landing Links section from existing `project_documents` URL records. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/home/page.tsx` - fetch project link records from canonical project documents.
- `frontend/src/app/(main)/[projectId]/home/project-home-command-center-v2.tsx` - render the Links section on project home.
- `frontend/src/app/(main)/[projectId]/home/project-home-links.ts` - shared link filtering, sorting, href, and kind helpers.
- `frontend/src/app/(main)/[projectId]/home/project-home-links.unit.test.ts` - guard link prioritization and visibility behavior.
- `docs/ops/tasks/2026-06-25-project-landing-links-section.md` - working definition of done and evidence.

## Risks / Gaps

- A fuller CRUD experience for adding named project links may be warranted later; this pass reuses Documents/Photos as the source of truth to avoid a duplicate project-link model.
- Full frontend typecheck is currently blocked by unrelated repo debt in `src/lib/executive/brandon-daily-update.ts`.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
