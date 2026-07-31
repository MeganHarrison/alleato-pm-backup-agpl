# Plane Stickies source notice

This directory contains a Next.js/Supabase adaptation of Plane Stickies.

- Upstream: https://github.com/makeplane/plane
- Revision: `39856932cd6b9bd17eab0920506d628190b47af2`
- License: GNU Affero General Public License v3.0 only
- Copyright: 2023-present Plane Software, Inc. and contributors

Direct source templates adapted here:

- `apps/web/app/(all)/[workspaceSlug]/(projects)/stickies/header.tsx`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/stickies/page.tsx`
- `apps/web/core/components/stickies/layout/stickies-list.tsx`
- `apps/web/core/components/stickies/sticky/root.tsx`
- `apps/web/core/components/stickies/sticky/inputs.tsx`
- `apps/web/core/components/editor/sticky-editor/color-palette.tsx`
- `packages/types/src/stickies.ts`

The adaptation replaces Plane's MobX/services layer with an authenticated
Next.js API and a deferred Supabase migration. It retains the Plane header,
search, add action, responsive masonry layout, editable colored sticky cards,
palette, and destructive-action confirmation while adding explicit scope,
pin, and archive controls.

The combined deployment and corresponding source remain subject to the
AGPL-3.0-only source-offer requirements described in
`LICENSES/NOTICE-PLANE.md`.
