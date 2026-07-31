# Task: Rename production Eve Assistant

Status: Complete
Owner: Codex S019f965e
Created: 2026-07-27
Task ID: RENAME-PRODUCTION-EVE-ASSISTANT
Linear Issue: N/A — local maintenance task
Related Handoff: isolated-session manifest

## Objective

Rename the production Eve runtime from `alleato-analyst` to
`alleato-assistant` without changing its routes, authentication, skills, tools,
or user-facing Assistant behavior.

## Scope

- Rename the Eve package directory, package identity, model environment names,
  frontend `withEve` mount, and current architecture references.
- Preserve the existing Eve runtime behavior and `/eve/v1/*` transport.

## Source of Truth

- Canonical runtime/data owner: `agents/alleato-assistant/`
- Existing shared primitives/services: `frontend/next.config.ts`,
  `agents/alleato-assistant/agent/**`
- Deprecated or parallel paths: `agents/alleato-analyst/` (renamed; no runtime
  fallback remains)

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Eve resolves `alleato-assistant` as its app root with no diagnostics.
- [x] The frontend mounts Eve from `agents/alleato-assistant`.
- [x] No live source reference remains to the previous runtime name.
- [x] The renamed package typechecks and builds.

## Failure-Loudly Contract

- Cause surfaced as: Eve discovery or Next configuration error naming the bad
  runtime path.
- Detection path: `eve info`, package typecheck/build, and route checks.
- Recovery path: restore the single prior directory/mount mapping from Git.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: The runtime name, package name, frontend mount, lockfile importer,
  and architecture map are now updated together.
- Guardrail evidence: `agents/alleato-assistant/package.json`,
  `frontend/next.config.ts`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Eve discovery | `pnpm --dir agents/alleato-assistant info` | Pass | 0 diagnostics; 7 skills discovered. |
| Eve typecheck | `pnpm --dir agents/alleato-assistant typecheck` | Pass | Exit 0. |
| Eve build | `pnpm --dir agents/alleato-assistant build` | Pass | Nitro output built. |
| Frontend changed-file lint | `pnpm --dir frontend exec eslint …` | Pass | Changed configuration/references clean. |
| Route guards | normalized `check-route-conflicts.sh`; `check-nonprod-routes.mjs` | Pass | No dynamic conflicts; manifest valid. |
| Frontend full build | `pnpm --dir frontend exec next build` | Blocked, unrelated | Next exhausted the existing 7 GB heap during compilation after config loaded; no Eve discovery/path error occurred. |

## Remaining Risk

- The full frontend build still exceeds the configured 7 GB heap. Owner:
  frontend build-capacity work. This rename is covered by the targeted Eve and
  route checks above; rerun the full build after the existing memory issue is
  addressed.

## Final Status

- [x] All Standard-lane acceptance criteria are complete.
- [x] Evidence is recorded.
- [x] Incident learning is N/A.
