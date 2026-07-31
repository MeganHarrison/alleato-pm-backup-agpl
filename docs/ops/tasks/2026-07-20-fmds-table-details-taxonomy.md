# Task: FMDS Table Details and Governed Taxonomy

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-20
Task ID: AAI-1206
Linear Issue: [AAI-1206](https://linear.app/megankharrison/issue/AAI-1206/add-fmds-table-details-and-governed-filtering-taxonomy)
Related Handoff: `docs/ops/handoffs/2026-07-20-S198-fmds-table-details-taxonomy.md`

## Objective

An authenticated user can open an FMDS table row, inspect its complete source-backed record, and filter the canonical table directory by governed protection taxonomy tags.

## Scope

- Relational `fm_table_taxonomies` and `fm_table_taxonomy_assignments` database contract, seeded with the requested protection concepts.
- FMDS table detail route, row navigation, category/tag columns, and toolbar filtering on the canonical directory/dashboard.
- Excluded: assignment editing UI and reclassifying uncertain legacy records without source review.

## Source of Truth

- Canonical runtime/data owner: `fm_global_tables` and `frontend/src/lib/fmds/`.
- Existing shared primitives/services: `GenericConfigUnifiedTable`, `UnifiedTablePage`, `PageShell`, Supabase server client.
- Deprecated or parallel paths: legacy untyped `fm_global_tables` list configuration.

Verification contract: Required

## Acceptance Criteria

- [ ] Each selectable FMDS table row opens a specific detail route.
- [ ] The detail route shows table identity, complete source fields, and assigned taxonomy tags.
- [ ] Categories and tags are relational, constrained, indexed, and filterable without free-text drift.
- [ ] Ceiling-level, wet, dry, and in-rack are available as governed taxonomy records.
- [ ] Unclassified tables are visible instead of silently treated as a match.

## Implementation Checklist

- [ ] Existing table schema, source adapter, and shared table/detail primitives inspected.
- [ ] Database types generated and inspected before schema code.
- [ ] Migration created with the Supabase CLI, applied remotely, and ledger-verified.
- [ ] Frontend types/query adapter expose taxonomy fields safely.
- [ ] Detail route and row-click configuration reuse canonical route/page patterns.
- [ ] Table columns and filters use the relational taxonomy contract.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual authenticated user flow proves table list -> detail -> taxonomy filter.
- [ ] Evidence artifacts and a viewable canonical-route screenshot are recorded in Linear.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: explicit table-not-found state or taxonomy-load error with table identifier.
- Detection path: detail-route alert, taxonomy query error state, targeted tests, and migration ledger verification.
- Recovery path: return to the FMDS directory, verify the identifier, or repair the scoped taxonomy assignment.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: relational vocabulary and explicit unclassified state prevent silent free-text drift.
- Guardrail evidence: foreign keys, uniqueness, indexed filter relation, and targeted contract tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1206 | Passed | Scope and done gate captured before implementation. |
| Canonical data inspection | `frontend/src/lib/fmds/fmds-tables.server.ts` | Passed | `/fm-global` reads dedicated ASRS `fmds_tables`, not legacy PM APP `fm_global_tables`. |
| Remote migration access | `supabase projects list --output json` | Blocked | Dedicated ASRS project is not available in the configured Supabase CLI project list. |
| Ownership inspection | `docs/ops/orchestration/session-board.md` | Blocked | S197 currently owns the canonical FMDS adapter/page being extended. |

## Remaining Risk

- Blocked: S197 owns the canonical FMDS adapter/page. Cause: overlapping active ownership. Detection gap: session board previously scoped the whole adapter/page rather than an isolated slice. Prevention: wait for S197 acceptance or obtain an explicit handoff before editing. Owner: S197. Next action: accept or transfer the FMDS adapter/page scope.
- Blocked: the dedicated ASRS Supabase project is unavailable to the configured CLI. Cause: no ASRS project reference/credential is present in the CLI project list. Detection gap: the production runtime has encrypted ASRS URL/key variables but no migration-control-plane linkage. Prevention: establish a linked ASRS Supabase project or migration repository. Owner: platform data owner. Next action: provide/establish ASRS project migration access, then apply and ledger-verify the taxonomy migration.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
