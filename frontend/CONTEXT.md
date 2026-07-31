# Frontend Context

## Owns

- The Next.js App Router user experience, server route handlers, and frontend
  service/adapters under `frontend/src/`.
- Shared layout, design-system, table, form, and data-fetching patterns.

## Start here

- `docs/architecture/PROJECT-MAP.md` for canonical routes and owners.
- `docs/architecture/tables.yaml` before database-backed frontend changes.
- Root `CONTEXT.md` for shared domain terms.
- `docs/ops/adr/` for relevant durable decisions.

## Guardrails

- Reuse the canonical route, component, table, form, or data hook before adding
  a parallel implementation.
- For a defect, localize the first failing boundary from runtime evidence before
  editing code.
- User-visible work requires end-to-end proof and canonical-route screenshots.
