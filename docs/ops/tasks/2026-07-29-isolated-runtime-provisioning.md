# Task: Isolated Runtime Provisioning

Status: In Progress
Owner: Codex Sworktreeconfig
Created: 2026-07-29
Task ID: local-isolated-runtime-provisioning
Linear Issue: Not requested; this is a single-session infrastructure correction.
Related Handoff: `docs/ops/handoffs/2026-07-29-Sworktreeconfig-isolated-runtime-provisioning.md`

## Objective

Make isolated Codex workspaces usable for production-backed verification without
printing, tracking, or silently omitting required runtime configuration.

## Scope

- Copy a fixed allowlist of ignored runtime files from a configured source.
- Support explicit required-file checks during workspace creation.
- Record only source/file metadata, never secret values.
- Remove the just-created worktree and branch when provisioning fails.

Delivery lane: High-risk

Verification contract: Not applicable

## Acceptance Criteria

- [ ] A configured source provisions approved ignored frontend env, Vercel link,
  and Playwright auth files.
- [ ] Provisioned values never appear in stdout or the workspace registry.
- [ ] Git continues to report the new workspace as clean.
- [ ] A missing required file fails with an actionable message.
- [ ] Provisioning failure removes the incomplete worktree and branch.
- [ ] A real assessment workspace can run Supabase/Vercel/auth preflights.

## Failure-Loudly Contract

- Cause surfaced as: missing runtime source, non-allowlisted path, non-ignored
  destination, or missing required file.
- Detection path: focused Node tests plus a real isolated-workspace creation.
- Recovery path: configure `codex.runtimeConfigSource` or pass
  `--runtime-source`, then retry creation.

## Evidence

Pending.
