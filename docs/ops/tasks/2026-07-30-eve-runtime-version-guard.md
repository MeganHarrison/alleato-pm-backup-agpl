# Task: Guard Eve Runtime Version Alignment

Status: In Progress
Owner: Codex
Created: 2026-07-30
Task ID: AAI-1274-GUARD
Linear Issue: AAI-1274
Related Handoff: N/A

## Objective

Fail the focused AI Assistant test suite when the frontend, canonical Eve
agent, `@ai-sdk/react`, or the npm dependency graph resolve different Eve or AI
SDK versions.

## Scope

- One focused Jest guard under the existing AI Assistant test owner.
- No runtime behavior, UI, schema, or provider changes.

## Source of Truth

- Canonical runtime/data owner: `agents/alleato-assistant/package.json`
- Frontend dependency owner: `frontend/package.json`
- Resolved npm and production pnpm graphs: `frontend/package-lock.json` and
  `frontend/pnpm-lock.yaml`

Delivery lane: High-risk

Verification contract: The test must fail against the pre-fix dependency graph,
pass after the AAI-1274 version alignment is published, and remain part of the
ordinary Jest discovery path.

## Acceptance Criteria

- [x] Frontend and agent Eve versions must be exact and equal.
- [x] Frontend and agent AI SDK versions must be exact and equal.
- [x] `@ai-sdk/react` must depend on that same AI SDK version.
- [x] The npm graph must contain only the root AI SDK installation.
- [ ] Focused test passes against the published dependency fix.
- [x] Task-owned guard files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a focused Jest assertion naming the mismatched manifest,
  transitive dependency, or nested AI SDK install.
- Detection path: normal AI Assistant Jest discovery and the focused command
  run from `frontend/` in Evidence.
- Recovery path: align exact dependency pins, regenerate both lockfiles, and
  rerun the guard before browser release verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Pre-fix regression proof | Focused Jest guard against the prior main graph | Failed as expected | Detected frontend Eve `0.22.6` versus agent `0.27.13` and the split AI SDK graph. |
| Guard publication | Official `origin/main` commit `2c4dc4f9f1ea8b1494fe00c89a5c6bf5b7d7f0e0` | Pass | Published the focused guard and this task record as exact files. |
| Fresh official-main proof | From `frontend/` in `C:\Users\KimiClaw\AppData\Local\Temp\eve-guard-main-20260730194041`: `jest --runInBand --runTestsByPath src/components/ai-assistant/__tests__/eve-runtime-version-alignment.test.ts` | Blocked / failed loudly | Official `origin/main` does not contain `agents/alleato-assistant/package.json`, the declared canonical runtime owner. The test stops with `ENOENT` instead of masking the missing runtime. |

## Current Blocker

The official repository currently contains the frontend dependency pins and
the guard, but not the canonical `agents/alleato-assistant` runtime tree that
exists in the local Eve workspace. The guard cannot pass until that runtime is
published to the same repository or repository ownership is corrected.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] No deferred implementation is hidden.
