# Task: Expand the Scheduling Release Suite

Status: In Progress
Owner: Codex
Created: 2026-07-28
Task ID: SCHED-RELEASE-SUITE

## Objective

Make the scheduling preflight run every scheduling-owned unit, component,
service, hook, and API route test by default, while retaining an explicit
fast-feedback option.

Delivery lane: Standard

## Acceptance

- [x] Release test discovery is deterministic and repository-grounded.
- [x] Core auto-scheduler, network analysis, atomic import, calendar, baseline/revision, Phase 4C, service, component, and route suites are included.
- [x] Unrelated product tests are excluded.
- [x] Root and frontend release commands are available.
- [x] Schedule preflight defaults to the release suite.
- [x] `--fast-tests` explicitly selects the prior focused suite.
- [x] Runner contract tests pass.
- [x] The full discovered scheduling release suite passes.
- [x] Independent code review passes.
- [ ] Task-owned files are published to `origin/main`.

## Validation notes

- Discovery currently selects 70 scheduling-owned files containing 379 tests.
- The first complete run exposed six stale suites; their repairs were published
  separately in `f6fa0dc44688dc0bbbd50e9d7a0d1dd55c27fccf`.
- After those repairs, 69/70 suites and 378/379 tests passed. The only failure
  was a component test exceeding Jest's five-second default under the combined
  release load (9.5 seconds); the same test had passed at 4.98 seconds in the
  preceding run.
- The release runner therefore uses a documented 15-second per-test ceiling
  while remaining serial and deterministic. Focused suites retain Jest's
  default timeout.
- Final release validation: 70/70 suites and 379/379 tests passed in 197.964
  seconds.
- Runner/preflight contract validation: 5/5 task-owned Node tests passed;
  the combined existing preflight contracts passed 8/8.
- Both package manifests parse as valid JSON, and `git diff --check` is clean.
- Windows preflight launches npm through the active npm CLI and Node executable,
  avoiding both the `.cmd` `ENOENT` failure and command-shell injection.
- Live Windows launcher probe executed the active npm CLI and returned version
  `10.8.2`.
- Independent code review: APPROVE, no remaining findings.
