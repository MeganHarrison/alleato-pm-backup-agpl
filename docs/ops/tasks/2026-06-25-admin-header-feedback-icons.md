# Task: Admin Header Feedback Icons

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: Not linked in-thread
Related Handoff: N/A

## Objective

Tighten the `/admin` header actions by replacing the submit-feedback icon with
a clearer non-comment metaphor and removing the last developer-panel icon from
the desktop header.

## Attention Brief

Primary user: Admin/developer using the Alleato admin shell.
Primary job: Submit feedback or navigate admin tools without misreading header icons.
Primary decision: Which header action submits feedback versus opens comments or developer-only tooling.
Tier 1: Clear submit-feedback action.
Tier 2: Existing comments, notifications, and user-menu actions.
Tier 3: Project/tool selectors.
Hide until requested: Developer/reference panel controls.
Remove: Final developer-panel header icon.
Primary action: Share feedback.
Failure-loudly behavior: The feedback button continues to dispatch the existing composer event; if the composer cannot open, the broken shared event path is visible in header verification.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Exact reported surface reviewed: `/admin` shared site header.
- [x] Root cause identified in shared header controls, not page-local code.
- [x] Current feedback/comment/developer icon meanings compared.
- [x] Acceptance criteria written as observable behavior.

## Implementation Checklist

- [x] Feedback submit button no longer uses a comment-like icon.
- [x] Feedback submit button keeps the existing composer event and accessible label.
- [x] Last developer-panel header icon is removed from the desktop header.
- [x] No page-local visual override added for `/admin`.

## Verification Checklist

- [x] Touched-file lint or TypeScript check run.
- [x] Browser/user-flow verification against `/admin` records that the feedback icon is distinct and the developer-panel icon is gone.
- [x] Evidence artifacts recorded below.

## Files Planned

- `docs/ops/tasks/2026-06-25-admin-header-feedback-icons.md`
- `frontend/src/components/header/feedback-button.tsx`
- `frontend/src/components/header/site-header.tsx`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint --quiet src/components/header/feedback-button.tsx src/components/header/site-header.tsx` | Pass | Touched header files lint clean. |
| Static/type/lint | `pnpm --dir frontend exec eslint src/components/header/feedback-button.tsx src/components/header/site-header.tsx` | Blocked before lint | pnpm attempted dependency reconciliation and aborted on non-interactive modules purge confirmation. Retried with local ESLint binary. |
| Browser/user-flow | `agent-browser open http://localhost:3001/admin`; `agent-browser eval ...`; screenshots in `tests/agent-browser-runs/2026-06-25-admin-header-feedback-icons/` | Pass | Rendered feedback SVG class is `lucide lucide-send h-4 w-4`; `Toggle Procore reference panel` count is `0`; clicking `Share feedback` opens the existing feedback sheet. |

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
