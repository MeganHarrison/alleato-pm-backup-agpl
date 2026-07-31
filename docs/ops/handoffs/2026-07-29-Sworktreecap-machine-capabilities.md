# Handoff: Machine-Level Capabilities

Session: Sworktreecap
Task: local-machine-capabilities
Status: Complete

## Localized Boundary

`git worktree add` produced the source checkout, but ignored checkout-local
provider state did not cross the boundary. Vercel remained available because
its CLI authentication was already user-scoped. Supabase failed because the
valid Management API token was only present in `frontend/.env.local`.

## Confirmed Root Cause

The isolation bootstrap treated Git materialization as environment
provisioning. No shared machine capability owner or preflight contract existed.

## Prevention

Resolve secrets from Windows user-level state, create an independent read-only
environment materialization plus non-secret project linkage, provision locked
root/frontend executables from the offline package store, cache remote provider
checks, and reject incomplete workspace creation transactionally.

## Verification

See `docs/ops/evidence/2026-07-29-machine-capabilities/verification.md`.

Current machine state:

- Shared environment:
  `C:\Users\KimiClaw\.codex\capabilities\alleato-project-management.env`,
  ACL-limited to the current Windows user and marked read-only.
- Supabase: direct production database access passes; Management API token is
  valid for eight projects but does not expose legacy production project
  `lgveqfnpkxvzbnnwuled`.
- Vercel: machine login resolves `the-alleato-group/project-management-agent`.
- Browser: `agent-browser` 0.33.1 and refreshed authenticated `/tasks` session
  pass.
- Published-origin canary: a new isolated workspace provisioned locked root and
  frontend dependencies, read-only machine environment, Supabase/Vercel
  linkage, and a clean authenticated production browser session.
- Independent review: approved after database-only workspaces were prevented
  from receiving frontend runtime secrets.
- Dependency completeness: approved after the canary proved that
  `NODE_ENV=production` could omit Playwright; provisioning now forces locked
  development dependencies and treats `next` without `playwright` as unready.
