# Vercel frontend-root build-contract verification

- `node --check frontend/scripts/build/prepare-route-inventory.mjs` passed.
- `node --check frontend/scripts/build/run-production-build.mjs` passed.
- `pnpm --dir frontend run build:route-inventory` passed from a complete checkout and invoked the canonical root audit.
- Vercel deployment `dpl_CnzWjZyfKjYG9MWVFQXFtGTMw7ec` previously failed before Next compilation because `/vercel/scripts/verify/route-audit.mjs` is outside its frontend-root checkout.
- The new boundary explicitly validates the committed inventory in Vercel; a missing artifact names the recovery action.

Independent review: APPROVED by `/root/vercel_build_review`. Its Vercel-style frontend-only simulation exited `0` with the inventory present and exited `1` with the expected recovery message when it was removed.

The direct CLI production deploy reached the fixed inventory boundary, then correctly failed the production-source gate because local CLI deployments have no canonical GitHub metadata. The Vercel project is now connected to `https://github.com/The-Alleato-Group/project-management.git`; the next Git-triggered deploy remains required before final task closeout.
