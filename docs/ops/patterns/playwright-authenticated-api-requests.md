# Pattern: Playwright Authenticated API Requests

Last validated: 2026-04-14
Severity: High
Category: Testing auth

## Problem

Playwright API requests fail with 401/403 when auth fixtures or token propagation are skipped.

## Required Rule

- Reuse the project auth setup/state and fixture conventions.
- For API calls in tests, use authenticated request helpers/fixtures.
- Never add manual login flows to every spec.

## Guardrails

- Keep auth state in `frontend/tests/.auth/user.json`.
- Refresh auth state through the dedicated auth setup flow when expired.
- Fail tests with explicit auth diagnostics instead of generic errors.

## Failure Signals

- API E2E requests fail while UI navigation succeeds.
- Repeated “please login manually” workflow during test authoring.

## Evidence Source

- Legacy references: `docs/patterns/errors/auth-fixture-missing.md`
- Guardrails reference: `AGENTS.md`
