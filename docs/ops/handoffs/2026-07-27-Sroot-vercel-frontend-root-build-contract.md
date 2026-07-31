# Vercel frontend-root build contract handoff

## Summary

Localized Vercel production deployment `dpl_CnzWjZyfKjYG9MWVFQXFtGTMw7ec` failing before Next compilation because `frontend/scripts/build/run-production-build.mjs` attempted to execute `/vercel/scripts/verify/route-audit.mjs`. Vercel only checks out the configured `frontend/` project root, so that repository-level script is absent.

## Change

Added the shared `frontend/scripts/build/prepare-route-inventory.mjs` boundary. It regenerates from the canonical root audit in a complete checkout; in Vercel it verifies the committed inventory and emits an actionable error if it is absent. Both build entry points use it.

## Evidence

- `node --check frontend/scripts/build/prepare-route-inventory.mjs` — pass
- `node --check frontend/scripts/build/run-production-build.mjs` — pass
- `pnpm --dir frontend run build:route-inventory` — pass
- Vercel production readback — pending publication

## Next action

The repair is published. The Vercel project was also connected to `The-Alleato-Group/project-management`; observe the next Git-triggered production deployment and update this handoff/task with its `READY` deployment ID.
