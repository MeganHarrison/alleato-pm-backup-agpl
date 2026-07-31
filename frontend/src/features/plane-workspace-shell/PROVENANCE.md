# Plane workspace shell Favorites and Recents provenance

This UI adapts Plane v1.3.1 sidebar favorites patterns under
`AGPL-3.0-only`.

Direct source references:

- `apps/web/core/components/workspace/sidebar/workspace-sidebar-menu.tsx`
- `apps/web/core/components/workspace/sidebar/favorites/`
- `apps/web/core/store/favorite.store.ts`
- `packages/types/src/favorite/favorite.ts`

Alleato changes:

- uses the project-authorized static Next.js `plane-workspace-items` API;
- renders explicit loading, empty, unavailable, and mutation-recovery states;
- keeps validated application-relative links as the only navigation targets;
- does not provide local persistence while the production migration is unapplied.

See `LICENSES/NOTICE-PLANE.md` and `/auth/source` for the complete remote source
offer.
