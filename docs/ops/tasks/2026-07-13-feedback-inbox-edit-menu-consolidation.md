# Task: Feedback Inbox Edit Menu Consolidation

Status: In Progress - Live browser proof blocked by auth redirect
Owner: Codex
Created: 2026-07-13
Task ID: Local task file; Linear creation blocked by connector auth failure
Linear Issue: Blocked - Linear connector returned `UNAUTHORIZED` with `oauth_token_invalid_grant` and `TRIGGER_REAUTHENTICATION` on issue creation.
Related Handoff: N/A

## Objective

Replace the always-visible feedback detail edit fields on `/feedback-inbox` with
one compact edit affordance that opens the actual settings surface for title,
category, and destructive actions.

## Scope

- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx`
- focused supporting UI wiring needed for the new edit/settings flow
- targeted task evidence for this interaction change

## Source of Truth

- Canonical runtime/data owner: feedback inbox split-page detail pane on `/feedback-inbox`
- Existing shared primitives/services: `@/components/ui/dropdown-menu`, `@/components/ui/sheet`, `@/components/ui/detail-property-bar`
- Deprecated or parallel paths: permanently visible inline title/category edit controls in the detail pane

## Design Doctrine Gate

Surface: feedback inbox selected-item detail pane
One purpose: review a feedback item and take the next action without living in permanent edit mode
Primary user job: inspect feedback, triage it, and edit metadata only when needed
Primary action: review and route the item
Secondary actions: update title, update category, open submitted page, create/open GitHub issue, delete
Next action after success: continue reviewing the same item with cleaner state
Correction path: reopen the edit menu and adjust the relevant setting again
Keyboard path: tab to `Edit`, open menu, select a setting, edit in sheet, save, return to detail context
Information that belongs elsewhere: always-visible metadata form fields and permanent destructive controls
Blessed pattern: compact header action dropdown plus focused settings sheet
Complexity budget: one compact menu trigger, one compact menu, one settings surface
Pass/fail: Fail before implementation; the pane is permanently in edit mode and spreads mutations across inline fields and debug sections

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Planned Files

- `docs/ops/tasks/2026-07-13-feedback-inbox-edit-menu-consolidation.md`
- `frontend/src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx`

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: explicit disabled save states, preserved sheet context, and existing specific error toasts from feedback mutations
- Detection path: focused UI interaction in the detail pane plus targeted lint/test commands
- Recovery path: reopen `Edit`, choose the field again, correct the value, and retry with visible save controls

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | `docs/ops/tasks/2026-07-13-feedback-inbox-edit-menu-consolidation.md` | Pass | Full-process UI task captured before implementation. |
| Linear creation | `mcp__codex_apps__linear._save_issue` | Blocked | Connector returned `UNAUTHORIZED`, `oauth_token_invalid_grant`, and `TRIGGER_REAUTHENTICATION`. |
| Impeccable complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs 'frontend/src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx'` | Pass | Detail-pane control density and disclosure pass after consolidating edit actions. |
| Split-page audit | `node .agents/skills/impeccable/scripts/alleato/audit-split-page-consistency.mjs 'frontend/src/app/(admin)/feedback-inbox/page.tsx'` | Pass | Feedback inbox still uses the shared split-page shell. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint -c eslint.config.mjs 'src/app/(admin)/feedback-inbox/_components/feedback-detail.tsx'` | Pass | No focused lint findings. |
| Live browser readback | `agent-browser --auto-connect open https://projects.alleatogroup.com/feedback-inbox && ... get url && ... screenshot` | Blocked | Real route redirected to `https://projects.alleatogroup.com/auth/login?callbackUrl=%2Ffeedback-inbox`; screenshot saved at `docs/ops/evidence/2026-07-13-feedback-inbox-edit-menu-consolidation-feedback-inbox-current.png`. |

## Remaining Risk

- Authenticated browser proof of the new edit menu remains outstanding because the live route redirected to login before the inbox could be inspected. Owner: browser/auth state. Next action: verify the authenticated detail pane and capture an after screenshot once an admin-authorized session is available.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
