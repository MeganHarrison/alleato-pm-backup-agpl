# Vercel Build Stall Fallback

Date: 2026-07-12
Linear: Not created - Linear issue creation tool unavailable in this session
Status: Complete

## Objective

Prevent silent Vercel production build stalls at `Creating an optimized production build ...` by making the Turbopack build path fail loudly and fall back to webpack when it stops emitting output for too long.

## Scope

- `frontend/scripts/build/run-production-build.mjs`
- Targeted verification for build-runner syntax/logic
- No unrelated build-pipeline redesign

## Done Checklist

- [x] Create task markdown before code changes.
- [x] Confirm the current Vercel log stall happens inside the Turbopack production build step.
- [x] Add a watchdog/guardrail so silent Turbopack stalls fail loudly.
- [x] Fall back to webpack after the stall guardrail trips.
- [x] Run narrow verification for the touched build script.
- [x] Fill evidence section.

## Verification Plan

- Attached Vercel build log review
- `node --check frontend/scripts/build/run-production-build.mjs`
- Targeted readback of the updated fallback logic

## Evidence

- Attached Vercel build log stopped at `22:26:24.977    Creating an optimized production build ...` for roughly 40 minutes with no further output.
- `frontend/scripts/build/run-production-build.mjs` already defaulted production builds to Turbopack via `NEXT_PRODUCTION_BUILD_ENGINE ?? "turbopack"`.
- Added `NEXT_TURBOPACK_SILENCE_TIMEOUT_MS` support with an 8-minute default watchdog.
- Added Turbopack child-process output silence detection and explicit fallback to webpack after a silent stall.
- `node --check frontend/scripts/build/run-production-build.mjs` passed.

## Blockers

- None confirmed yet.

## Failure-Loud Guardrail

This task fails if a Turbopack production build can still sit silently for an extended period without either producing more output, exiting with an explicit error, or falling back to webpack.
