# Webpack Build Stall Fail Loud

Date: 2026-07-12
Linear: Not created - Linear issue creation tool unavailable in this session
Status: Complete

## Objective

Prevent the webpack fallback build from hanging indefinitely without new output on Vercel by adding a silence watchdog that fails loudly with an explicit error.

## Scope

- `frontend/scripts/build/run-production-build.mjs`
- Narrow verification for the build runner
- No unrelated deployment or app-code changes

## Done Checklist

- [x] Create task markdown before code changes.
- [x] Confirm the current Vercel deployment reached the webpack fallback path and then went silent.
- [x] Add a silence watchdog for webpack builds.
- [x] Make webpack stalls fail with an explicit error message.
- [x] Run narrow verification for the touched script.
- [x] Fill evidence section.

## Verification Plan

- Attached Vercel log review
- `node --check frontend/scripts/build/run-production-build.mjs`
- Targeted readback of the watchdog logic

## Evidence

- Attached Vercel log showed Turbopack stalling, falling back to webpack, then webpack reaching:
  - `23:24:22.991 [build] Starting Webpack production build attempt 1`
  - `23:24:26.223    Creating an optimized production build ...`
  - `23:24:27.887 [@sentry/nextjs - Node.js] Info: Sending telemetry data ...`
- No subsequent log output was available after the Sentry line, indicating the webpack path was also effectively silent.
- Added `NEXT_WEBPACK_SILENCE_TIMEOUT_MS` support with a 12-minute default watchdog.
- Added shared engine-specific silence timeout handling in `run-production-build.mjs`.
- Webpack now throws an explicit stall error after the silence timeout instead of hanging indefinitely.
- `node --check frontend/scripts/build/run-production-build.mjs` passed.

## Blockers

- None confirmed yet.

## Failure-Loud Guardrail

This task fails if webpack can still sit silently for an extended period without producing output or surfacing an explicit stall error.
