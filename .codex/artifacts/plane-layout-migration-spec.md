# Spec: Plane-Inspired Shared Work Surfaces and Tasks Pilot

## Problem Statement

Alleato PM contains mature construction workflows, but its page layouts and interaction patterns are not yet as cohesive, compact, or context-preserving as the Plane reference application. Users frequently move between navigation, tables, boards, filters, and record details. When these capabilities are split across separate page compositions, users lose search and filter context, repeat navigation, and experience inconsistent controls between modules.

The problem is not the absence of individual components. Alleato already has a permission-aware application shell, a shared table system, kanban behavior, task details, command interfaces, and side-panel primitives. The problem is that these owners are not yet composed into one consistent work-surface pattern that modules can reuse.

Alleato needs a shared layout grammar that provides:

- Dense, understandable company and project navigation
- A compact contextual page header
- Multiple appropriate views over the same records
- Persistent search, filter, sort, and view state
- Record inspection without losing the surrounding list or board
- Fast creation and keyboard-assisted workflows
- Visible recovery when loading or mutation operations fail
- Responsive behavior that remains useful on mobile

The implementation must preserve Alleato's construction vocabulary, permissions, workflows, brand, and canonical shared component ownership. Plane is an interaction reference only. Its source must not be copied or adapted into Alleato.

## Solution

Create a reusable Alleato work-surface composition that extends the existing application shell and shared design system. The work surface will combine a compact contextual header, view switching, shared query controls, a canonical content region, and a route-aware record inspector.

Use project Tasks as the first implementation because Alleato already has both table and kanban representations. The current task experiences will be unified under one canonical Tasks route with List and Board views backed by the same task query, filters, permissions, and record-detail experience.

The Tasks pilot will include:

- A single Tasks page and primary `New task` action
- List and Board view switching without route or context loss
- Shared search, status, assignee, priority, due-date, and sort controls
- URL-persisted shareable view state
- Inline task creation where it shortens the workflow
- A route-aware task peek panel that preserves the underlying view
- Existing optimistic board movement with visible rollback and retry behavior
- Responsive desktop, tablet, and mobile layouts
- Keyboard-accessible navigation and actions
- Loading, empty, permission, and failure states that explain what happened and how to recover

The shared work-surface pattern will be designed for later adoption by RFIs, Submittals, Change Events, Commitments, Prime Contracts, and cross-project work. Those modules will use only the views that improve their domain workflow. A board is not required for every record type.

The design will retain Alleato's orange accent and current typography while adopting Plane's useful density, neutral surface hierarchy, compact controls, and context-preserving interactions. It will not reproduce Plane's blue palette, product terminology, or source structure.

## User Stories

1. As a project team member, I want Tasks to open in one consistent work surface, so that I do not have to learn separate layouts for list and board work.
2. As a project team member, I want to switch between List and Board views without navigating to another page, so that I can choose the representation that fits my current task.
3. As a project team member, I want my search query to remain active when I switch views, so that I do not have to repeat the same search.
4. As a project team member, I want my filters to remain active when I switch views, so that both views represent the same task set.
5. As a project team member, I want the selected view to be reflected in the URL, so that refreshing or sharing the page preserves the intended view.
6. As a project team member, I want search, filter, sort, and view state to survive browser navigation, so that Back and Forward behave predictably.
7. As a project team member, I want to open task details without losing my position in the list, so that I can inspect several tasks efficiently.
8. As a project team member, I want to open task details without losing my board column and scroll context, so that I can continue triage after closing the task.
9. As a project team member, I want browser Back to close the open task inspector before leaving Tasks, so that navigation follows my mental model.
10. As a project team member, I want one clearly identified `New task` action, so that I am not distracted by duplicate calls to action.
11. As a project team member, I want to create a task from the context where I am working, so that capture is fast and the task enters the correct project.
12. As a project team member, I want required fields and validation errors explained next to the affected task fields, so that I can correct the submission.
13. As a project team member, I want to search tasks by meaningful task text, so that I can find work without scanning every row or card.
14. As a project team member, I want to filter by status, so that I can focus on work at a particular stage.
15. As a project team member, I want to filter by assignee, so that I can review my work or another team member's workload.
16. As a project team member, I want to filter by priority, so that urgent work is easier to isolate.
17. As a project team member, I want to filter by due date, so that I can find overdue and upcoming work.
18. As a project team member, I want to sort the List view using the established table behavior, so that Tasks remains consistent with other Alleato tables.
19. As a project team member, I want the Board view to group tasks by their workflow status, so that I can understand work progression.
20. As a project team member, I want to move a task between permitted board columns, so that I can update status directly.
21. As a project team member, I want a failed board movement to return the task to its confirmed column, so that the interface never presents an unconfirmed state as saved.
22. As a project team member, I want a failed task update to name the failed action and offer recovery, so that I know whether to retry or revise the change.
23. As a project team member, I want unauthorized task actions to be unavailable or clearly denied, so that permissions are consistent across List, Board, and the inspector.
24. As a project administrator, I want existing project permissions to remain authoritative, so that the layout migration does not widen data or mutation access.
25. As a project team member, I want loading indicators to preserve the page structure, so that the interface does not jump unpredictably.
26. As a project team member, I want an empty state that explains that no tasks match the current context, so that I can distinguish an empty project from an active filter.
27. As a project team member, I want to clear active filters easily, so that I can recover from an empty filtered result.
28. As a keyboard user, I want view controls, filters, task rows, task cards, and inspector actions to be reachable by keyboard, so that the workflow does not require a pointer.
29. As a keyboard user, I want visible focus states and predictable focus restoration when the inspector closes, so that I do not lose my position.
30. As a screen-reader user, I want view controls and task state changes to have meaningful accessible labels, so that the interface communicates structure and results.
31. As a mobile project team member, I want Tasks to use the existing mobile navigation and a compact control layout, so that the page remains usable on site.
32. As a mobile project team member, I want task details to open as a full-screen detail experience, so that the content is readable without squeezing the board or list.
33. As a tablet user, I want the sidebar and task inspector to behave as overlays when space is limited, so that the primary task view remains usable.
34. As a project team member, I want the application sidebar to communicate company, project, and tool hierarchy clearly, so that I always understand my current context.
35. As a project team member, I want a compact contextual header, so that more vertical space remains available for project records.
36. As a project team member, I want sidebar resizing and collapse behavior to be remembered, so that the application matches my preferred working density.
37. As a project team member, I want favorite or pinned destinations to use existing permissions and navigation definitions, so that shortcuts never expose unavailable tools.
38. As a project team member, I want command-palette navigation to reach the same canonical destinations and actions as visible navigation, so that keyboard and pointer workflows remain consistent.
39. As a product owner, I want later modules to reuse the same work-surface owner, so that layout improvements propagate rather than creating page-specific variants.
40. As a product owner, I want each module to adopt only domain-appropriate views, so that Plane-inspired behavior does not override construction workflow needs.
41. As a product owner, I want the interface to preserve Alleato's visual identity, so that the result feels like an improved Alleato product rather than a reskinned Plane clone.
42. As a product owner, I want decorative panels, nested cards, duplicate actions, and unnecessary summaries removed, so that the primary workflow receives the available space.
43. As a support user, I want errors to identify whether loading, permission, validation, or saving failed, so that I can give users specific recovery guidance.
44. As an engineer, I want List and Board to consume one normalized task-query contract, so that the two views cannot silently drift.
45. As an engineer, I want record selection and view state to use one shared contract, so that future modules can reuse the same integration pattern.
46. As an engineer, I want shared layout behavior documented and demonstrated in an isolated example, so that later implementations do not copy page markup.
47. As a release owner, I want desktop and mobile visual evidence from the authenticated production-shaped route, so that deployment readiness is based on rendered behavior.
48. As a release owner, I want production verification to confirm the deployed commit and authenticated Tasks journey, so that a successful build alone is not treated as proof.
49. As a release owner, I want a reversible pilot release, so that the previous Tasks composition can be restored if production behavior regresses.
50. As a product owner, I want the old composition removed after acceptance, so that Alleato does not maintain two permanent Tasks implementations.

## Implementation Decisions

- The work will be implemented as an Alleato-owned design-system evolution. Plane remains a visual and interaction reference and will not become a runtime dependency.
- No Plane component, source file, source-derived JSX, or copied styling will be introduced because Plane's AGPL license is incompatible with treating its implementation as proprietary Alleato source without accepting the associated obligations.
- Existing shared owners will be extended before any new abstraction is introduced. The canonical application shell, page shell, navigation configuration, table system, kanban implementation, task detail experience, side-panel primitives, and command infrastructure remain authoritative.
- A shared work-surface composition will own the contextual header, view controls, query controls, content area, and optional record inspector.
- The work surface will be a normal Alleato application-shell composition. It will not create a separate full-bleed application or page-local shell.
- The compact contextual header will target the same high-density character as the Plane reference while preserving accessible control sizes and responsive wrapping.
- The sidebar will continue to derive destinations from the canonical permission-aware navigation configuration. Resizing, collapse behavior, favorites, or recents must not introduce a second navigation registry.
- Alleato's orange accent and current typography will remain. Only missing semantic tokens for canvas, surface, selected state, muted content, dividers, and compact density will be added.
- Borders will not be used as the primary hierarchy mechanism. Spacing, typography, muted text, indentation, row dividers, and tonal surfaces will be preferred.
- The Tasks route will be the canonical entry point for both List and Board. The existing separate board experience will be composed into this route rather than maintained as a permanent alternate page.
- The List view will remain owned by the shared Alleato table architecture, including its sorting, filtering, column, density, selection, and keyboard conventions.
- The Board view will remain owned by the existing shared kanban and task workflow implementation.
- Both views will consume one normalized task query and mutation contract.
- View, search, filter, and sort state will be represented in canonical URL parameters. Temporary presentation state will remain local.
- The initial URL contract will support view, search, status, assignee, priority, due-date, and sort values.
- Unknown or invalid URL values will fall back to safe defaults and will not crash the page.
- Record selection will be route-aware. Opening a task will update navigable state, and browser Back will close the inspector before leaving the Tasks surface.
- Closing the inspector will restore focus to the initiating row or card when that element still exists.
- Desktop will use a persistent application sidebar and an optional adjacent task inspector.
- Tablet will use collapsible navigation and an overlay inspector where needed to preserve content width.
- Mobile will retain the existing mobile navigation and present task detail as a full-screen experience.
- Task creation will have one primary action. Inline creation may also exist inside the active task workflow when it shortens capture, but it must not appear as a competing page-level primary action.
- Existing task validation, authorization, and mutation boundaries will be reused.
- Optimistic board mutations will retain the last confirmed task state. Failure will restore that state, identify the failed action, and provide a retry path when retry is safe.
- Loading, empty, no-results, permission, validation, and mutation failure states will be distinct and user-readable.
- The first pilot will not require a database schema change.
- Persisted saved views, if later approved, will use one cross-module user-view-preferences model rather than module-specific storage.
- The work-surface foundation will be reusable by RFIs, Submittals, Change Events, Commitments, Prime Contracts, and cross-project work.
- Each later module will adopt only views justified by its domain. List plus inspector may be the complete pattern for contract records.
- The implementation will follow the Alleato product noise gate. Decorative wrappers, nested cards, KPI rows, duplicate actions, unsolicited helper panels, and visual filler are prohibited.
- The release will use the existing Vercel frontend pipeline. Existing backend and Supabase ownership will remain unchanged for the pilot.
- A temporary route-level feature flag is permitted only if an atomic Tasks replacement cannot be released safely. It must provide one-step rollback and must be removed after acceptance.
- The previous Tasks composition will remain recoverable until the pilot passes production verification. It will then be removed to prevent parallel permanent implementations.

## Testing Decisions

- Tests will assert external behavior rather than component structure, class names, hook call counts, or internal state shape.
- The highest-value test seam is one authenticated project Tasks user journey covering both views and the task inspector. This is the primary acceptance seam.
- The primary end-to-end journey will:
  1. Open project Tasks in List view.
  2. Apply search and at least one filter.
  3. Open a task in the inspector.
  4. Close the inspector and verify list position and filters remain.
  5. Switch to Board and verify the same filtered task set.
  6. Move a permitted task to another status.
  7. Reload and verify the confirmed view and task state.
- A focused failed-mutation journey will intercept or induce a rejected board move, then verify that the task returns to its confirmed column and that the user sees a specific recovery message.
- Focused component or integration tests will cover URL-state parsing, safe fallback for invalid parameters, serialization, and preservation across view switches.
- Focused accessibility tests will cover keyboard reachability, visible focus, view-control semantics, inspector focus restoration, and accessible status-change announcements.
- Permission tests will verify that List, Board, inline creation, task detail, and command actions honor the same existing permission boundary.
- Responsive browser verification will cover:
  - Desktop with persistent sidebar and inspector
  - Tablet with overlay behavior
  - Mobile with existing navigation and full-screen task detail
- Visual regression evidence will be captured from current rendered routes rather than inferred from source or HTTP status.
- Existing table tests are prior art for list filtering, sorting, URL state, keyboard behavior, and selection.
- Existing task kanban tests and behavior are prior art for grouping, optimistic movement, and task mutation.
- Existing side-panel and detail-flow tests are prior art for route-aware record inspection and focus handling.
- Existing authenticated frontend journey conventions are prior art for production-shaped route verification.
- The pilot acceptance test should remain the smallest high-level seam that proves the feature. Additional lower-level tests are warranted only for contracts that are difficult to reproduce deterministically at the browser seam.
- Production verification must confirm:
  - The intended commit is deployed to the production Vercel project
  - The authenticated Tasks route renders
  - List and Board switch without context loss
  - Task inspection preserves the underlying view
  - A real permitted task mutation succeeds and remains after reload
  - Desktop and mobile screenshots represent the deployed result

## Out of Scope

- Copying or adapting Plane source code, components, stylesheets, icons, or proprietary product terminology
- Rebranding Alleato to look identical to Plane
- Replacing Alleato's orange brand accent
- Replacing the existing table or kanban systems
- Rewriting task APIs, task validation, task permissions, or the task data model without evidence that an existing contract blocks the pilot
- Introducing a new backend host or moving frontend hosting away from Vercel
- Hostinger changes for the Alleato application
- Database schema changes for the initial Tasks pilot
- Server-persisted saved views in the initial pilot
- A calendar or schedule Tasks view in the initial pilot
- Adding board views to modules where board movement has no valid domain meaning
- Migrating RFIs, Submittals, Change Events, Commitments, Prime Contracts, or cross-project work in the same implementation slice
- Reworking unrelated dashboards, forms, detail pages, or public documentation
- Maintaining the old and new Tasks compositions permanently

## Further Notes

- The recommended rollout after Tasks is RFIs, Submittals, Change Events, Commitments and Prime Contracts, followed by cross-project work, favorites, recents, and saved views.
- RFIs are the preferred second module because their table experience is already the Alleato reference implementation.
- The Tasks pilot should be treated as a Standard delivery slice unless implementation changes permissions, schema, deployment configuration, or another high-risk boundary.
- The visual goal is not a clone. The goal is a quieter, denser, faster Alleato work surface that feels native to construction project management.
- The key guardrail is ownership: every improvement must strengthen a shared owner so the next module can adopt the pattern without copied markup or page-local overrides.
- The failure-loudly standard is: a user can always distinguish unsaved optimistic state from confirmed server state, understands what failed, and has a safe recovery action.
- The durable regression guardrail is the authenticated List-to-Board-to-inspector journey combined with shared URL-state and mutation-rollback tests.
