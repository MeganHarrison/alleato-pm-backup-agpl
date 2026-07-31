# Plane Pages adaptation notice

This feature directly adapts the interaction structure of Plane
`39856932cd6b9bd17eab0920506d628190b47af2` (`v1.4.0-rc1-11`) Pages from:

- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/pages/(list)/header.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/pages/(detail)/header.tsx`
- `apps/web/core/components/pages/pages-list-view.tsx`
- `apps/web/core/components/pages/pages-list-main-content.tsx`
- `apps/web/core/components/pages/header/root.tsx`
- `apps/web/core/components/pages/list/root.tsx`
- `apps/web/core/components/pages/list/block.tsx`
- `apps/web/core/components/core/list/list-item.tsx`
- `apps/web/core/components/pages/editor/title.tsx`
- `apps/web/core/components/pages/editor/editor-body.tsx`
- `apps/web/core/components/pages/editor/header/root.tsx`
- `apps/web/core/components/pages/editor/toolbar/root.tsx`

Copyright (c) 2023-present Plane Software, Inc. and contributors.

SPDX-License-Identifier: AGPL-3.0-only

The Alleato adaptation replaces Plane's MobX page store, collaboration server,
permissions, and editor extensions with Alleato's existing project-scoped
`public.notes` table, Supabase RLS, and design-system controls. It preserves
Plane's separate full-canvas list and editor compositions and was modified for
Alleato on 2026-07-30.
