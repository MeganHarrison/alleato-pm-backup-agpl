# Task: Velt Comment Dialog Header Polish

Status: Complete
Owner: Codex
Created: 2026-07-13
Linear Issue: Blocked - Linear connector reauthentication is required (`oauth_token_invalid_grant`).
Related Handoff: `docs/ops/handoffs/2026-07-13-S132-velt-comment-dialog-header-polish.md`

## Objective

Simplify the shared Velt comment dialog so author identity and essential thread
actions occupy one quiet row, status becomes a compact color affordance, and the
best available user avatar is shown consistently.

## Design Doctrine Gate

Surface: shared Velt floating comment dialog
One purpose: read and reply to an anchored discussion
Primary user job: identify the author, understand status, and act on the thread
Primary action: reply
Secondary actions: change status, resolve, more actions
Next action after success: return to the annotated work
Correction path: reopen or change thread status
Keyboard path: tab through status, more actions, resolve, and reply
Information that belongs elsewhere: a dedicated toolbar row repeating thread controls
Blessed pattern: quiet identity row with compact icon actions
Complexity budget: one identity/action row plus content and composer
Pass/fail: Fail before implementation; a full-width toolbar outranks author and comment content

## Attention Brief

Primary user: project collaborator reviewing a comment
Primary job: read context and respond quickly
Primary decision: whether to reply, change status, or resolve
Tier 1: author, time, comment, attachment, reply
Tier 2: status, resolve, more actions
Tier 3: none
Hide until requested: status choices and overflow actions
Remove: dedicated header band and textual `Open` pill
Primary action: reply
Failure-loudly behavior: a focused contract test fails if Velt selector ownership drifts

## Done Checklist

- [x] User-provided exact browser target and current owning code inspected before edits.
- [x] Root cause established from browser evidence and shared Velt integration code.
- [x] Dedicated dialog toolbar row is visually removed.
- [x] Status is represented by a compact semantic color indicator with native choices available on hover/focus/click.
- [x] Resolve and overflow actions align with author identity in one row.
- [x] Avatar is smaller and uses the best available profile/auth/Gravatar image before initials fallback.
- [x] Keyboard focus and native Velt action behavior remain available.
- [x] Focused regression coverage protects selectors, hierarchy, and avatar fallback.
- [x] Impeccable noise gate and targeted checks pass.
- [x] Authenticated desktop browser evidence confirms the after-state.
- [x] Evidence and closeout status are recorded below.

## Files Expected To Change

- `frontend/src/app/globals.css`
- `frontend/src/components/velt/VeltAuthProvider.tsx`
- focused Velt tests
- `docs/ops/evidence/2026-07-13-velt-comment-dialog-header-polish/**`
- `docs/ops/handoffs/2026-07-13-S132-velt-comment-dialog-header-polish.md`
- `docs/ops/orchestration/session-board.md`

## Evidence

| Check | Command / Artifact | Result | Notes |
| --- | --- | --- | --- |
| Browser baseline | User browser comment screenshot and exact selector | Fail | Dedicated toolbar row visually dominates the dialog. |
| Auth refresh | `PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm exec playwright test --config=config/playwright/playwright.config.ts --project=setup` | Pass | Protected `/tasks` route accepted the saved session. |
| Focused tests | `pnpm --dir frontend exec jest --runInBand --runTestsByPath src/components/velt/__tests__/velt-dialog-polish.test.ts src/lib/users/__tests__/current-user-profile-server.test.ts` | Pass | 2 suites, 6 tests. |
| Targeted lint | `pnpm --dir frontend exec eslint` on six task-owned TS/TSX files | Pass | No findings. |
| Impeccable complexity audit | `audit-surface-complexity.mjs` on four task-owned UI files | Pass | All surfaces passed the noise/complexity checks. |
| Browser row geometry | Authenticated Playwright read-back | Pass | Header actions and author row share `y=191`, both `28px` high; avatar is `24px`. |
| Browser status behavior | Hover the status indicator | Pass | Text `Open` is hidden; native status menu opened with Open, In Progress, and Resolved. |
| Browser after-state | `docs/ops/evidence/2026-07-13-velt-comment-dialog-header-polish/after-dialog.png`, `after-status-hover.png` | Pass | Exact root-page annotation verified at 1289x1009. |

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Remaining risks and next action are explicit.

## Noise Gate Closeout

Noise gate: Pass
Top noise sources: dedicated toolbar band, textual status pill, oversized initials avatar
Removed or simplified: toolbar band removed; status reduced to a semantic dot; action controls aligned with identity; avatar reduced from 32px to 24px
Remaining risk: historical Velt comments without a stored photo still use initials until that author's Velt profile is refreshed; vendor DOM may change between SDK releases
Regression guardrail: focused selector/hover/avatar tests plus a runtime warning and vendor-layout fallback if the confirmed DOM contract drifts
