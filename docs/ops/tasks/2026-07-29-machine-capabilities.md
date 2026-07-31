# Task: Machine-Level Capabilities for Isolated Workspaces

Status: Complete
Owner: Codex Sworktreecap
Created: 2026-07-29
Task ID: local-machine-capabilities
Linear Issue: Not requested; this is a single-session infrastructure correction.
Related Handoff: `docs/ops/handoffs/2026-07-29-Sworktreecap-machine-capabilities.md`

Delivery lane: High-risk

## Objective

Make production-backed development and verification work from every isolated
workspace by resolving credentials from machine-level state, generating only
non-secret project linkage in each workspace, and failing before work begins
when a requested capability is unavailable.

## Acceptance Contract

- [x] Supabase access is available from Windows user-level state. The current
      versioned Management API token remains useful for accessible projects;
      production project `lgveqfnpkxvzbnnwuled` is verified through the direct
      database URL because that legacy project is not visible to the current
      platform account.
- [x] Vercel CLI authentication is machine-level and exposes team
      `the-alleato-group` and project `project-management-agent`.
- [x] Isolated workspace creation never borrows `.env*` or browser storage
      state from another checkout. It creates an independent read-only
      materialization from the ACL-protected machine source and regenerates
      browser state only when needed.
- [x] New workspaces receive non-secret Supabase and Vercel project linkage.
- [x] New workspaces receive locked root and frontend dependency executables
      from the offline package store or creation fails transactionally.
- [x] Capability checks are local and fast by default; remote checks are cached.
- [x] Locked root and frontend dependencies provision through a concrete pnpm
      JavaScript entrypoint on Windows, without shell command interpretation.
- [x] Dependency readiness checks target executables actually declared by each
      package (`tsx` at root plus `next` and `playwright` in the frontend),
      force development dependencies, and preserve the original provisioning
      failure during cleanup.
- [x] A fresh isolated workspace can reach the production Supabase database,
      generate remote TypeScript type output without Docker, inspect the Vercel
      project, and refresh authenticated browser state when needed.
- [x] Secrets never appear in registry records, evidence, or commits. Browser
      cookie failures redact values. One pre-guardrail test-session diagnostic
      was revoked immediately and replaced.
- [x] Provisioning failure removes the incomplete worktree and branch.

## Failure-Loudly Contract

- Cause: name the missing machine capability, provider, and expected project.
- Detection: `machine-capabilities check` at workspace creation plus a fresh
  real-worktree canary.
- Recovery: configure the capability once at Windows user scope, then retry
  creation. Product work must not begin in a partially provisioned workspace.

## Root Cause

The workspace boundary contained Git-tracked source only, while provider
credentials and project linkage were stored in one checkout's ignored files.
The creation command registered workspaces without checking or provisioning
those capabilities.

## Detection Gap

Existing tests proved path ownership and Git isolation but never proved that a
new workspace could reach the production providers required by the task.

## Prevention

Machine-level credential resolution, non-secret linkage generation, locked
offline dependency provisioning, cached provider canaries, transactional
creation cleanup, capability inference from owned paths, least-privilege
provider linkage, and fresh-worktree regression coverage.

## Evidence

See `docs/ops/evidence/2026-07-29-machine-capabilities/verification.md`.
