# Task: Local Frontend Dev Outage

Status: Complete
Owner: Codex
Created: 2026-07-04
Linear Issue: N/A - local development outage repair
Linear URL: N/A

## Objective

Restore reliable local frontend development on `http://localhost:3001` and add a guardrail so corrupted dependency ownership fails loudly instead of leaving a poisoned dev server running.

## Root Cause

Initial evidence shows the running `next dev` process for this checkout is loading dependencies from `/private/tmp/alleato-prod-meeting-export-fix/...` because `frontend/node_modules/*` symlinks point outside `/Users/meganharrison/Documents/alleato-pm/frontend`. The server can answer a root redirect while still being tied to the wrong dependency tree, causing unreliable page loads and high CPU churn.

## Acceptance Criteria

- [x] `frontend/node_modules` is rebuilt so top-level dependency symlinks resolve inside this checkout.
- [x] Stale `next dev` processes using escaped dependency paths are stopped.
- [x] `scripts/dev/start-frontend-clean.sh` detects escaped dependency symlinks before starting or adopting a dev server.
- [x] `http://localhost:3001/` returns the expected auth redirect after a clean restart.
- [x] A protected app route loads far enough to prove the frontend runtime is serving this checkout.
- [x] Focused verification evidence is recorded below.

## Implementation Checklist

- [x] Confirm the active port/process state before changing anything.
- [x] Confirm dependency symlink ownership before changing anything.
- [x] Rebuild dependencies from the local lockfile.
- [x] Patch the shared frontend startup script with a fail-loud guardrail.
- [x] Restart the frontend cleanly.
- [x] Record curl and browser evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Port owner | `lsof -nP -iTCP:3001 -sTCP:LISTEN` | Fail reproduced | Port `3001` owned by `next-server` PID `25295` with high CPU. |
| Process command | `ps -p 25295 -o pid,ppid,etime,pcpu,pmem,command=` | Fail reproduced | Parent `next dev` command resolves through `/private/tmp/alleato-prod-meeting-export-fix/...`. |
| Dependency ownership | `realpath frontend/node_modules/next` | Fail reproduced | `next` resolves to `/private/tmp/alleato-prod-meeting-export-fix/frontend/node_modules/.pnpm/...`. |
| Top-level symlink sweep | `find frontend/node_modules -maxdepth 1 -type l ...` | Fail reproduced | Many top-level dependencies resolve outside this checkout. |
| Dependency repair | `rm -rf frontend/node_modules frontend/.next && pnpm --dir frontend install --frozen-lockfile --force` | Pass | Rebuilt and relinked frontend dependencies from the local lockfile. |
| Repaired dependency ownership | `realpath frontend/node_modules/next` | Pass | `next` now resolves inside `/Users/meganharrison/Documents/alleato-pm/frontend/node_modules/.pnpm/...`. |
| Ownership guard | `bash -n scripts/dev/start-frontend-clean.sh` and top-level symlink sweep | Pass | Startup script syntax is valid and no top-level dependency symlink escapes the checkout. |
| Detached server | `tmux new-session -d -s alleato-frontend-dev ...` | Pass | Dev server remains attached to tmux session `alleato-frontend-dev`; logs at `/tmp/alleato-frontend-dev.log`. |
| Server process | `lsof -nP -iTCP:3001 -sTCP:LISTEN` and parent `ps` | Pass | Port `3001` is served by local `next dev --port 3001` under this checkout's `frontend/node_modules`. |
| Root/auth health | `curl -sSI http://localhost:3001/` and `curl -sSI http://localhost:3001/auth/login` | Pass | `/` returns expected `307` to `/auth/login`; `/auth/login` returns `200`. |
| Browser route proof | `agent-browser open http://localhost:3001/876/drawings && agent-browser get title && agent-browser get url` | Pass | Browser reached title `Alleato Construction PM` at `http://localhost:3001/876/drawings`; interactive snapshot capture hung in agent-browser after route/title returned. |
| App route logs | `tail /tmp/alleato-frontend-dev.log` | Pass | Logs show `GET /876/drawings 200`, drawing viewer `200`, and project drawing APIs returning `200`. |
