# Task: Daily Brief detail page action-oriented UX

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-14
Task ID: AAI-1069
Linear Issue: [AAI-1069](https://linear.app/megankharrison/issue/AAI-1069/redesign-daily-brief-detail-page-for-action-oriented-review)
Related Handoff: `docs/ops/handoffs/2026-07-14-S146-daily-brief-detail-ux.md`

## Objective

Make `/daily-briefs/[briefId]` a source-backed, action-oriented Daily Brief review surface with a two-thirds content column, one-third owner/team task rail, and resolved work history.

## Scope

- Redesign the canonical Daily Brief detail page and its shared task rail.
- Preserve canonical packet content, source links, and existing task APIs.
- Exclude packet generation, database schema changes, and unrelated Daily Brief routes.

## Source of Truth

- Canonical packet: `frontend/src/lib/daily-briefs/canonical-packets.ts` and `intelligence_packets`.
- Shared tasks: `frontend/src/lib/daily-briefs/morning-brief-tasks.ts`, `/api/tasks`, `/api/tasks/[taskId]`.
- Existing shared primitives: `PageShell`, `SectionRuleHeading`, `BriefMarkdown`, `NewTaskDialog`, `Button`, `Modal`.
- Deprecated or parallel paths: none introduced.

## Acceptance Criteria

- [ ] Requested behavior is observable end to end. **Blocked:** production browser session remained on `/auth/login`.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared task rail owns create, edit, delete, resolve, and reassignment behavior.
- [x] Errors are specific and actionable.
- [x] Responsive layout is implemented as one column on small screens and two columns on desktop.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable. **Blocked by authentication.**
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: task mutation error toast with API detail; packet errors remain explicit through the existing loader/error boundary.
- Detection path: targeted type/lint checks plus browser route screenshot and task interaction evidence.
- Recovery path: retry the failed mutation, reopen the task, or use the canonical Tasks route.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Changed-file lint | `cd frontend && npx eslint --no-warn-ignored ...` | Pass | Four task-owned frontend files lint clean. |
| Production route access | `agent-browser open https://projects.alleatogroup.com/daily-briefs/163e5716-9eae-45c3-b30a-ff23f01d5f1f` | Blocked | Redirected to login; screenshot saved at `docs/ops/evidence/2026-07-14-daily-brief-detail-ux/production-auth.png`. |

## Remaining Risk

- Browser verification depends on an authenticated session. The current agent-browser session remains unauthenticated after the available test credential attempt.

## Final Status

- [ ] All required checklist items are complete. Status: Blocked/Deferred pending authenticated browser verification.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A for this implementation pass.
- [x] Deferred browser verification has cause, detection gap, prevention step, owner, and next action in the handoff.
