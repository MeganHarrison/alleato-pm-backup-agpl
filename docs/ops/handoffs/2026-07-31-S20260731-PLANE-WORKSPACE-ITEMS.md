# S20260731 Plane Workspace Items Handoff

## Scope

High-risk local-only foundation for per-user Plane-derived Favorites and
Recents persistence. No shared navigation edits, migration application,
publication, or production state changes.

## Ownership

- `supabase/migrations/20260731231300_create_plane_workspace_items.sql`
- `frontend/src/app/api/plane-workspace-items/`
- `frontend/src/features/plane-workspace-items/`
- `docs/ops/tasks/2026-07-31-plane-workspace-items-domain.md`
- this handoff

## Acceptance contract

- Authenticated user ownership is enforced in API and RLS.
- Project-scoped operations require existing Alleato project access.
- Writes are explicit and recents upsert idempotently by entity.
- Failures produce structured, actionable responses.
- Migration remains unapplied pending explicit approval.

## Current status

Implementation and focused verification pass. The first independent review
identified four issues; all were remediated. A second read-only reviewer
confirmed the corrected code and canonical `prime_contract` to `contracts`
permission mapping. The local commit is ready.

## Verification

- Focused Jest: 5 suites, 26 tests pass.
- Targeted ESLint and Prettier: pass.
- Changed-route guardrail and no-new-any checks: pass.
- Non-production route budget: pass, 651/654 production dynamic files and
  estimated 2033/2042 generated routes.
- Generated inventories: `npm run map:project` and `npm run map:system`, plus
  both check-only gates, pass. The generated outputs were claimed only after
  the registry reported zero active isolated-workspace leases.
- `git diff --cached --check`: pass before the final documentation update.
- A broad incremental TypeScript check produced no diagnostics for 124 seconds
  but timed out; focused Jest transpilation and targeted ESLint cover this owned
  boundary.
- The first commit attempt failed loudly because generated remote types cannot
  include the deliberately unapplied table. The repository now isolates that
  pending relation behind its task-owned adapter and Zod response validation;
  release integration must regenerate database types after migration apply.

## Review remediation

- Reject backslashes and control characters in hrefs at Zod and database CHECK
  boundaries to prevent browser-normalized network-path escapes.
- Map destination entity types to canonical project permission modules in one
  database helper used by both API and RLS; revoked destination access hides
  existing items.
- Add UUID tie-break ordering and matching indexes.
- Keep raw database details in server causes, not serialized API details.
- Replace client-owned recency timestamps with a server-owned `touch` command.

## Migration ledger evidence

Deferred. The migration must not be applied in this worker session.

- Cause: explicit worker scope prohibits schema application and production state changes.
- Detection gap: static SQL assertions cannot prove live RLS behavior.
- Prevention: release integration must apply deliberately, verify the exact
  remote ledger version, and exercise cross-user plus revoked-module cases.
- Next owner action:
  `npm run db:migrations:verify-applied -- supabase/migrations/20260731231300_create_plane_workspace_items.sql`.

## Release integration

Before any remote deployment, add this Plane-derived feature to the global
AGPL notice and exact corresponding source-offer path. This local slice includes
SPDX headers and `PROVENANCE.md`, but shared notice files were outside ownership.
