# Spec: Plane-Derived Shared Work Surfaces and Tasks Program

## Supersession Notice

This document is the authoritative Plane-to-Alleato program specification as of
2026-07-31. It supersedes the earlier clean-room strategy recorded in
`plane-layout-migration-context.md`, `plane-layout-migration-plan.md`, and the
original AAI-1286 implementation decisions.

The user explicitly accepted the GNU Affero General Public License obligations
and directed the implementation to reuse Plane source and page templates
directly, adapt them to the Alleato Next.js application, and connect them to
Alleato's existing Supabase-backed data, permissions, and mutations. Every
deployed Plane-derived slice must preserve required copyright and license
notices and provide remote users a prominent path to the exact corresponding
modified source for the combined deployment.

The replacement surfaces are built on new `/[projectId]/plane/*` routes. Legacy
Alleato pages remain intact until their replacements pass production-shaped
functional and visual verification. Retirement is a deliberate follow-up, not
an automatic consequence of rendering a replacement route.

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

The implementation must preserve Alleato's construction data, permissions, and
mutation boundaries while using Plane's source, page templates, layout,
terminology where appropriate, and interaction structure as the starting
point. Alleato-specific adapters may change data and authorization contracts,
but they must not silently replace the Plane-derived page composition with the
legacy Alleato composition.

## Solution

Create a reusable Plane-derived workspace shell and new replacement page
templates. The shared shell owns workspace and project navigation, a compact
command header, responsive mobile navigation, the content canvas, and the
corresponding-source link. Each page template owns its Plane-derived header,
controls, states, and interactions while consuming Alleato data through a
documented adapter boundary.

Use project Tasks as the first data and mutation boundary because Alleato
already has both table and kanban representations. The replacement is exposed
as `/[projectId]/plane/work-items`, with List and Board backed by the same task
query, filters, permissions, and record-detail experience. The legacy
`/[projectId]/tasks` page remains separate until AAI-1292 acceptance and
retirement.

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

The visual target is high fidelity with the deployed Plane reference at desktop
and mobile widths. Alleato data, project names, permissions, and required source
offer are expected differences. Other visual or interaction differences must be
listed explicitly in the slice evidence rather than described as intentional
brand customization by default.

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
31. As a mobile project team member, I want Work Items to use the Plane-derived mobile navigation and a compact control layout, so that the page remains usable on site.
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

- Plane revision `39856932cd6b9bd17eab0920506d628190b47af2`
  (`v1.4.0-rc1-11`) is the recorded source baseline for the first replacement
  templates. Each derivative file or feature must preserve its source mapping,
  copyright notice, and `SPDX-License-Identifier: AGPL-3.0-only`.
- Plane source and templates are reused directly where appropriate, then adapted
  to Next.js and Alleato's runtime contracts. Clean-room recreation is not a
  program goal.
- The combined remote deployment is handled under AGPL-compatible terms. The
  public `/auth/source` page and `/api/source-info` contract must identify an
  independently accessible repository and exact source revision matching the
  deployed combined tree.
- One shared `PlaneWorkspaceShell` and one rewrite-backed dispatcher own the
  `/[projectId]/plane/[planeSurface]` family. Individual features must not add
  another project dynamic-route boundary or another workspace shell.
- The initial project surface set is Work Items, Cycles, Modules, Views, Pages,
  and Intake.
- Each replacement uses the real existing data, authorization, and mutation
  boundary. An unavailable domain contract must fail closed or release
  read-only; it must not invent a writable projection over unrelated records.
- Work Items uses `/api/tasks` and `/api/tasks/[taskId]`. Cycles and Modules
  currently adapt the project scheduling API. Views uses the saved-table-view
  owner. Pages uses `public.notes` through existing RLS. Intake uses the Tasks,
  Outlook Intake, and Users APIs with explicit admin/member request policies.
- Legacy routes remain available until the corresponding replacement passes
  authenticated desktop/mobile verification, required mutation and permission
  journeys, and a side-by-side comparison with Plane.
- A rendered page, successful build, or HTTP 200 is not completion. Production
  evidence must prove the deployed route, live data boundary, supported
  interactions, responsive state, and explicit recovery behavior.
- Visual parity evidence must pair the relevant Plane reference and Alleato
  replacement at desktop and mobile widths and list every remaining
  difference. A source mapping or code-fidelity review does not replace visual
  proof.
- Mutations that would alter production-backed records require explicit user
  approval before the proof run. Until then, the feature remains unverified for
  that acceptance criterion even when code and focused tests exist.
- The release path is the personal Alleato production repository and Vercel
  project. The public AGPL mirror is updated before or with every deployed
  Plane-derived slice.
- RAG Project Intelligence remains a separate program and is not part of this
  specification.

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

- RAG Project Intelligence or other AI/RAG implementation
- Rewriting task APIs, validation, permissions, or the task data model without
  evidence that an existing contract blocks the replacement
- Introducing a new backend host or moving frontend hosting away from Vercel
- Hostinger changes for the Alleato application
- Database changes that are not required by a documented Plane-to-Alleato domain
  adapter
- Enabling Cycles or Modules mutations through the shared scheduling projection
  before a discriminator-safe domain contract is designed and verified
- Adding board views where movement has no valid domain meaning
- Migrating RFIs, Submittals, Change Events, Commitments, Prime Contracts, or
  cross-project work in the same implementation slice
- Reworking unrelated dashboards, forms, detail pages, or public documentation
- Maintaining the old and new Tasks compositions permanently

## Further Notes

- The rollout after the Work Items acceptance gate remains RFIs, Submittals,
  Change Events, Commitments and Prime Contracts, followed by cross-project
  work, favorites, recents, and saved views.
- RFIs remain the preferred first phase-3 module.
- The direct source reuse, combined AGPL deployment, permissions, and production
  delivery boundaries make replacement releases High-risk until the program
  owner deliberately lowers the lane for a bounded follow-up.
- The visual goal is high fidelity with Plane, with differences limited to real
  Alleato data/contracts and required source-offer disclosure.
- The failure-loudly standard is: a user can always distinguish unsaved optimistic state from confirmed server state, understands what failed, and has a safe recovery action.
- The durable regression guardrail is the authenticated List-to-Board-to-inspector journey combined with shared URL-state and mutation-rollback tests.

## Current Production Baseline

As of 2026-07-31, the personal production repository contains the shared
dispatcher, AGPL source offer, and all six initial Plane-derived project
surfaces. Work Items, Views, Pages, and Intake have committed desktop/mobile
production evidence. Cycles and Modules are released read-only because their
current scheduling projection is not a safe mutation contract. Their latest
read-only release evidence must be committed to the program record before those
slices are described as visually complete.

The public source contract currently resolves to:

- Repository: `https://github.com/MeganHarrison/alleato-pm-backup-agpl`
- Exact source revision: `9fdd616a05fc154f3ef7e046166735a359f9e382`
- Notice: `https://alleato-pm-backup.vercel.app/auth/source`

## Remaining Scope Matrix

| Requirement | Current state | Proof present | Required next slice |
| --- | --- | --- | --- |
| AAI-1288 context-preserving inspector | Plane Work Items includes a detail peek, but the Linear issue remains Backlog | Open-detail behavior and production Work Items screenshots exist | Prove browser Back, scroll/focus restoration, tablet overlay, and mobile full-screen detail |
| AAI-1289 creation without leaving the surface | Quick-add code and focused tests exist; live mutation proof was intentionally deferred | Static and focused component evidence only | With explicit approval, create a reversible task, verify validation, preserve view state, and confirm after reload |
| AAI-1290 failure-safe board movement | Optimistic update and rollback code exists; Linear issue remains Backlog | Focused guards exist | Prove one permitted move persists after reload and one rejected move restores confirmed state with recovery copy |
| AAI-1291 compact, resizable, persistent navigation | Compact Plane shell is live; resizing and persistence are absent | Desktop/mobile shell screenshots | Implement permission-derived destinations, resize/collapse persistence, and keyboard/mobile behavior |
| AAI-1292 production acceptance and legacy retirement | Replacement routes are released; legacy Tasks remains intact | Production screenshots for Work Items and sibling routes | Complete the authenticated List-to-Inspector-to-Board mutation journey, obtain acceptance, then retire the old composition |
| Work Items | Released with live data and multiple views | Desktop/mobile plus command, display, and analytics captures | Complete mutation, inspector-navigation, and paired Plane/Alleato parity proof |
| Cycles | Released read-only through the schedule adapter | Focused tests and release commit; current screenshot publication pending | Publish fresh evidence, then design and migrate a discriminator-safe cycle model before mutations |
| Modules | Released read-only through the schedule adapter | Focused tests and release commit; current evidence shows an empty project | Prove a non-empty authorized read or fixture and design a dedicated module discriminator before mutations |
| Views | Released read-only | Desktop/mobile production screenshots | Decide and separately authorize create, update, default, duplicate, and delete mutations |
| Pages | Released with `public.notes` CRUD implementation | Desktop/mobile production screenshots and focused data tests | Prove create, edit, save, archive, restore, permissions, and paired visual parity |
| Intake | Released with live Tasks and Outlook Intake reads | Desktop/mobile production screenshots; final batch recorded live rows | Prove supported updates/deletes/reclassification across admin and member permissions |
| Workspace Home | Sidebar label only | No route or interaction proof | Define the Alleato mapping and implement a Plane-derived page |
| Drafts | Inert sidebar button | No route or interaction proof | Define its data owner and implement a Plane-derived page |
| Your work | Inert sidebar button | No route or interaction proof | Define its cross-project task scope and implement a Plane-derived page |
| Stickies | Inert sidebar button | No route or interaction proof | Define its data owner and implement a Plane-derived page |
| More, Favorites, and recents | Decorative or inert shell affordances | No persistence, permission, or navigation proof | Bind them to canonical permission-aware destinations and persisted user state |
| RFIs | Not started | Original rollout order only | First phase-3 replacement after the Work Items acceptance gate |
| Submittals | Not started | Original rollout order only | Plane-derived list/workflow detail replacement |
| Change Events | Not started | Original rollout order only | Plane-derived list plus domain-valid status grouping |
| Commitments | Not started | Original rollout order only | Dense list and detail replacement without forcing a board |
| Prime Contracts | Not started | Original rollout order only | Dense list and detail replacement without forcing a board |
| Cross-project work | Not started | Original rollout order only | Company-level work, favorites, recents, saved views, and command navigation |
