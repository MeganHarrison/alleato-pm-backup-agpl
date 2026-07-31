# Task: Meeting Lineage Temporary Page

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-971
Related Handoff: `docs/ops/handoffs/2026-07-06-S117-meeting-lineage-temporary-page.md`

## Objective

Create a temporary frontend page that shows every downstream artifact written
from a single meeting transcript/document so the exact write surface is visible:
document row, meeting segments, extracted items, curated insight cards,
evidence links, prep/summary/digest style content, and any other meeting-tied
rows that exist for the same meeting.

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
- [ ] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `./node_modules/.bin/eslint src/lib/meetings/lineage.ts src/lib/meetings/__tests__/lineage.test.ts 'src/app/(main)/[projectId]/meetings/[meetingId]/lineage/page.tsx'`; `npm run typecheck:changed` | Pass | No new lint issues on changed files; changed-file type debt check passed. |
| Targeted tests | `npm run test:unit -- --runInBand --runTestsByPath src/lib/meetings/__tests__/lineage.test.ts src/lib/meetings/__tests__/server.test.ts` | Pass | 2 suites, 14 tests passed. |
| Browser/user-flow | `agent-browser ... open http://localhost:3001/90/meetings/01KW9HBHD8S5PZBH5RB39F0328/lineage`; screenshot `docs/ops/evidence/2026-07-06-meeting-lineage-page-access-denied.png` | Blocked | Authenticated test user reached `/access-denied?reason=no-project-access` for project 90, so the exact route could not be visually verified with the shared test account. |
| DB/provider read-back | Service-role read-back queries against `document_metadata`, `meetings`, `meeting_segments`, `meeting_preps`, `tasks`, `insight_card_evidence`, `insight_cards`, `fireflies_ingestion_jobs`, and RAG `document_chunks` for `01KW9HBHD8S5PZBH5RB39F0328` | Pass | Live lineage proved before UI implementation. |
| End-to-end proof | Route implemented at `/${projectId}/meetings/${meetingId}/lineage`; direct browser proof blocked by project access | Partial | Code path and data path are proven; user-visible route for the named meeting still needs verification with an account that can open project 90. |

## Files Changed

- `docs/ops/tasks/2026-07-06-meeting-lineage-temporary-page.md` - task ledger
- `docs/ops/handoffs/2026-07-06-S117-meeting-lineage-temporary-page.md` - handoff ledger
- `docs/ops/orchestration/session-board.md` - session claim
- `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/lineage/page.tsx` - temporary lineage surface
- `frontend/src/lib/meetings/lineage.ts` - shared lineage loader and inventory builder
- `frontend/src/lib/meetings/__tests__/lineage.test.ts` - lineage inventory regression test
- `frontend/src/lib/meetings/server.ts` - curated risk dedupe already added during adjacent meeting investigation

## Risks / Gaps

- A single meeting can exist in both `document_metadata.id` space and `meetings.id` space, so the page must resolve the exact lineage anchor clearly.
- Some downstream data is meeting-linked only through evidence tables instead of direct foreign keys, so the page must distinguish direct rows from inferred relationships.
- The current schema around meeting segments and extracted arrays may not match older assumptions in the UI; the page should expose absent tables/columns plainly instead of pretending they exist.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
