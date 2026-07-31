# Task: Local frontend Windows launcher

Status: In Progress
Owner: Codex
Created: 2026-07-31
Task ID: LOCAL-FRONTEND-WINDOWS-LAUNCHER
Linear Issue: N/A (Standard local launcher hardening; no external tracking requested)
Related Handoff: N/A

## Objective

Make `frontend` dev startup use a Windows-compatible managed launcher while preserving the existing Unix launcher behavior and per-port Next.js output isolation.

## Scope

- `.gitattributes`
- `frontend/package.json`
- `frontend/scripts/dev/start-frontend-clean.mjs`
- `frontend/scripts/dev/__tests__/start-frontend-clean.unit.test.mjs`
- `docs/ops/tasks/2026-07-31-local-frontend-windows-launcher.md`

## Source of Truth

- Canonical runtime/data owner: local frontend dev startup contract in `frontend/package.json`
- Existing shared primitives/services: `scripts/dev/start-frontend-clean.sh`, `frontend/scripts/dev/write-dev-tsconfig.mjs`, `frontend/next.config.ts`
- Deprecated or parallel paths: direct `bash ../scripts/dev/start-frontend-clean.sh` invocation on Windows

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [ ] `npm run dev` from `frontend` no longer relies on WSL bash on Windows.
- [ ] Port-scoped `NEXT_DIST_DIR` and `NEXT_TSCONFIG_PATH` remain enforced.
- [ ] Failure-loudly behavior is defined.
- [ ] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [ ] Files/modules to change are listed before edits.
- [ ] Shared abstraction owns cross-cutting behavior.
- [ ] Errors are specific and actionable.
- [ ] Database, provider, authentication, permission, or delivery contracts are handled when applicable.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are committed locally and intentionally not published.

## Failure-Loudly Contract

- Cause surfaced as: explicit launcher errors for escaped `node_modules`, missing `next.cmd`, unmanaged occupied port, or child-process startup failure
- Detection path: `npm run dev` output in `frontend`
- Recovery path: stop the unmanaged process or repair local dependencies, then rerun the managed launcher

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Focused unit test | `node --test frontend/scripts/dev/__tests__/start-frontend-clean.unit.test.mjs` | Pass | Windows launcher config/path tests passed after the child-process launch contract was switched away from bash and direct `.cmd` spawn. |
| Diff hygiene | `git diff --check -- .gitattributes frontend/package.json frontend/scripts/dev/start-frontend-clean.mjs frontend/scripts/dev/__tests__/start-frontend-clean.unit.test.mjs docs/ops/tasks/2026-07-31-local-frontend-windows-launcher.md` | Pass | Returned only Git line-ending warnings for tracked files under `core.autocrlf=true`; no whitespace or patch-shape failures. |
| Bounded smoke attempts | Ports `3065` to `3068` in this isolated workspace | Blocked | Failures localized to environment and Windows child-process launch boundaries: missing `next.cmd` before install, `pnpm install --frozen-lockfile` blocked by the existing Windows-incompatible `postinstall` shell command, direct `.cmd` spawn returned `EINVAL`, and one interrupted bounded smoke left a stale wrapper PID that was removed after confirming the process was gone. |

## Remaining Risk

- Need one clean bounded smoke in a workspace whose dependency install path is already Windows-safe, because this workspace required `--ignore-scripts` and the final smoke run was interrupted before a live route response could be observed.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
