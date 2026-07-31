# System Map

> **AUTO-GENERATED — do not edit by hand.** Regenerate with `npm run map:system`.
> This is the navigation index for fresh AI sessions; detailed facts remain in the linked source files.

## What an AI agent reads

1. `AGENTS.md` for rules, safety, ownership, and verification gates.
2. `CONTEXT.md` for domain vocabulary and invariants.
3. `docs/architecture/AI-READABLE-CODEBASE.md` for the loading strategy and maintenance commands.
4. This map to choose the relevant runtime and detailed inventory.
5. The smallest relevant route, service, module, migration, test, and evidence artifact.

## Current surface counts

| Surface | Count | Detailed owner |
| --- | ---: | --- |
| UI/API surface rows | 366 | `docs/architecture/PROJECT-MAP.md` |
| API endpoint sections | 787 | `docs/architecture/PROJECT-MAP.md` |
| AI tool rows | 113 | `docs/architecture/PROJECT-MAP.md` |
| Database metadata entries | 534 | `docs/architecture/tables.yaml` |
| Main database entries | 510 | `docs/architecture/tables.yaml` |
| RAG database entries | 24 | `docs/architecture/tables.yaml` |

## Runtime ownership

| Work | Canonical owner |
| --- | --- |
| User-facing pages, forms, tables, and app API routes | `frontend/src/app/**`, `frontend/src/components/**`, `frontend/src/features/**` |
| Product AI reasoning and skill selection | `agents/alleato-assistant/**` |
| Product AI transport and authenticated tools | `frontend/src/app/api/ai-assistant/eve/**`, `frontend/src/lib/ai/eve-runtime/**` |
| Ingestion, Graph, Fireflies, OCR, embeddings, and scheduled processing | `backend/src/services/**` on Render |
| Schema, RLS, RPCs, and migrations | `supabase/migrations/**` plus generated DB types |

## Source index

- `AGENTS.md` — Repository rules, verification gates, and ownership boundaries.
- `CONTEXT.md` — Canonical domain vocabulary and invariants.
- `docs/architecture/ALLEATO-SYSTEM-MAP.md` — Frontend, backend, Supabase, and AI runtime boundaries.
- `docs/architecture/PROJECT-MAP.md` — Generated pages, APIs, and AI tools.
- `docs/architecture/tables.yaml` — Curated table meaning, ownership, gotchas, and relationships.
- `docs/architecture/TABLE-LIST.md` — Generated live database inventory and schema facts.
- `docs/architecture/AI-READABLE-CODEBASE.md` — How agents load context and how maintainers update it.

## Update contract

- Change a route, API route, or AI tool: run `npm run map:project`.
- Change table meaning, ownership, gotchas, or relationships: edit `docs/architecture/tables.yaml`, then run `npm run db:inventory`.
- Change a migration or database shape: run `npm run db:types`, inspect generated types, and run the migration ledger verification required by `AGENTS.md`.
- Change runtime ownership or domain meaning: update `ALLEATO-SYSTEM-MAP.md` or `CONTEXT.md` directly.
- After all changes: run `npm run map:system` and `npm run map:system -- --check-only`.

## Generated commands

- `npm run map:project`
- `npm run db:inventory`
- `npm run map:system`
- `npm run map:system -- --check-only`
- `npm run db:types`
- `npm run db:types:check`
- `npm run check:routes`
