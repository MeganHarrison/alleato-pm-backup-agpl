# Handoff: Isolated Runtime Provisioning

Session: Sworktreeconfig
Task: local-isolated-runtime-provisioning
Status: In Progress

## Localized boundary

Git-tracked source was present in isolated workspaces, but ignored operational
configuration was absent. Production auth setup failed for missing Supabase
variables inside the worktree and passed after those variables were loaded from
the configured checkout. Vercel inspection likewise worked from the linked
checkout.

## Root cause

`isolated-session-workspace create` created only the Git worktree and had no
runtime-configuration provisioning contract or required-capability check.

## Prevention

Provision only an explicit allowlist of ignored files, retain no secret values
in logs/registry data, and fail creation transactionally when a required file is
unavailable.
