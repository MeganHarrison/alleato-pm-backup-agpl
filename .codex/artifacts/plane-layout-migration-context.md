# Plane to Alleato Layout Migration Context

## Objective

Adopt the strongest layout and interaction patterns from Plane inside the Alleato PM web application while preserving Alleato's construction workflows, permissions, brand, data model, and existing shared component ownership.

This is an independent Alleato implementation. Plane is a design and interaction reference, not a source-code dependency.

## Source Reference

- Live reference: `https://plane-ipz7.srv1379426.hstgr.cloud/`
- Local reference clone: `C:\Users\KimiClaw\plane-alleato-reference`
- Target application: `C:\Users\KimiClaw\alleato-pm-backup\frontend`
- Plane license: AGPL-3.0-only. Do not copy Plane components or adapt source directly into Alleato.

## Plane Patterns Worth Migrating

1. A dense, resizable navigation rail with clear company, project, favorite, and recent-work hierarchy.
2. A compact contextual header that keeps breadcrumbs, current view, filters, and primary action close together.
3. Multiple views over the same records, especially list and board, without changing routes or losing filters.
4. URL-persisted view, filter, sort, and selection state.
5. A record peek panel that preserves the list or board context behind it.
6. Fast inline creation, keyboard navigation, and command-palette access.
7. Quiet neutral surfaces, restrained dividers, compact typography, and high information density.

## Existing Alleato Owners to Reuse

| Plane pattern | Alleato owner | Migration action |
| --- | --- | --- |
| Workspace/project sidebar | `frontend/src/components/nav/app-sidebar.tsx`, `frontend/src/components/ui/sidebar.tsx`, `frontend/src/lib/navigation-config.ts` | Extend the existing permission-aware sidebar with resize, favorites, and improved hierarchy. Do not duplicate navigation JSX. |
| Compact app header | `frontend/src/app/(main)/layout.tsx`, `frontend/src/components/layout/page-shell.tsx` | Add a shared compact work-surface mode while keeping the normal Alleato app shell. |
| Spreadsheet/list view | `AleatoDataTable`, `useDataTable`, `PageShell variant="table"` | Keep the current table system as the canonical list owner. Add adapters around it rather than importing Plane's grid. |
| Board view | `frontend/src/features/tasks/tasks-kanban-page.tsx`, shared kanban primitives | Reuse the existing optimistic drag-and-drop implementation. |
| Record peek | Existing `UnifiedSlideover`, `SidePanel`, detail layout, and domain detail components | Standardize one route-aware record inspector instead of building page-specific drawers. |
| Command workflow | Existing command components and command-center hooks | Connect navigation and record actions to the shared command system. |
| View state | Current URL-state table hooks and query adapters | Establish one shared view-state contract for list, board, filters, sorting, and search. |

## Technical Baseline

- Next.js 15.5
- React 19
- Tailwind CSS 4
- Existing Alleato token system and Inter typography
- Vercel remains the frontend production host
- Existing Supabase and application APIs remain the data source
- No new provider, backend host, or database migration is required for the first UI pilot

## Product Mapping

Plane concepts should be translated only when the construction meaning is valid:

| Plane | Alleato |
| --- | --- |
| Workspace | Company |
| Project | Project |
| Issue/work item | Task or the active domain record, such as an RFI, submittal, or change event |
| Views | List, board, schedule, or another domain-appropriate representation |
| Favorites | Pinned tools, projects, or saved views |
| Pages | Project knowledge or documents |

Do not rename construction records to Plane terminology. Cycles and modules should not be introduced unless a construction workflow explicitly needs an equivalent.

## Design Constraints

- Keep Alleato's orange brand accent; migrate Plane's density and hierarchy, not its blue palette.
- Use semantic canvas, surface, selected, muted, and divider tokens instead of page-local colors.
- Preserve `PageShell` as the canonical page entry point.
- No nested cards, decorative dashboards, wrapper panels, duplicate primary actions, or page-level visual overrides.
- All new behavior must be implemented through shared primitives or shared layout variants.
- Desktop and mobile states need current browser screenshots when implementation begins.
- Failures for loading, mutation, permissions, and optimistic updates must be visible and recoverable.

## Recommended Pilot

Use project Tasks as the first migration slice because Alleato already owns both a table view and a kanban view.

The pilot should unify the current task list and kanban experience under one `/[projectId]/tasks` work surface with:

- List and Board view switcher
- Shared search and filters
- URL-persisted view state
- One `New task` action
- Inline quick creation
- Route-aware task peek panel
- Existing optimistic board movement with visible rollback errors
- Responsive navigation and inspector behavior

This pilot validates the system without inventing a new domain model or replacing Alleato's mature table architecture.

## Deferred Decisions

- Whether saved views are initially browser-local or persisted per user in Supabase
- Whether sidebar favorites ship in the pilot or the second rollout
- Whether calendar/schedule becomes the third task view
- Which domain follows Tasks: RFIs are recommended because their table implementation is already the reference standard
