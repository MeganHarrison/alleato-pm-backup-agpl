# Plane Drafts source reference

This feature is directly adapted from `makeplane/plane` commit
`39856932cd6b9bd17eab0920506d628190b47af2`, including:

- `apps/web/app/(all)/[workspaceSlug]/(projects)/drafts/{page,layout,header}.tsx`
- `apps/web/core/components/issues/workspace-draft/root.tsx`
- `apps/web/core/components/issues/workspace-draft/draft-issue-block.tsx`
- `apps/web/core/components/issues/workspace-draft/empty-state.tsx`
- `apps/web/core/components/issues/workspace-draft/loader.tsx`

The original Plane MobX draft-issue store is replaced by Alleato's existing
authenticated and user-scoped `workspace_artifacts` API. License and exact
corresponding-source information is available through `LICENSES/NOTICE-PLANE.md`
and the application's public `/source` offer.
