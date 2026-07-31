# Task: Mobile Sidebar Navigation Redesign

Status: Complete
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-889 - https://linear.app/megankharrison/issue/AAI-889/redesign-mobile-sidebar-navigation-shell
Related Handoff: N/A

## Objective

Redesign the mobile sidebar navigation to model the provided drawer screenshot while preserving Alleato's shared navigation ownership, compact product hierarchy, and quiet operational UI rules.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Design Doctrine Gate

Surface: Mobile sidebar sheet
One purpose: Navigate between project/company tools without losing current page context
Primary user job: Open the drawer, recognize the current project/user context, and move to the right tool
Primary action: Select a navigation destination
Secondary actions: Switch between project tools and company tools; open account menu
Next action after success: Drawer closes through normal navigation and destination page loads
Correction path: Reopen drawer, use Project tools / Company tools switch, or close with Escape/outside tap
Keyboard path: Sidebar trigger opens the sheet, tab moves through nav items, Enter activates links/buttons, Escape closes the sheet
Information that belongs elsewhere: Upsell cards, metrics, announcements, dashboards, and long helper copy
Blessed pattern: Shared sidebar/sheet navigation surface using existing `AppSidebar` and `Sidebar` primitives
Complexity budget: One header/context block, one primary navigation list, footer/account controls
Pass/fail: Pass

## Noise Gate Brief

Primary user: Mobile Alleato project user
Primary job: Move to the next project/company tool quickly
Primary decision: Which tool should I open next?
Tier 1: Current context, active route, navigation destinations
Tier 2: Project/company tool switch, account access
Tier 3: Group labels and secondary tools
Hide until requested: Full account settings, development/admin-only internals, detailed project metadata
Remove: Decorative promo/upgrade card, duplicate CTAs, metrics, helper panels
Primary action: Tap a nav row
Failure-loudly behavior: Missing project context keeps project selector visible instead of rendering broken links

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
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] Mobile sidebar uses the shared `Sidebar` sheet primitive and shared `AppSidebar` nav data.
- [x] Mobile drawer presents account/project context without decorative cards or promo content.
- [x] Active route treatment and grouped navigation remain scannable on a phone viewport.
- [x] Project/company tool switching still works from the mobile drawer.
- [x] Desktop sidebar behavior remains unaffected.

## Regression Guardrails

- [x] Design-doctrine surface audit run on changed UI files.
- [x] Targeted lint/static check run for touched sidebar files.
- [x] Existing or targeted mobile shell coverage reviewed or updated where practical.
- [x] Browser artifact captured for the actual mobile sidebar surface.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run or documented as not practical for this slice.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Acceptance Criteria

- [x] Mobile sidebar visually models the screenshot's focused drawer structure while staying Alleato-minimal.
- [x] Drawer has a clear top context block and compact grouped navigation.
- [x] Active route has obvious but restrained visual weight.
- [x] No nested cards, decorative wrapper panels, promo cards, stat cards, or duplicate primary actions are introduced.
- [x] The change is shared, not page-local.
- [x] Mobile open, close, and destination activation are verified.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| DB/provider read-back | N/A | Pass | No schema, migration, provider, or env changes. |
| Design doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/header/site-header.tsx frontend/src/components/nav/app-sidebar.tsx` | Pass | Both changed UI files passed. |
| Static/lint | `cd frontend && npx eslint src/components/header/site-header.tsx src/components/nav/app-sidebar.tsx` | Pass | No warnings or errors. |
| Type debt guardrail | `npm --prefix frontend run typecheck:changed` | Pass | No new `any` type debt detected. |
| Diff whitespace | `git diff --check -- frontend/src/components/header/site-header.tsx frontend/src/components/nav/app-sidebar.tsx docs/ops/tasks/2026-07-02-mobile-sidebar-navigation-redesign.md` | Pass | No whitespace errors. |
| Browser visual artifact | `docs/ops/evidence/2026-07-02-mobile-sidebar-navigation-redesign/mobile-sidebar-budget-open.png` | Pass | Mobile drawer on `/876/budget` captured at 390x844. |
| Browser open flow | `agent-browser --session mobile-sidebar-redesign click 'button[aria-label="Open menu"]'` | Pass | Drawer opened with close button, user/project context, grouped nav, active Budget row, company-tools switch, and footer profile link. |
| Browser destination flow | `agent-browser --session mobile-sidebar-redesign click 'a[href="/876/meetings"]'` | Pass | Navigated to `/876/meetings`; drawer closed with `hasDialog: 0`; Meetings page loaded with body content. |
| Browser close flow | `agent-browser --session mobile-sidebar-redesign click 'button[aria-label="Close navigation"]'` | Pass | Drawer closed on `/876/budget`; `hasDialog: 0`, open menu button visible. |

## Files Changed

- `frontend/src/components/nav/app-sidebar.tsx` - shared app navigation and mobile content treatment.
- `docs/ops/tasks/2026-07-02-mobile-sidebar-navigation-redesign.md` - task definition and evidence.

## Risks / Gaps

- Saved Playwright auth state and saved `agent-browser` auth profile were stale; direct UI login with the repo test account was required for browser proof.
- The worktree contains unrelated dirty files; closeout must use exact task-owned files.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
