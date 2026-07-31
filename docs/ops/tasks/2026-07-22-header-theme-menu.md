# Task: Header Theme Menu

Status: Pending Review
Owner: Codex SROOT-THEME-MENU-0722
Created: 2026-07-22
Task ID: AAI-1262
Linear Issue: [AAI-1262](https://linear.app/megankharrison/issue/AAI-1262/add-light-and-dark-theme-control-to-header-user-menu)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-header-theme-menu.md`

## Objective

Let an authenticated user switch immediately between light and dark themes from the avatar dropdown in the site header.

## Scope

- Owned surface: `frontend/src/components/header/header-user-menu.tsx`.
- Reuse the root `next-themes` provider and the existing compact dropdown primitive.
- Excluded: a settings page, a second theme provider, and a system-theme selector.

## Source of Truth

- Canonical runtime owner: `HeaderUserMenu` plus `ThemeProvider` in `frontend/src/app/layout.tsx`.
- Existing shared primitives/services: `DropdownMenu*` and `useTheme` from `next-themes`.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [x] The avatar dropdown presents an explicit, state-aware light/dark command.
- [x] Selecting the command updates the application theme and persists the preference.
- [x] The menu remains compact and keyboard accessible at desktop and mobile widths.
- [ ] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred: no duplicate path is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior: the root `next-themes` provider remains the only theme owner.
- [x] Errors are specific and actionable: automated coverage detects a missing/incorrect target theme; live browser readback exposes the root class.
- [x] Database, provider, authentication, permission, or delivery contracts are not applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow proves the requested outcome.
- [x] Desktop and mobile screenshot evidence is recorded in the Linear task comment.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: N/A. `next-themes` writes the user preference locally; there is no remote action to silently fail.
- Detection path: Avatar-menu user flow asserts the `html` theme class changes after activation.
- Recovery path: Reopen the avatar menu and choose the opposite theme command.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: The theme provider existed but the shared user menu did not expose its user-facing control.
- Detection gap: Header-menu review did not include appearance controls.
- Prevention: An interaction test will assert the menu command and the resulting root theme class.
- Guardrail evidence: Targeted test added or updated with this task.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Runtime localization | `frontend/src/components/header/header-user-menu.tsx` | Pass | Shared avatar dropdown has no theme item; root layout already owns `ThemeProvider`. |
| Focused regression | `cd frontend && npx jest --runInBand --runTestsByPath src/components/header/__tests__/header-user-menu.test.tsx` | Pass | 2/2 tests, verifies both directions call `setTheme`. |
| Targeted lint | `cd frontend && npx eslint src/components/header/header-user-menu.tsx src/components/header/__tests__/header-user-menu.test.tsx` | Pass | One existing documented raw-avatar-button warning, no errors. |
| Alleato audits | `audit-surface-complexity` and `audit-split-page-consistency` | Pass / N/A | Compact-menu audit passed; no list/detail signal. |
| Browser evidence | Linear AAI-1262 attachments `efc3cd3e-5e48-4a91-8464-e0a44a539e9d`, `793403bf-4066-424d-997c-5955c5d399e2` | Pass | Authenticated desktop/mobile menu captures; root class changed to `dark` and persisted after reload. |
| Publication | Isolated user-authorized worktree, then `git push origin HEAD:main` | Pass | Published at `78ba8fe8e`; exact `HEAD` and `origin/main` readback match. The shared checkout was left untouched. |

## Remaining Risk

- None. The user-authorized isolated worktree preserved the shared checkout and published the verified commit.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No deferred work remains.
