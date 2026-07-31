# Task: Global home Outlook meetings section

Status: In Progress
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-713 - https://linear.app/megankharrison/issue/AAI-713/show-outlook-calendar-meetings-on-global-home
Related Handoff: N/A

## Objective

Global `/home` shows the signed-in user's upcoming Outlook Calendar meetings through the existing Microsoft Graph calendar service, with a quiet operational UI and a specific error state when Graph is not configured or permitted.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Noise Gate Brief

Primary user: Authenticated operator or executive landing on global `/home`.
Primary job: Know which upcoming meetings affect the day and open or join them quickly.
Primary decision: Which meeting is next and whether it needs attention now.
Tier 1: Upcoming Outlook meetings in the next short window.
Tier 2: Start time, end time, location/join link, Outlook link.
Tier 3: Organizer and attendee count.
Hide until requested: Body preview, full attendee list, historical synced meeting transcripts.
Remove: Stat cards, decorative wrappers, duplicate meeting summaries, helper panels.
Primary action: Open the Outlook event or join the online meeting.
Failure-loudly behavior: Missing mailbox, token, or calendar permission renders a specific configuration error instead of an empty state.

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
- [ ] Provider/env/config changes handled through CLI/API/MCP when available.
- [ ] Centralized/shared abstraction used when the behavior is cross-cutting.
- [ ] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [ ] Errors are specific and actionable; no silent fallback added.
- [ ] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [ ] End-to-end path wired through one owner, not separate disconnected pieces.
- [ ] All entry points for the workflow use the same canonical service/runtime.
- [ ] Source adapters or external dependencies return typed, inspectable results.
- [ ] Run/task/session ledger records every meaningful attempt, if applicable.
- [ ] Artifacts link back to source evidence and run logs, if applicable.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states, if applicable.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [ ] Guardrail added so the same class of bug fails loudly next time.
- [ ] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [ ] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Linear issue | AAI-713 | Pass | Created before implementation. |

## Files Planned

- `frontend/src/app/api/home/outlook-calendar/route.ts` - Server route that calls the canonical Graph calendar reader for the signed-in user/current mailbox.
- `frontend/src/app/(main)/home/page.tsx` - Fetch and render upcoming Outlook meetings in the existing global home Action Dashboard.
- `frontend/src/app/(main)/home/__tests__/home-page-contract.test.ts` - Guardrail that the Outlook section remains present and fail-loud.

## Risks / Gaps

- The live Graph calendar read may be blocked by missing local mailbox or Graph calendar permissions; this must show as a specific error, not as "no meetings."
- User-owned dirty files exist outside this task and must not be staged or changed.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
