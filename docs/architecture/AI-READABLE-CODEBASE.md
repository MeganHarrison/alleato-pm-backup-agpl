# Making the Codebase Readable for AI

This repository uses a layered context system. The goal is not to copy the
entire codebase into Postgres or a vector database. The goal is to make the
repository's facts discoverable, its meaning explicit, and its ownership
boundaries machine-checkable.

## How AI understands this codebase

Fresh AI sessions should load context in this order:

1. `AGENTS.md` — rules, safety requirements, canonical infrastructure, and
   verification gates.
2. `CONTEXT.md` — domain terms, invariants, identity contracts, and canonical
   module ownership.
3. `docs/architecture/SYSTEM-MAP.md` — a generated cross-layer index.
4. `docs/architecture/ALLEATO-SYSTEM-MAP.md` — runtime ownership and AI runtime
   decision rules.
5. `docs/architecture/PROJECT-MAP.md` — the generated page, API, and AI-tool
   inventory.
6. `docs/architecture/tables.yaml` and `TABLE-LIST.md` — database meaning and
   generated schema facts.
7. The smallest relevant source files, tests, migrations, and evidence files.

This order matters. Rules and vocabulary prevent an agent from making a
technically plausible but architecturally wrong change. Generated maps help it
find the canonical owner. Source and tests provide the final behavioral truth.

The AI should not treat documentation as more authoritative than running code.
Documentation describes intent and ownership; source, database readbacks,
browser evidence, traces, and tests prove current behavior.

## What belongs where

| Information | Canonical location | Why |
| --- | --- | --- |
| Repository rules and guardrails | `AGENTS.md` | Loaded before implementation and verification. |
| Domain language and invariants | `CONTEXT.md` | Prevents semantic drift and duplicate concepts. |
| Route/API/tool inventory | Generated `PROJECT-MAP.md` | Filesystem-derived and searchable. |
| Table meaning and gotchas | Curated `tables.yaml` | Human meaning cannot be reliably inferred from schema alone. |
| Live schema facts | Generated DB inventory and DB types | Keeps columns, relationships, and types tied to the database. |
| Runtime ownership decisions | `ALLEATO-SYSTEM-MAP.md` and ADRs | Explains why work belongs in frontend, backend, Supabase, or an agent runtime. |
| Cross-layer navigation | Generated `SYSTEM-MAP.md` and JSON | Gives fresh agents one small starting point. |
| Runtime/searchable product knowledge | Postgres/RAG | Use only when the application needs that knowledge at runtime. |

Postgres is therefore a database contract and runtime knowledge store—not the
master catalog for the whole repository. Putting all architecture there would
create a second source of truth, require database access for basic code
navigation, and make local/offline work less reliable.

## Generated versus curated information

Generated artifacts answer “what exists right now?” They include routes, API
files, AI tools, database schema observations, and cross-layer counts. They are
regenerated from code or schema and must not be edited manually.

Curated artifacts answer “what does this mean, who owns it, and what can go
wrong?” They include domain definitions, table gotchas, architecture decisions,
failure patterns, and runtime ownership. They must be updated when behavior or
ownership changes.

The system map combines both kinds without replacing either one.

## Commands to keep context current

### Routine surface change

When adding or moving a page, API route, or AI tool:

```bash
npm run map:project
npm run map:system
npm run map:system -- --check-only
```

### Database change

Before writing database-dependent code, regenerate and inspect types:

```bash
npm run db:types
npm run db:inventory
npm run map:system
npm run db:types:check
```

For migrations, also apply or explicitly defer the migration and run the
migration-ledger verification required by `AGENTS.md`.

### Route change

```bash
npm run check:routes
npm run map:project
npm run map:system -- --check-only
```

### Full documentation refresh

```bash
npm run map:project
npm run db:inventory
npm run docs:reference
npm run docs:generate-app-expert
npm run map:system
npm run map:system -- --check-only
```

`docs:reference` and `docs:generate-app-expert` are useful when the change
affects the documentation/help surfaces. They are not substitutes for the
route or database generators.

### CI or pre-commit drift check

```bash
npm run map:project -- --check-only
npm run db:inventory -- --check-only
npm run map:system -- --check-only
```

The repository hook `.husky/pre-commit-project-map` automatically runs the
system-map check when routes, AI tools, database metadata, architecture guides,
or map generators are staged. The PR guardrail workflow runs both project-map
and system-map checks on every pull request and push to `main`.

The system-map check intentionally fails loudly and tells the maintainer the
exact regeneration command. Structural drift is detected automatically;
semantic drift still requires updating the relevant curated document.

## How to improve AI readability over time

- Give every important module one clear owner and name it in `CONTEXT.md`.
- Add a short “use this when / do not use this when” note for confusing
  boundaries.
- Prefer typed contracts and shared services over repeated inline logic.
- Add table `purpose`, `owner`, `gotchas`, and `notesForAi` metadata when a
  database table is non-obvious.
- Make route descriptions specific enough for both humans and `findAppPage`.
- Record recurring failures with cause, detection gap, and prevention.
- Keep generated artifacts deterministic so stale context fails in CI.
- Link architecture docs to tests, migrations, runtime traces, and browser
  evidence when a claim depends on live behavior.

## What not to do

- Do not embed the entire repository and assume retrieval will recover
  ownership or invariants.
- Do not put code architecture only in Postgres.
- Do not create a second route or table inventory by hand.
- Do not let an AI-generated summary override source, schema, or runtime proof.
- Do not document multiple “canonical” owners for one workflow without an ADR
  explaining the transition.

## Maintenance ownership

The generated map is maintained by `scripts/dev-tools/generate-system-map.mjs`.
The detailed route map is maintained by
`scripts/dev-tools/generate-project-map.mjs`. The detailed database inventory is
maintained by `scripts/dev-tools/generate-db-inventory.mjs` and
`docs/architecture/tables.yaml`.

When a change touches more than one layer, update the source owner for each
layer first, then regenerate the maps. A map is useful only when it points to
the current owner and fails loudly when its generated facts drift.
