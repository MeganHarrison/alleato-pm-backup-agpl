# Plane-derived software notice

Portions of this application are copied or adapted from
[Plane](https://github.com/makeplane/plane), pinned upstream revision
`39856932cd6b9bd17eab0920506d628190b47af2`.

Copyright (c) 2023-present Plane Software, Inc. and contributors.

SPDX-License-Identifier: AGPL-3.0-only

The copied and modified Plane-derived files retain their copyright and SPDX
headers. The complete corresponding source for the exact network deployment
must be made available at:

<https://github.com/MeganHarrison/alleato-pm-backup-agpl>

The upstream source is available at <https://github.com/makeplane/plane>.
Modification history is preserved in this repository.

## Plane-derived replacement surfaces

The deployed replacement surfaces live in these source directories:

- `frontend/src/features/plane-work-items/`
- `frontend/src/features/plane-cycles/`
- `frontend/src/features/plane-modules/`
- `frontend/src/features/plane-views/`
- `frontend/src/features/plane-pages/`
- `frontend/src/features/plane-intake/`

Each copied or adapted source file retains an SPDX header or an adjacent source
mapping that identifies the corresponding upstream Plane template. Alleato data
adapters, permission checks, and mutations are modifications distributed under
the same AGPL-compatible terms as the combined network deployment.

## Work Items template provenance

The Work Items replacement adapts the structure, responsive behavior, and
interaction templates from these Plane sources at the pinned revision:

- `apps/web/app/(all)/[workspaceSlug]/(projects)/sidebar.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/extended-project-sidebar.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/layout.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/header.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/mobile-header.tsx`
- `apps/web/ce/components/issues/header.tsx`
- `apps/web/ce/components/issues/quick-add/root.tsx`
- `apps/web/core/components/issues/filters.tsx`
- `apps/web/core/components/issues/issue-layouts/list/default.tsx`
- `apps/web/core/components/issues/issue-layouts/list/list-group.tsx`
- `apps/web/core/components/issues/issue-layouts/list/block.tsx`
- `apps/web/core/components/issues/issue-layouts/quick-add/form/list.tsx`
- `apps/web/core/components/issues/issue-layouts/quick-add/button/list.tsx`
- `apps/web/core/components/issues/issue-layouts/kanban/default.tsx`
- `apps/web/core/components/issues/issue-layouts/kanban/kanban-group.tsx`
- `apps/web/core/components/issues/issue-layouts/kanban/block.tsx`
- `apps/web/core/components/issues/peek-overview/header.tsx`
