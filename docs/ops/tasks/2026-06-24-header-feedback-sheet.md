# Task: Header Feedback Sheet

Status: Partial
Owner: Codex
Created: 2026-06-24
Linear Issue: Not linked in-thread
Related Handoff: N/A

## Objective

Replace the floating client feedback entry point with a header-triggered
feedback sheet that opens immediately, keeps page context visible for
screenshots and explanation, and preserves the existing automatic GitHub issue
creation and page-context submission path.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing feedback capture and inbox architecture reviewed.
- [x] Existing header interaction patterns reviewed before adding a new control.
- [x] Canonical submission owner confirmed as `/api/admin/feedback`.
- [x] Existing floating launcher path identified for replacement.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Header icon opens feedback directly from the site header.
- [x] Floating bottom-right feedback launcher no longer appears.
- [x] Feedback form is rendered as a right-side sheet, not a blocking modal.
- [x] Page content remains visible while the sheet is open.
- [x] Secondary link to feedback history/submissions is available inside the sheet.
- [x] Existing POST path still sends page context and still attempts GitHub issue creation.
- [x] User-facing copy/UI follows project noise gate and design-system rules.

## Integration Checklist

- [x] Header trigger and any existing global trigger use the same open-composer event.
- [x] The sheet preserves current screenshot/recording flows.
- [x] Automatic GitHub issue creation remains on the canonical POST route.
- [x] Feedback history route remains reachable without becoming the primary action.

## Regression Guardrails

- [x] Guardrail added so the feedback sheet open state shifts the app shell consistently.
- [x] Existing feedback submission behavior preserved without creating a parallel route.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated check run.
- [x] Browser/user-flow verification run for the header trigger and sheet behavior.
- [ ] End-to-end submission path verified far enough to confirm the existing API wiring remains intact.
- [x] Evidence artifacts recorded below.

## Files Planned

- `docs/ops/tasks/2026-06-24-header-feedback-sheet.md`
- `frontend/src/components/header/site-header.tsx`
- `frontend/src/components/header/feedback-button.tsx`
- `frontend/src/components/admin-feedback/AdminFeedbackWidget.tsx`
- `frontend/src/lib/admin-feedback/constants.ts`
- `frontend/src/app/(main)/layout.tsx`
- `frontend/src/app/(admin)/layout.tsx`
- `frontend/src/app/(tables)/layout.tsx`
- `frontend/src/app/(dashboard)/layout.tsx`
- `frontend/src/app/(developer)/layout.tsx`
- `frontend/src/components/layouts/SidebarLayout.tsx`

## Failure-Loudly Plan

- If feedback submission fails, keep the sheet open and show the existing
  actionable error toast.
- If screenshot compression or upload fails, preserve the text submission and
  warn explicitly rather than failing silently.
- If GitHub issue creation fails, preserve the existing `github_failed` status
  path from the canonical API route instead of hiding the failure.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/type/lint | `pnpm --dir frontend exec eslint <touched files>` | Pass | Touched files lint clean. |
| Static/type/lint | `NODE_OPTIONS=--max-old-space-size=8192 pnpm --dir frontend exec tsc --noEmit --pretty false --incremental false` | Partial | Fails on unrelated existing repo debt in `src/lib/submittals/ai-review/review-run-service.ts` lines 1039-1040. |
| Browser/user-flow | Playwright one-off script against `http://localhost:3001/760/change-events` | Pass | Logged in, clicked header `Share feedback`, verified visible `Share Feedback` sheet, `View feedback` link, textarea, and app-shell right padding while open. |
| End-to-end submission | Not run | Deferred | Avoided creating a live GitHub issue during verification. Canonical `/api/admin/feedback` POST path remains unchanged. |

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
