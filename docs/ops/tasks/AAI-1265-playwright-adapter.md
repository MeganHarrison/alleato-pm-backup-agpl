# Task: Repair Codex Playwright Adapter Runtime Alignment

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: AAI-1265-playwright-adapter
Linear Issue: Related to AAI-1265; no separate Linear issue required for this bounded tooling repair.
Related Handoff: N/A

## Objective

The Codex Playwright adapter opens the local Eve route without rejecting the seed test because of duplicate Playwright runtimes.

## Scope

- Make the frontend Playwright installation the sole owner inside the MCP adapter process.
- Add a fail-loudly physical-runtime preflight that owns adapter startup.
- Exclude product runtime and UI changes.

## Source of Truth

- Canonical runtime/data owner: Frontend Playwright runner and frontend Playwright test imports within one MCP process.
- Existing shared primitives/services: `.mcp.json`, root and frontend package manifests and lockfiles.
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Codex adapter setup completes without the duplicate-runtime error.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are not applicable.

## Integration and Verification

- [x] Targeted physical-runtime ownership check passes.
- [x] Adapter opens the local Eve route and captures browser evidence.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: Exact MCP bootstrap mismatch or two resolved physical Playwright runtime paths.
- Detection path: `node scripts/verify/verify-playwright-runtime-alignment.mjs`
- Recovery path: Restore the guarded MCP bootstrap and reinstall frontend dependencies.

## Incident Learning

- Failure fingerprint: `tooling.playwright-runtime-drift`
- Root cause: The MCP process started from the repository root, then loaded the seed through the frontend's second physical Playwright installation.
- Detection gap: The MCP bootstrap did not declare one package-installation owner or compare resolved physical runtime paths.
- Prevention: Start MCP through the frontend installation and fail startup if its direct and test-runner Playwright resolutions differ.
- Guardrail evidence: `node scripts/verify/verify-playwright-runtime-alignment.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime reproduction | `generator_setup_page` | Failed as expected | Stack crossed root runner into frontend Playwright 1.58.1. |
| Runtime ownership | `node scripts/verify/verify-playwright-runtime-alignment.mjs` | Pass | Frontend direct and test-runner imports share one physical Playwright 1.58.1 runtime. |
| Windows MCP startup | MCP SDK stdio client through guarded bootstrap | Pass | `generator_setup_page` is present and initializes without duplicate-runtime or `EINVAL` failure. |
| Live adapter | MCP `generator_setup_page` then `browser_navigate` to `http://localhost:3012/ai` | Pass | Reached the Alleato login route with title `Alleato Project Management`. |
| Browser artifact | `C:\Users\KimiClaw\AppData\Local\Temp\playwright-mcp-output\1785415412912\eve-adapter-live.png` | Pass | Visible login-page evidence captured by the repaired adapter. |

## Remaining Risk

- The deliberately terminated pre-fix transport cannot reconnect inside this already-running Codex task. Fresh MCP connections use the repaired bootstrap, as proven through the SDK client.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
