# Pattern: Route Parameter Naming

Last validated: 2026-04-14
Severity: Critical
Category: Next.js routing

## Problem

Generic route params like `[id]` create collisions and ambiguous params across nested routes.

## Required Rule

- Never use generic `[id]` in app routes.
- Use explicit names: `[projectId]`, `[contractId]`, `[companyId]`, `[userId]`, `[recordId]`.
- Run `npm run check:routes` after adding or renaming dynamic routes.

## Failure Signals

- Route conflicts or unexpected 404s after route changes.
- Param mismatch errors in handlers or pages.

## Evidence Source

- Legacy references: `docs/patterns/errors/route-param-mismatch.md`
- Guardrails reference: `AGENTS.md`
