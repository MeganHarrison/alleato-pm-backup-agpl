# Task: Meetings tool structured workflow

Status: In Progress
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-826 - https://linear.app/megankharrison/issue/AAI-826/meetings-add-meeting-creation-agenda-and-minutes-workflow
Related Handoff: docs/ops/handoffs/2026-07-01-S107-meetings-tool-list-hooks.md

## Objective

Replace the current Fireflies-only meetings surface with the real structured
Procore-style meetings workflow so project users can create meetings, manage
series/agenda/minutes/follow-up items, use templates, and keep transcript-linked
AI flows available through the new canonical meetings model.

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
- [ ] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [ ] Errors are specific and actionable; no silent fallback added.
- [ ] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [ ] End-to-end path wired through one owner, not separate disconnected pieces.
- [ ] All entry points for the workflow use the same canonical service/runtime.
- [ ] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [ ] Guardrail added so the same class of bug fails loudly next time.
- [ ] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- `/{projectId}/meetings` uses the new structured `meetings` tables rather than
  directly rendering raw `document_metadata` rows.
- Users can create a meeting, open it, manage agenda categories/items, convert
  agenda to minutes, and create a follow-up meeting from the structured APIs.
- Transcript-dependent prep/digest flows remain reachable from a structured
  meeting through `transcript_document_id`.
- Company meeting templates can seed a new structured meeting.
- New Fireflies transcript meetings auto-link into the structured meetings model
  without breaking the existing ingestion pipeline.

## Failure-Loudly Rule

- If a meeting route cannot load the structured record, the page or API returns a
  specific meeting-scoped error rather than silently falling back to raw
  transcript mode.
- If a structured meeting has no linked transcript document, transcript tabs and
  prep/digest actions must state that explicitly instead of rendering empty data.

## Source Of Truth

- Structured meetings workflow: `public.meetings` and child tables.
- Transcript linkage: `meetings.transcript_document_id -> document_metadata.id`.
- Canonical project meetings APIs: `frontend/src/app/api/projects/[projectId]/meetings/**`.
- Existing implementation foundation: `feat/meetings-tool` worktree at
  `/Users/meganharrison/Documents/alleato-pm-wt/meetings-tool`.

## Execution Slices

- `AAI-865` / `S107`:
  hooks + project list/create wiring on the new meetings API contract, plus
  main-session integration ownership for the detail payload and final browser
  acceptance.
- `AAI-866` / `S108`:
  dedicated UI port session: detail shell, transcript pane, AI summary pane,
  and Meetily-derived interaction patterns adapted onto Alleato primitives.
- `AAI-867` / `S109`:
  templates, Fireflies structured-link sync, and verification follow-through.

## Session Split Rules

- `S107` owns API and hook contract truth for the structured meetings model.
- `S108` should not redesign API payloads or route behavior; it consumes the
  contracts from `S107` and adapts Meetily UI behavior onto Alleato components.
- `S109` stays off the UI path unless explicitly reassigned.
- Expensive verification remains delegated; do not block the main integration
  thread on full-project checks.

## Files Changed

- `docs/ops/tasks/2026-07-01-meetings-tool.md` - main task ledger.
- `docs/ops/handoffs/2026-07-01-S107-meetings-tool-list-hooks.md` - main-session handoff.
- `docs/ops/handoffs/2026-07-01-S108-meetings-tool-detail-agenda-ui.md` - worker handoff.
- `docs/ops/handoffs/2026-07-01-S109-meetings-tool-templates-pipeline.md` - worker handoff.
- `docs/ops/orchestration/session-board.md` - ownership claims for the active meetings slices.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | delegated to worker loop + targeted local checks | In progress | Full/project checks stay delegated per repo policy. |
| Targeted tests        |                    |        |       |
| Browser/user-flow     |                    |        |       |
| DB/provider read-back | branch + schema review; live read-back pending implementation | In progress | Structured schema exists on `feat/meetings-tool`; live proof still pending. |
| End-to-end proof      |                    |        |       |

## Risks / Gaps

- The existing `feat/meetings-tool` branch is ahead of `main` but also behind
  current `main`, so rebasing or selective porting is required before landing.
- The root checkout is dirty and should not be used as the code integration
  surface for the meetings implementation.
- Existing meetings hooks and pages still assume the legacy `document_metadata`
  contract, so partial wiring can leave the route in a broken mixed state.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
