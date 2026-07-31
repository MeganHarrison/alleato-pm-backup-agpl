# Task: AI Features Table

Status: Complete
Owner: Codex
Created: 2026-07-24
Task ID: ai-features-table
Linear Issue: Not requested
Related Handoff: Not required for this Standard single-session task

## Objective

Provide a discoverable, user-facing table of live AI workflows with direct navigation.

## Scope

- Add `/ai/features` using the shared `UnifiedTablePage` pattern.
- Add the canonical navigation entry and a separate AI-features table configuration.
- Exclude the owner-only roadmap and the administrative agent registry.

## Source of Truth

- Canonical runtime/data owner: Existing user-facing AI routes under `frontend/src/app/(main)/ai/`.
- Existing shared primitives/services: `frontend/src/components/tables/unified/`, `frontend/src/lib/navigation-config.ts`.
- Deprecated or parallel paths: `/ai/admin/agents` is an administrative registry, not a user feature catalog.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The feature catalog uses `UnifiedTablePage` and URL-synced search, sorting, category filtering, and column preferences.
- [x] Each row navigates to the canonical live workflow; no dead selection or destructive controls are rendered.
- [x] The catalog is discoverable through the company-wide navigation.
- [x] The UI uses a quiet table, without page-level cards, summary tiles, or decorative controls.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared table and navigation abstractions own cross-cutting behavior.
- [x] The empty state identifies the missing catalog result and recovery path.
- [x] Targeted verification and browser evidence are recorded.

## Failure-Loudly Contract

- Cause surfaced as: A specific empty state when no feature matches the current search or category.
- Detection path: Targeted lint, route check, and authenticated browser rendering of `/ai/features`.
- Recovery path: Clear the current filters or open a canonical feature route from a matching row.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: The catalog derives links from a typed local configuration and row navigation uses the same canonical `href`.
- Guardrail evidence: Targeted static checks and browser navigation proof.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Targeted lint | `npx eslint src/app/(main)/ai/features/page.tsx src/features/ai/ai-features-table-config.tsx src/lib/navigation-config.ts` | Pass | Ran from `frontend/` after installing isolated-workspace dependencies. |
| Route contract | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Changed-code type guard | `npm run typecheck:changed` | Pass | No new `any` type debt. |
| Authenticated desktop rendering | `/tmp/ai-features-table-desktop.png` | Pass | Six live workflows render in the shared table; screenshot captured at 1440px wide. |
| User flow | Authenticated browser at `http://localhost:3013/ai/features` | Pass | Search narrowed to Approval queue; its row navigated to `/ai/approvals`; `?category=knowledge` showed Skill library and Teach Alleato only. |
| Publication | `npm run codex:finish -- --session S019f9539 ...` | Pass | Published exact task-owned paths to `origin/main` at `f298fa879445deab6c96584743b18b540616ebce`. |

## Remaining Risk

- The catalog is intentionally a curated list of user-facing live workflows; future routes must be added to the typed configuration when they become user-facing.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No deferred work.
