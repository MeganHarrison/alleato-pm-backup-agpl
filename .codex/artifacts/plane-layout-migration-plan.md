# Plane to Alleato Layout Migration Plan

## SECTION A - UI Scope

### Phase 1: Shared work-surface foundation

- Extend `PageShell` with a shared compact work-surface composition for a 44px contextual toolbar, breadcrumbs, view switcher, filters, and one primary action.
- Extend the canonical sidebar with user-resizable width, clearer company/project grouping, and an accessible collapsed state.
- Add only the missing semantic density tokens. Preserve the Alleato orange accent and current typography.
- Standardize a shared record-peek shell using the existing slideover/side-panel primitives.
- Define responsive behavior:
  - Desktop: persistent sidebar, compact header, main view, optional peek panel.
  - Tablet: collapsible sidebar and overlay peek panel.
  - Mobile: existing bottom navigation, compact page controls, full-screen record detail.

### Phase 2: Tasks pilot

Canonical route: `/[projectId]/tasks`

User-facing interface:

- Page title: `Tasks`
- Primary action: `New task`
- View choices: `List`, `Board`
- Search placeholder: `Search tasks...`
- Filters: status, assignee, due date, priority
- Empty state title: `No tasks yet`
- Empty state action: `Create task`
- Load failure: `Tasks could not be loaded. Try again.`
- Mutation failure: preserve the previous state and show the failed action with a retry option

The list must remain owned by `AleatoDataTable`. The board must remain owned by the existing tasks kanban implementation. Both views consume the same normalized task query and shared filter state. Selecting a record opens the same task detail component in the shared peek shell.

### Phase 3: Module rollout

Roll out the proven work-surface pattern in this order:

1. RFIs: list plus peek, saved filters, keyboard navigation.
2. Submittals: list plus workflow-aware peek.
3. Change Events: list plus status grouping or board only where it improves the workflow.
4. Commitments and Prime Contracts: dense list plus detail peek, without forcing a board view.
5. Cross-project work: company-level task and record views, favorites, recents, and command-palette navigation.

Each module adopts only the views that fit its workflow. A Plane-style board is not a default requirement.

### UI acceptance contract

- No copied Plane source or adapted Plane components.
- No duplicated Alleato navigation, table, kanban, or detail JSX.
- Switching views preserves filters and search.
- Opening and closing a record preserves scroll position and list/board context.
- All mutations fail loudly and restore the last confirmed state when optimistic updates fail.
- The desktop and mobile layouts pass the Alleato product noise gate.

## SECTION B - Integration Scope

### Shared view-state contract

Use URL parameters as the canonical shareable state:

- `view=list|board`
- `search`
- `status`
- `assignee`
- `priority`
- `sort`

Temporary UI state, such as an open menu, remains local. Record selection should be route-aware so browser back closes the peek panel before leaving the task surface.

### Tasks data integration

- Reuse the existing tasks query and mutation endpoints.
- Normalize list and board data through one feature-level adapter.
- Reuse existing project and permission context.
- Preserve current optimistic kanban updates and add a shared visible rollback/error contract.
- Reuse the existing task detail form and validation.
- Do not add database tables in the pilot.

If persistent saved views are approved later, add a single shared user-view-preferences model rather than module-specific preference tables.

### Shared component changes

Expected shared owners:

- `frontend/src/components/layout/page-shell.tsx`
- `frontend/src/components/nav/app-sidebar.tsx`
- `frontend/src/components/ui/sidebar.tsx`
- Existing shared page-tabs/view-switcher primitive
- Existing slideover/side-panel primitive
- Existing table and kanban primitives
- Existing command-palette infrastructure

Expected Tasks owners:

- Current project Tasks route and page components
- `frontend/src/features/tasks/tasks-kanban-page.tsx`
- Existing task hooks, schemas, detail form, and API adapters

Before implementation, inspect the exact current Tasks route owners and record them in a Standard delivery task. Claim only those paths in the isolated workspace.

### Guardrails

- Add component tests for view-state parsing and switching.
- Add a focused end-to-end test for List -> open task -> close -> Board -> move task -> reload.
- Add a failed-mutation test proving the board restores the prior column and surfaces an error.
- Add visual evidence for desktop and mobile on the pilot route.
- Add a shared example or Storybook state for the work-surface header and peek shell so later modules do not reimplement them.

## SECTION C - Deployment Plan

### Pilot delivery

1. Create a Standard delivery task with the UI acceptance contract above.
2. Create an isolated session workspace with exact ownership of the shared shell and Tasks files.
3. Implement the shared foundation and Tasks pilot behind one route-level feature flag if the current production Tasks workflow cannot be replaced atomically.
4. Run targeted component and route tests.
5. Verify the complete task flow in the browser at desktop and mobile sizes, capturing screenshots.
6. Publish through the repository's `codex:finish` flow to `origin/main`.
7. Verify the Vercel production deployment commit and the rendered authenticated Tasks route.

### Rollout gates

A module can migrate only after the Tasks pilot proves:

- Stable URL state across list and board
- No permission regression
- No lost list context when using the peek panel
- Successful and failed mutation behavior
- Acceptable desktop and mobile density
- No page-local layout fork

### Hosting impact

- Frontend changes deploy to the existing Alleato Vercel project.
- The first pilot should require no Hostinger change.
- Render remains the Alleato backend host if a later phase requires backend API work.
- Supabase remains the system of record.

### Rollback

- Keep the previous Tasks page composition available until production verification succeeds.
- If a feature flag is needed, make rollback a single Vercel environment-setting change.
- Do not maintain two permanent implementations. Remove the old composition after the pilot is accepted and production evidence is captured.
