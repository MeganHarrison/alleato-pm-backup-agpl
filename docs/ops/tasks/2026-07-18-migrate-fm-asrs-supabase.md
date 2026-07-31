# Task: Migrate FM Global and ASRS Data to Dedicated Supabase

Status: In Progress — operational migration complete; visual proof and task-file publication blocked.
Owner: Megan Harrison
Created: 2026-07-18
Task ID: AAI-1183
Linear Issue: [AAI-1183](https://linear.app/megankharrison/issue/AAI-1183/migrate-fm-global-and-asrs-data-to-dedicated-supabase-project)
Related Handoff: Deferred; no worker handoff is required for this single-session database migration.

## Objective

Copy the complete FM Global and ASRS database domain from PM APP (`lgveqfnpkxvzbnnwuled`) to the dedicated ASRS project (`vqnnvpnoitqhijkztyhq`) while preserving schema, data, identifiers, dependencies, and query-critical database objects.

## Scope

- Owned source tables: `fm_global_tables`, `fm_form_submissions`, `fm_global_figures`, `fm_sections`, `fm_sprinkler_configs`, `fm_optimization_rules`, `fm_optimization_suggestions`, `fm_blocks`, `fm_cost_factors`, `fm_documents`, `fm_table_vectors`, `fm_text_chunks`, `asrs_sections`, `asrs_blocks`, `asrs_configurations`, `asrs_decision_matrix`, `asrs_logic_cards`, `asrs_protection_rules`, and `block_embeddings`.
- Owned dependencies: relevant sequences, indexes, constraints, triggers, RLS policies, and table-local functions/views required by these tables.
- Explicit exclusion: application environment/config cutover, deletion from the PM APP source, unrelated PM APP tables, and credentials in repository files or task comments. `design_recommendations` and `design_violations` are excluded because their live foreign keys target PM-specific `user_projects` and `auth.users`, rather than the FM/ASRS table domain; copying them would require an unrequested cross-account project/auth migration.

## Source of Truth

- Canonical runtime/data owner: PM APP Supabase project `lgveqfnpkxvzbnnwuled`.
- Destination runtime/data owner: ASRS Supabase project `vqnnvpnoitqhijkztyhq`.
- Existing shared primitives/services: `supabase/migrations/schema_dump.sql`; FM/ASRS database inventory at `frontend/src/components/dev-tools/db-inventory.generated.json`.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [x] Every scoped table and required dependency is identified from the live source schema.
- [x] Destination receives the schema, table data, sequences, constraints, indexes, triggers, policies, and required database objects.
- [x] Source and destination row counts match for every scoped table.
- [x] Destination foreign-key validation and representative FM/ASRS lookup queries pass.
- [x] Failure-loudly behavior is defined and migration artifacts do not expose credentials.
- [x] Application cutover remains deferred unless explicitly requested.

## Implementation Checklist

- [x] Capture a source schema/data snapshot restricted to the scoped domain.
- [x] Inspect destination for collision and extension prerequisites before writes.
- [x] Apply schema/database-object migration to destination.
- [x] Import data in dependency-safe order and reset sequences.
- [x] Run readback and integrity verification.
- [x] Post kickoff and migration evidence to AAI-1183; final closeout evidence is blocked by dashboard authentication.

## Integration and Verification

- [x] Targeted migration commands complete; an idempotent retry reported `fm_text_chunks_pkey` duplicate after the first import had already committed, and count parity confirmed no data loss.
- [x] Live destination readback proves counts and references.
- [x] Evidence artifacts are recorded without secrets.
- [x] Known unrelated failures are recorded: source PostgreSQL emitted a collation-version warning; it does not affect the copied domain and is owned by the PM APP database environment.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: table/object-specific migration failure or source/destination count mismatch.
- Detection path: per-table manifest, import command exit status, count comparison, and `ALTER TABLE ... VALIDATE CONSTRAINT` / representative query results.
- Recovery path: retain an encrypted/local export artifact, stop before source deletion, correct only the failed destination object, and rerun the scoped import/readback.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: Per-table manifest and post-import integrity verification prevent partial silent copies.
- Guardrail evidence: This task file and destination readback evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before migration writes. |
| Source/destination discovery | `supabase projects list` | Pass | PM APP source and ASRS destination confirmed. |
| Target prerequisite | `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public` | Pass | Required by the FM vector embedding columns. |
| Domain import | Restricted schema dump plus dependency-ordered per-table data dumps | Pass | 19 scoped tables, policies, indexes, constraints, trigger functions, triggers, and sequences imported; source was not modified. |
| Count parity | `/private/tmp/asrs-fm-migrate.j3DRyl/source-counts.txt` compared with `destination-counts.txt` | Pass | Exact parity across all 19 tables: 1,443 rows total. |
| Referential integrity | `/private/tmp/asrs-fm-migrate.j3DRyl/target-fk-validity.txt` and `relationship-checks.txt` | Pass | 11 scoped foreign keys valid; 46 FM figure/table, 45 vector/table, and 476 ASRS block/section relations resolve. |
| Domain reference | `docs/architecture/FM-ASRS-DOMAIN.md` | Pass | Documents the 19 migrated tables, live functionality, limitations, and cutover strategy. |
| Visual completion proof | `agent-browser open https://supabase.com/dashboard/project/vqnnvpnoitqhijkztyhq/editor` | Blocked | Redirected to Supabase sign-in because no saved dashboard session/profile exists. Blocker and next action posted to AAI-1183. |

## Remaining Risk

- Screenshot-in-comments gate: the ASRS Supabase dashboard redirects to sign-in in browser automation. Owner: Codex/Megan; next action: authenticate a Supabase dashboard session, capture the destination table-editor screenshot, attach it to AAI-1183, and then close the issue.
- Repository publication: this checkout contains unrelated concurrent edits and unresolved orchestration-file conflicts. Owner: concurrent sessions; next action: resolve/accept those files through the session board, then publish only this task file with the task-owned-file finish flow.

## Final Status

- [ ] All required checklist items are complete. Blocked by screenshot-in-comments and task-file publication gates.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A; the migration retry was detected and reconciled by the per-table parity guardrail.
- [x] Deferred work includes cause, detection gap, prevention step, owner, and next action above.
