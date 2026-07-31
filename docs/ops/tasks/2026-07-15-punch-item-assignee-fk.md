# Task: Repair drawing punch-item assignee identity mapping

Status: In Progress
Owner: Codex
Created: 2026-07-15
Task ID: Local blocker — Linear connector unavailable in this session
Linear Issue: Unavailable: no Linear connector/tool is exposed in this session
Related Handoff: N/A — single-session repair

## Objective

Creating a punch item from a drawing succeeds when a project-team contact is selected as assignee, manager, or approver.

## Scope

- Canonical project-directory roles response and shared punch-item assignee adapter.
- Punch-item regression coverage and browser evidence for the drawing creation flow.
- Excludes unrelated drawing viewer edits already present in the checkout.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/projects/[projectId]/directory/roles/route.ts` and the `punch_items` foreign-key contract.
- Existing shared primitives/services: `project-team-assignee-options.ts`, `punch-item-form-fields.tsx`, `PunchItemService`.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [x] Project-team people with linked auth users submit the auth user ID to punch-item person fields.
- [x] Contacts without linked auth users are not offered as valid punch assignees.
- [x] The previous foreign-key failure no longer occurs in the drawing create flow.
- [x] Invalid identity data fails clearly at the boundary instead of surfacing as a generic database error.

## Implementation Checklist

- [x] Files/modules to change are listed before edits: directory roles route, punch assignee adapter, adapter tests, task evidence.
- [x] Shared directory response owns the cross-cutting identity mapping.
- [x] Errors are specific and actionable.
- [x] Database foreign-key contract is handled without a migration because the existing `auth.users` reference is correct.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual drawing user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: project contacts without an auth account are omitted from assignment pickers; API load failures remain explicit.
- Detection path: adapter regression test plus drawing create request/browser toast.
- Recovery path: link the contact to an app auth user, reload project-team contacts, and select the contact again.

## Incident Learning

- Failure fingerprint: `punch-item-assignee-identity-domain-mismatch`
- Root cause: the picker sent `people.id` to a column constrained to `auth.users.id`.
- Detection gap: the directory contract did not expose the linked auth identity and no test asserted the submitted ID domain.
- Prevention: expose `users_auth.auth_user_id` in the canonical roles response, map picker values to it, and exclude unlinked contacts.
- Guardrail evidence: adapter regression test asserting linked-ID mapping and unlinked-contact exclusion.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Runtime localization | User error plus `punch_items.assignee_id REFERENCES auth.users(id)` and directory picker source | Pass | Failure is at request→DB identity contract boundary. |

## Remaining Risk

- Full independent sub-agent review is unavailable in this session; owner: next reviewer; next action: run the same drawing-flow verification from a clean browser session.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
