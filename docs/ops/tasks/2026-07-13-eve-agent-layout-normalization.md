# Task: Normalize Eve agent layout

Status: Partial
Owner: Codex
Created: 2026-07-13
Task ID: Local task - Linear issue creation blocked by invalid Linear connector auth grant
Linear Issue: Blocked - `mcp__codex_apps__linear._save_issue` returned `UNAUTHORIZED` with `oauth_token_invalid_grant` and `TRIGGER_REAUTHENTICATION`
Related Handoff: `docs/ops/handoffs/2026-07-13-S137-eve-agent-layout-normalization.md`

## Objective

Put every Eve app in one canonical repo-level collection under `agents/<name>/`
while preserving each package's internal Eve-authored `agent/` directory.

## Scope

- Move the special-cased root App Expert Eve lab package into `agents/`
- Update workspace/package discovery and repo references that still privilege
  the root `agent/` path
- Excludes broader backend Python `backend/src/services/agents/**` cleanup

## Source of Truth

- Canonical runtime/data owner: Eve package layout docs under
  `node_modules/eve/docs/reference/project-layout.md`
- Existing shared primitives/services: `agents/github-issue-triage/**`,
  `agents/project-intelligence-maintainer/**`, `agents/docs-freshness-maintainer/**`
- Deprecated or parallel paths: root `agent/` package and any root-level
  workspace/doc references that assume a singular Eve app outside `agents/`

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [ ] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: stale root `agent/` references fail the targeted audit or
  the moved Eve package fails local install/build commands
- Detection path: reference audit via `rg`, workspace inspection, and package
  local verification commands
- Recovery path: update remaining hardcoded references, rerun targeted package
  checks, and keep root-path support removed unless a documented blocker remains

## Incident Learning

Use `N/A` only for work that did not discover or address a failure. Significant
bugs and repeated problems must reference an ID in
`docs/ops/learning/recurring-failures.yaml`.

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Linear issue creation | `mcp__codex_apps__linear._save_issue` | Blocked | Connector returned `UNAUTHORIZED` with `oauth_token_invalid_grant`; proceeding with exact blocker proof captured here and in handoff. |
| Reference planning | `rg` + Eve docs audit | Pass | Identified the real ownership boundary: repo-level collection should be `agents/**`, and each Eve package should keep its own internal `agent/` directory. |
| Eve launcher syntax | `bash -n scripts/dev/eve.sh` | Pass | Launcher shell script is valid after path rewiring. |
| Workspace/lockfile refresh | `npm install --workspace agents/app-expert-eve-lab`; `npm install --package-lock-only --ignore-scripts` | Pass with expected engine warnings | Local default Node is v22.17.1, so npm warns that Eve packages require Node 24. Install/lockfile refresh still completed. |
| App-help verifier | `npm run verify:eve-app-help-agent` | Pass | Verifier resolved the moved package and confirmed the prompt contract plus help-corpus search proof. |
| Eve runtime readback | `npm run eve -- info` | Pass | Eve now resolves `App Root .../agents/app-expert-eve-lab`, `Agent Root .../agents/app-expert-eve-lab/agent`, and `Layout nested` with 0 errors and 0 warnings. |
| Lockfile cleanup readback | Inline Node readback of `package-lock.json` | Pass | Root workspaces now point to `agents/*`; stale root `agent` package entry removed; new package entry exists at `agents/app-expert-eve-lab`. |

## Remaining Risk

- Historical evidence docs under `docs/ops/tasks/**` and `docs/ops/handoffs/**`
  still reference the old root `agent/` path because they are retained as
  historical records, not current source-of-truth docs.
- The task is not published because the checkout has unrelated existing dirt and
  the Linear connector is reauthentication-blocked.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
