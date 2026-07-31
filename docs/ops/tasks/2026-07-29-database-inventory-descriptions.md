# Task: Editable Database Inventory Metadata

Status: Blocked/Deferred — authenticated admin browser proof unavailable
Owner: Codex
Created: 2026-07-29
Task ID: Local DBI-description
Linear Issue: Not requested
Related Handoff: N/A (single-session work)

## Objective

Let Admin Dashboard users maintain durable descriptions, owners, and review evidence for every live table in Database Inventory.

## Scope

- Add an admin-only PM App metadata table for descriptions keyed by inventory database and table name.
- Surface that description as a sortable, searchable table column with inline editing.
- Add separate admin-only stewardship metadata so ownership does not freeze generated descriptions as manual copy.
- Surface editable Owner and an explicit Mark reviewed action, with filters for missing ownership and stale review evidence.
- Exclude changes to application-table schemas, non-admin access, and RAG database structure.

## Source of Truth

- Canonical runtime/data owner: live `pg_catalog` schema metadata plus PM App description and stewardship overrides.
- Existing shared primitives/services: `UnifiedTablePage`, Admin Dashboard `requireAdmin`, `apiFetch`, and server-only service clients.
- Deprecated or parallel paths: generated inventory `purpose` remains a fallback annotation, not the editable source of truth.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Admins can see a Description column on `/database-inventory` in the implemented table configuration.
- [x] Admins can edit and persist a table description from the row without navigating away; an active edit suppresses row navigation until saving completes.
- [ ] An authenticated browser reload returns the saved description. Blocked by unavailable admin test credentials.
- [x] Invalid targets and save failures return specific, actionable API errors.
- [x] The metadata table is inaccessible to browser roles and all writes stay behind the admin route.
- [x] Admins can assign or clear an Owner inline and mark a table reviewed without leaving the table.
- [x] Owner and review filters identify unassigned and stale tables.

## Implementation Checklist

- [x] Existing table and server metadata owner inspected.
- [x] Shared table and inline-edit patterns identified.
- [x] Migration, typed server access, guarded API, and table cell implemented.
- [x] Remote migration ledger and RLS configuration verified.
- [x] Stewardship migration, guarded API, and table controls implemented.

## Failure-Loudly Contract

- Cause surfaced as: inline save error toast or explicit API error, never a silent local-only change.
- Detection path: PUT request result, inventory reload, and migration ledger check.
- Owner saves and Mark reviewed calls preserve the current row and surface a specific error toast if persistence fails.
- Recovery path: correct the description and retry; if metadata is unavailable, apply the named migration and refresh.

## Incident Learning

- Failure fingerprint: `security.admin-metadata-write-boundary`
- Root cause: Prior inventory annotations were generated and read-only, so there was no durable admin write path.
- Detection gap: The UI showed static purpose data without any indication that it could not be maintained in product.
- Prevention: an RLS-locked metadata table, admin-only route, explicit target validation, and reload verification.
- Guardrail evidence: pending migration ledger verification.

## Evidence

| Check                           | Command / artifact                                                                                                     | Result  | Notes                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing surface                | `database-inventory/page.tsx` and server metadata owner                                                                | Pass    | Canonical table and server paths reused.                                                                                                                                                                          |
| Supabase security guidance      | RLS documentation and current changelog                                                                                | Pass    | New public-schema table uses RLS with no browser-role grants.                                                                                                                                                     |
| Remote migration access         | Supabase CLI and MCP migration listing                                                                                 | Blocked | Both returned authorization failures. The secured database URL supplied the verified fallback.                                                                                                                    |
| Migration application           | `psql` against configured `DATABASE_URL`                                                                               | Pass    | Applied only `20260730030058_schema_explorer_table_descriptions` and recorded its remote ledger version.                                                                                                          |
| Ledger verification             | `npm run db:migrations:verify-applied -- supabase/migrations/20260730030058_schema_explorer_table_descriptions.sql`    | Pass    | The exact remote version is present.                                                                                                                                                                              |
| RLS and grants                  | Catalog readback                                                                                                       | Pass    | RLS enabled; anon/authenticated lack SELECT; service_role has required CRUD privileges.                                                                                                                           |
| Transaction persistence         | Temporary upsert/read/rollback through the configured database URL                                                     | Pass    | Description was written and read without leaving test data behind.                                                                                                                                                |
| Focused regression tests        | `cd frontend && npx jest src/features/database-inventory/__tests__/schema-explorer.server.test.ts --runInBand`         | Pass    | Covers saved-over-fallback descriptions, ownership/review write separation, inline review action, and prevents a blur plus Cmd/Ctrl+Enter double-save.                                                            |
| Focused lint and format         | exact changed frontend files                                                                                           | Pass    | ESLint, Prettier, and `git diff --check` pass.                                                                                                                                                                    |
| Independent review              | Codex reviewer                                                                                                         | Pass    | The reviewers verified the row-navigation, duplicate-save, availability-isolation, and owner/review integrity fixes.                                                                                              |
| Stewardship migration           | `20260730131156_add_schema_explorer_table_stewardship.sql`                                                             | Pass    | Applied directly in one transaction and recorded in the remote migration ledger.                                                                                                                                  |
| Stewardship RLS and grants      | Catalog readback                                                                                                       | Pass    | RLS enabled; anon/authenticated have no grants; service_role has CRUD access.                                                                                                                                     |
| Stewardship persistence         | Transaction-only upsert/read/rollback                                                                                  | Pass    | Owner and review timestamp wrote and read without leaving test data behind; partial conflict updates retained review evidence on owner save and retained ownership on review marking.                                |
| Ledger script                   | `npm run db:migrations:verify-applied -- supabase/migrations/20260730131156_add_schema_explorer_table_stewardship.sql` | Blocked | An unrelated duplicate local `20260729190000` migration version prevents the repository-wide preflight; direct remote ledger readback passed.                                                                     |
| Bounded TypeScript check        | `cd frontend && pnpm run typecheck`                                                                                     | Pass    | The configured bounded typecheck completed with no diagnostics. The direct unbounded compiler command is not used as release evidence because it reaches the Node heap limit before diagnostics.                     |
| Authenticated UI and screenshot | `/database-inventory`                                                                                                  | Blocked | Available browser state is a normal user and correctly receives the admin allowlist denial. Admin test credentials are not configured, so a valid admin screenshot or save/reload interaction cannot be captured. |

## Remaining Risk

- The source and migration are ready for publication, but frontend completion remains deferred until an authenticated allowlisted admin state proves inline owner save, review marking, reload persistence, and desktop/mobile screenshots.
- The generated Supabase types command could not complete because its remote mode attempted to reach an unavailable local Docker daemon. The added metadata-table type was kept aligned manually after the successful database catalog readback; regenerate it from an environment with Docker available before treating a full type generation as green.

## Final Status

- [ ] Deferred: authenticated admin UI proof and final screenshots.
