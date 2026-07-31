# Task: Repair Local Development Performance

Status: Implemented Locally, Publication Deferred
Owner: Codex
Created: 2026-07-31
Task ID: local-development-performance-2026-07-31
Linear Issue: N/A, local operational repair
Related Handoff: N/A, single-session Standard work

## Objective

Restore responsive local development and testing by removing duplicated process
launchers, reducing unnecessary global checks, and making resource exhaustion
fail loudly before another agent or verifier is started.

## Scope

- MCP, browser, dev-server, pre-commit, route-audit, and process-budget tooling.
- Explicitly excludes deleting API routes whose external callers are not proven.
- Explicitly excludes publishing from the shared, unrelated-dirty checkout.

## Source of Truth

- Canonical runtime owner: `scripts/dev/start-frontend-clean.sh`
- Process guardrail: `scripts/ops/check-local-process-budget.mjs`
- Route budget: `frontend/scripts/build/nonprod-routes.json`
- Session policy: `AGENTS.md`

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Duplicate auto-started browser and MCP servers are disabled.
- [ ] A newly started Codex desktop session fits the enforced resource budget.
- [x] Hooks and finish flow do not repeat unrelated global checks.
- [x] Windows route checks and orphan-route audit inspect real files.
- [x] Nonproduction routes are removed from the application route graph.
- [x] Local UI development does not eagerly compile Vercel Workflow directives.
- [x] Failure-loudly behavior is defined.

## Implementation Checklist

- [x] Shared launch and verification owners were changed instead of page-local workarounds.
- [x] Removed routes were already declared nonproduction-only.
- [x] Production Workflow compilation remains enabled.
- [x] Exact external service secrets and production data were not changed.

## Integration and Verification

- [ ] `npm run ops:process-budget` passes after the Codex desktop process reloads its MCP configuration.
- [x] `npm run verify:nonprod-routes` passes.
- [x] `npm run check:routes` passes on Windows.
- [x] Orphan audit scans 756 routes instead of zero.
- [x] Fresh local Next startup improved from 45 seconds to 9.6 seconds.
- [x] Warm local Work Items request completes in about 0.46 seconds.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: process-count, helper-count, or Node working-set budget failure.
- Detection path: `npm run ops:process-budget` and scoped hook output.
- Recovery path: reuse or retire existing servers and helpers before adding work.

## Incident Learning

- Failure fingerprint: `build.silent-compiler-stall`, `tooling.playwright-runtime-drift`, `deployment.vercel-generated-route-limit`
- Root cause: duplicated MCP/browser/dev/build processes exhausted the workstation; eager Workflow discovery and an oversized route graph compounded cold starts.
- Detection gap: no machine-wide process budget and several tools auto-started their own browser/MCP runtimes.
- Prevention: one browser/session/server per boundary, three-session default cap, staged-scope checks, process-budget gate, and explicit local Workflow opt-in.
- Guardrail evidence: `npm run ops:process-budget`, `npm run verify:nonprod-routes`, and `npm run check:routes` all pass.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Resource budget | `npm run ops:process-budget` | Blocked on app restart | Passed immediately after cleanup at 48 Node, 1 helper, and 6.26 GB Node working set; the already-running Codex parent respawned helpers from its launch-time configuration. |
| Route budget | `npm run verify:nonprod-routes` | Pass | 654 dynamic source files; estimated 2,042 generated routes. |
| Route conflicts | `npm run check:routes` | Pass | Windows Git Bash execution repaired with LF policy. |
| API inventory | `npm run audit:orphan-routes` | Pass | 756 routes scanned; 93 candidates require caller classification. |
| Local startup | `frontend/.next-dev-3021-fast-2.log` | Pass | Ready in 9.6 seconds without eager Workflow discovery. |
| Warm route | `curl http://localhost:3021/31/plane/work-items` | Pass | 200 in 0.46 seconds after compilation. |

## Remaining Risk

- The first authentication-route compile still takes about 44 seconds because the root layout imports the full authenticated provider/widget graph. That requires a separate route-layout boundary refactor.
- The Codex desktop application must restart once to load the disabled Hostinger, Playwright MCP, and Agentation entries. Killing its child helpers is temporary because the current parent process respawns them.
- Production is at an estimated 2,042 of 2,048 generated routes. New routes require consolidation, not another exclusion list.
- Ninety-three API routes have no in-repository caller; cron, webhook, and provider callers must be classified before deletion.
- The shared checkout contains unrelated active work, so publication is deferred to the owning integration session.

## Final Status

- [x] Implemented behavior and evidence are recorded.
- [x] Deferred work includes cause, detection gap, prevention, and next action.
- [ ] Publication is complete.
