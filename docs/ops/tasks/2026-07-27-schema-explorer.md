# Task: Live Supabase Schema Explorer

Status: Blocked — production Supabase project access required
Owner: Codex
Created: 2026-07-27
Task ID: Local schema-explorer
Linear Issue: Not requested
Related Handoff: N/A (single delegated implementation session)

## Objective

Give Admin Dashboard users a secure, refreshable view of the PM App and AI/RAG Supabase public schemas, including table purpose, code-connected features, primary keys, columns, and foreign keys.

## Scope

- Replace the Database Inventory runtime's static table list with server-side schema metadata RPCs.
- Keep curated purpose and code-reference annotations as secondary metadata, with visible fallbacks for unknown tables.
- Exclude table rows, database credentials, auth/private schemas, write controls, and database mutation.
- Record the existing table-cleanup evidence and a non-destructive, staged review in `docs/architecture/SCHEMA-CLEANUP-REVIEW-2026-07-27.md`.

## Source of Truth

- Canonical runtime/data owner: `pg_catalog` metadata via the restricted `public.get_schema_explorer_metadata()` RPC.
- Existing shared primitives/services: `frontend/src/app/(admin)/database-inventory`, `UnifiedTablePage`, `DbInventoryDetailPanel`, `requireAdmin`, and server-only Supabase service clients.
- Deprecated runtime path: `db-inventory.generated.json` as the table enumerator; it remains annotation-only until separately retired.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] The implementation is an authorized-admin live metadata flow that exposes no table data or credentials.
- [x] The metadata query dynamically enumerates tables, columns, primary keys, and foreign keys; no static table list controls runtime visibility.
- [x] Every table detail renders primary-key fields and all outgoing foreign-key fields.
- [x] Purpose and feature connections indicate whether they are curated/code-derived or inferred.
- [x] The route reuses the canonical Admin Dashboard authorization boundary.
- [x] The metadata RPC explicitly revokes PUBLIC/anon/authenticated execution and grants only `service_role`; no browser code imports a service key.

## Failure-Loudly Contract

- Cause surfaced as: a labeled API error or visible unavailable-source state, never an empty schema list.
- Detection path: route contract test and RPC response validation.
- Recovery path: apply the corresponding PM App/RAG migration, then refresh; invalid RPC output reports a schema-contract failure.

## Incident Learning

- Failure fingerprint: `security.security-definer-anon-execute`
- Root cause: PostgreSQL function execute permission defaults to PUBLIC.
- Detection gap: The former inventory refresh read a generated artifact and could not reveal schema drift.
- Prevention: explicitly revoke PUBLIC/anon/authenticated execution, grant only `service_role`, validate response shape, and keep manual refresh at the page boundary.
- Guardrail evidence: `npm run db:migrations:verify-applied -- supabase/migrations/20260727120000_create_schema_explorer_metadata.sql` after authorized deployment.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Existing surface inspection | `frontend/src/app/(admin)/database-inventory/page.tsx` | Pass | Canonical page reused; static refresh behavior localized. |
| Supabase security guidance | Official Supabase secure-data and database-functions docs | Pass | Service keys remain server-only; restricted security-definer function uses fixed search path and ACL. |
| Type generation gate | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Blocked | CLI has no `SUPABASE_ACCESS_TOKEN`; command did not generate output and the local generated file was restored byte-for-byte. |
| Formatting | `npx prettier@3.8.2 --check` on changed frontend files | Pass | All six frontend files use the repository formatting style. |
| Secret-boundary scan | `rg` over changed route/page/feature files for service-role variable names | Pass | No service role key is imported into the browser surface. |
| Function ACL contract | `rg` required revoke/grant clauses in PM App and RAG migrations | Pass | Both migrations revoke PUBLIC, anon, authenticated and grant only service_role. |
| Lint | `npx eslint ...changed files` | Blocked | This checkout lacks `frontend/node_modules/eslint-plugin-storybook`; ESLint exits before evaluating project files. |
| Live schema / user-flow proof | Authorized admin route and remote RPC readback | Blocked | User authorized a main-branch release on 2026-07-27, but the configured Supabase integration returned “You do not have permission to perform this action” for both production project refs. |

## Remaining Risk

- Release is blocked: the PM App and RAG migrations must be applied before the live route can return schema data, but the configured Supabase integration cannot list migrations for either active production project (`lgveqfnpkxvzbnnwuled` and `fqcvmfqldlewvbsuxdvz`). The exact MCP response is “You do not have permission to perform this action”.
- Supabase CLI remote verification is additionally blocked by a missing CLI access token; the server runtime uses its existing protected service-role environment variables instead. Grant the configured Supabase integration access to both production projects, then apply and verify the two migrations before releasing the frontend.
- The cleanup review deliberately makes no drop recommendation executable: generated inventory and a prior soft-drop migration disagree on several table names, so a current catalog read is required before action.

## Final Status

- [x] Implementation and available focused static checks are complete.
- [ ] Database migration application and remote-ledger verification — blocked by missing production-project permissions.
