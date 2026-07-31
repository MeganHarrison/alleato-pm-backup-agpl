# Handoff: automatic Page Access route inventory

Status: Published; awaiting Vercel Ready read-back

## Change

Added one portable inventory generator under `frontend/scripts/build/`. Vercel's frontend-root production build now regenerates `route-inventory.generated.json` from its own `src/app` route tree before Next.js bundles Page Access. The repository-root route audit imports that same generator, so local reporting and deployed inventory cannot drift through duplicate discovery logic.

## Verification completed

- Focused Node tests: 6 passed, 0 failed.
- Vercel-root fixture proved an empty committed snapshot is replaced by discovered route rows.
- Missing source and a successful local audit that leaves an empty snapshot both fail with actionable `[route-inventory]` errors.
- Independent review identified the local empty-output gap; the new post-audit validation and regression test address it. The reviewer re-checked the fix and approved it with no remaining release blocker.

## Pending closeout

- Commit `6895ec9f` is published to `origin/main` using a clean temporary checkout because the canonical index contains unrelated staged build work.
- Confirm the Vercel deployment reaches Ready. Its current build log proves `route-audit.mjs` regenerated `frontend/src/app/(admin)/site-map/route-inventory.generated.json` from the cloned source at commit `6895ec9`.
- Read back the deployed route source and Page Access behavior with authenticated access where available.

## Ownership

Owned paths are registered to session `S019fb0f3` under task `SITE-MAP-AUTO-INVENTORY`. Existing dirty inventory JSON and unrelated build-test edits are intentionally untouched.
