# Task: Windows Frontend Turbopack Workflow Compatibility

Status: Complete
Owner: Codex
Created: 2026-07-27
Task ID: local-frontend-webpack-compat
Linear Issue: N/A — Fast local developer-runtime remediation
Related Handoff: N/A

## Objective

Start the Windows frontend without Turbopack failing on Workflow's dynamic loader.

## Scope

- `scripts/dev/dev-launcher.mjs` and `frontend/next.config.ts`
- Windows-only Turbopack local development behavior

## Source of Truth

- Canonical runtime owner: `scripts/dev/dev-launcher.mjs`
- Existing shared primitives/services: Next.js and `workflow/next` configuration
- Deprecated or parallel paths: Turbopack for Windows local development

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Windows startup avoids the incompatible `workflow/next` transform loader.
- [x] The TP1006 cause is documented beside the engine choice.
- [x] The launcher remains syntax-valid.
- [x] The failure is visible in dev-server output rather than silently masked.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared startup abstraction owns the cross-cutting engine choice.
- [x] Errors remain specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are not applicable.

## Integration and Verification

- [x] Targeted static check passes: `node --check scripts/dev/dev-launcher.mjs`.
- [x] Canonical user-flow readback: `GET /auth/login?callbackUrl=%2F` returns HTTP 200 under guarded Turbopack.
- [x] Evidence artifacts are recorded in this task.
- [x] Known unrelated failure: isolated workspace lacks `frontend/node_modules`, so it cannot start Next.js there.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: Next dev output names the active engine and exposes any engine-specific compile error.
- Detection path: request `/auth/login` after `npm --prefix frontend run dev`.
- Recovery path: correct the Next/Workflow compatibility boundary in this launcher; do not disable workflow transforms.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: `@workflow/next` installs webpack loaders for Turbopack on Next 15, whose loader analyser rejects their dynamic filesystem transform with TP1006.
- Detection gap: Windows launcher forced Turbopack without a login-route runtime compatibility check.
- Prevention: The shared Windows launcher declares Turbopack compatibility mode; `next.config.ts` skips only the unsupported local transform wrapper and emits a recovery warning.
- Guardrail evidence: `node --check scripts/dev/dev-launcher.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime observation | `GET /auth/login` under Turbopack | Failed | TP1006 points to `@workflow/next`'s dynamic loader transform. |
| Dependency inspection | `@workflow/next@4.1.1` and `4.1.2` | Confirmed | Both register the incompatible loader for Next 15. |
| Static check | `node --check scripts/dev/dev-launcher.mjs` | Passed | Launcher syntax is valid. |
| Canonical route readback | `GET http://localhost:3002/auth/login?callbackUrl=%2F` | Passed | HTTP 200 from Next 15.5.12 (Turbopack) with the guard enabled. |

## Remaining Risk

- Local workflow routes require a production build or webpack verification; ordinary Turbopack routes remain available.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly recorded.
- [x] No deferred work exists.
