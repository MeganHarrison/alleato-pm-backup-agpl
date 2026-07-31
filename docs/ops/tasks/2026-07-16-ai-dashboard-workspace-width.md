# Task: Widen AI Dashboard Workspace Canvas

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1121
Linear Issue: [AAI-1121](https://linear.app/megankharrison/issue/AAI-1121/widen-the-shared-ai-dashboard-workspace-canvas)
Related Handoff: `docs/ops/handoffs/2026-07-16-S162-ai-dashboard-workspace-width.md`

## Objective

Increase the usable desktop width of the AI Dashboard workspace and every child page through the shared shell, while preserving mobile navigation, content order, interaction behavior, and overflow safety.

## Scope

- Owner: `frontend/src/app/(main)/ai-dashboard/workspace-shell.tsx`.
- Regression guard: `frontend/src/app/(main)/ai-dashboard/__tests__/workspace-pages.test.tsx`.
- Exact visual proof: `/ai-dashboard/architecture` at desktop and mobile widths.
- Excluded: page-local width overrides, content redesign, navigation changes, and data behavior.

## Source of Truth

- Canonical workspace owner: `AiDashboardWorkspaceShell`.
- Outer dashboard width contract: `PageShell` dashboard variant at `max-w-[1800px]`.
- Existing responsive behavior: mobile horizontal navigation and desktop two-column workspace grid.
- Shared detail interaction: `SplitPageFrame`, `SplitPage`, and `useSplitPage` remain unchanged.

Verification contract: Required

## Attention Architecture

- Primary user: executive reviewing AI Dashboard child pages on a desktop display.
- Primary job: inspect dense architecture, project, accounting, and pipeline content without unnecessary unused margins.
- Primary decision: understand the current page with more horizontal room for primary content.
- Tier 1: child-page content canvas.
- Tier 2: workspace navigation.
- Tier 3: outer gutters and supporting spacing.
- Hidden until requested: no new content.
- Removal candidates: excess desktop-only gutter, rail width, and column gap.
- Primary action: existing page interaction remains unchanged.
- Failure-loudly behavior: browser geometry proves desktop width gain and mobile overflow readback remains zero.

## Acceptance Criteria

- [x] All AI Dashboard child pages inherit the wider layout from one shared shell.
- [x] The workspace maximum width aligns with the existing 1800px dashboard contract.
- [x] Desktop gutters, rail width, and column gap are reduced without compressing touch targets or labels.
- [x] Mobile layout, mobile navigation, and split-page behavior remain unchanged.
- [x] The exact Architecture route gains measurable main-content width at desktop.
- [x] The exact Architecture route has no horizontal overflow at 390px.

## Implementation Checklist

- [x] Full task process, Linear issue, session claim, and owned paths are established before code edits.
- [x] Reuse the shared workspace shell; add no page-local override or new component.
- [x] Add a focused regression assertion for the shared responsive width contract.
- [x] Preserve database, provider, auth, permission, and deployment contracts.

## Integration and Verification

- [x] Focused workspace tests pass.
- [x] Targeted lint and changed-file quality checks pass.
- [x] Impeccable surface and split-page audits pass.
- [x] Desktop and mobile browser readbacks pass on the exact Architecture route.
- [x] Desktop and mobile screenshots are captured and visually reviewed.
- [x] Independent reviewer approves the scoped layout change.
- [x] Verification manifest/result pair passes with `--require-pass`.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: desktop main content does not gain width, or mobile document width exceeds viewport width.
- Detection path: computed browser geometry at desktop and 390px, focused shell assertion, responsive screenshots, and independent review.
- Recovery path: revert the shared shell spacing token change, correct the canonical layout owner, and rerun exact-route proof.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A; this is an explicit layout improvement.
- Detection gap: N/A.
- Prevention: keep dashboard width in the shared workspace owner and cover its responsive contract in the focused workspace test.
- Guardrail evidence: focused Jest, browser geometry, responsive screenshots, and verification contract.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1121 and S162 | Pass | Shared owner and exact proof route declared before edits. |
| Focused regression | AI Dashboard workspace Jest | Pass | 7/7 tests, including the shared width contract. |
| Targeted static checks | ESLint and `git diff --check` | Pass | No task-owned lint or whitespace failures. |
| Impeccable audits | Surface complexity and split-page consistency | Pass | Shared shell and existing Architecture split pattern remain compliant. |
| Desktop browser proof | `browser-proof.md`, `architecture-desktop-wide.png` | Pass | Main canvas 1072px to 1120px at 1440px; 1800px canvas and 1536px main content at 1920px. |
| Mobile browser proof | `browser-proof.md`, `architecture-mobile-wide.png` | Pass | Document/body width 390px, desktop rail hidden, mobile navigation visible. |
| Independent review | `independent-review.md` | Approved | Shared ownership, width gain, responsive safety, and no-noise scope approved. |
| Verification contract | `verify:contract --require-pass` | Pass | PASS is supported by declared evidence. |
| Screenshot comments | AAI-1121 attachments `2df6cfa7-23aa-43be-a81b-c05e12d2320a`, `7a6e04e5-a3c4-4505-a746-b0696aa6ae43` | Pass | Exact desktop and mobile results are viewable on the task. |
| Publication | `npm run codex:finish -- --message "Widen AI dashboard workspace" --staged-only ...` | Pass | Revision `eead025a0735d2f10ab31e254eb257131ae6688d` published to `origin/main` with scoped readback. |
| Linear closeout | Completion comment `65310cc0-547f-44a1-a270-61de316333cb` | Pass | Evidence summary posted and AAI-1121 moved to Done. |

## Remaining Risk

- Wider desktop content may expose weak page-local layouts on other child pages. Owner: AI Dashboard workspace. Next action: exact-route Architecture proof plus shared-shell regression; follow-up pages only if a concrete visual defect appears.

## Browser Comment Follow-up: Main Content Gutters

- [x] Add desktop-only responsive horizontal padding to the shared `<main>` owner.
- [x] Keep mobile gutter, navigation, content order, and split-page behavior unchanged.
- [x] Extend the focused shared-shell regression for the inner-gutter contract.
- [x] Prove the selected Architecture content has visible left/right breathing room at desktop.
- [x] Prove the 390px route remains free of horizontal overflow.
- [x] Capture exact desktop/mobile screenshots and attach them to AAI-1121.
- [x] Independent review and verification contract pass.
- [x] Publish the scoped follow-up and confirm `HEAD == origin/main`.

Follow-up cause: the wider shared canvas correctly increased usable width, but the child `<main>` still had no desktop horizontal inset. The browser comment exposed the missing hierarchy between the workspace rail and child content.

Follow-up evidence: `architecture-desktop-padded.png`, `architecture-mobile-padded.png`, `browser-proof.md`, `padding-independent-review.md`, AAI-1121 attachments `6fcd3529-c16d-4e0f-acdf-8598beb77872` and `be523eba-3e59-4a2a-8fe5-ba6dab475291`, and milestone comment `061fa025-77fc-401a-85f9-1e28375deb29`.

Follow-up publication: revision `2dd9c34d27626daace394577729acb52d00d395e` published the responsive shared-main gutters, exact screenshots, regression guard, and independent review to `origin/main`. Completion comment `e753d8d1-d47d-461e-9015-56e3d95c272f` returned AAI-1121 to Done.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred work includes cause, detection gap, prevention, owner, and next action.
