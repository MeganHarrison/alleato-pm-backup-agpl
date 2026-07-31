# Plane module source reference

This feature directly adapts the list, board, progress, status, date-range,
filtering, sorting, layout switching, quick-action, peek overview, permission,
and create/edit interaction templates from Plane v1.3.1:

- `apps/web/core/components/modules/modules-list-view.tsx`
- `apps/web/core/components/modules/module-list-item.tsx`
- `apps/web/core/components/modules/module-list-item-action.tsx`
- `apps/web/core/components/modules/module-card-item.tsx`
- `apps/web/core/components/modules/module-view-header.tsx`
- `apps/web/core/components/modules/form.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/modules/(list)/header.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/modules/(list)/mobile-header.tsx`

Plane's visual hierarchy and interaction structure are the starting point. The
MobX store, Plane APIs, favorites, lead/member data, and Gantt implementation
are replaced or withheld where Alleato has no equivalent persistence contract.
Alleato root `schedule_tasks`, the existing scheduling API, and Schedule write
permission remain the data, mutation, and authorization owners.

Copyright (c) 2023-present Plane Software, Inc. and contributors.

SPDX-License-Identifier: AGPL-3.0-only
