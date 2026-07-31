# Plane workspace items provenance

This feature adapts Plane v1.3.1 favorites contracts and behavior under
`AGPL-3.0-only`.

Direct source references:

- `apps/api/plane/db/models/favorite.py`
- `apps/api/plane/app/views/workspace/favorite.py`
- `apps/api/plane/app/serializers/favorite.py`
- `packages/types/src/favorite/favorite.ts`
- `packages/services/src/user/favorite.service.ts`
- `apps/web/core/store/favorite.store.ts`

Alleato changes:

- combines favorite and recent navigation items in one per-user table;
- uses a static Next.js route to avoid expanding the dynamic-route budget;
- uses Supabase RLS plus explicit API permission checks;
- stores Alleato numeric project identifiers and application-relative links;
- omits Plane favorite folders from this initial domain foundation.
