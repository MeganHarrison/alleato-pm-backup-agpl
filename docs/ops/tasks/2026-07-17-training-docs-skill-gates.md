# Task: Enforce repeatable training documentation gates

Status: Complete
Owner: Codex
Created: 2026-07-17
Task ID: DOCS-SKILL-TRAINING-GATES
Linear Issue: Unavailable: no Linear connector is configured in this session.
Related Handoff: N/A

## Objective

Make `$repeatable-training-docs` enforce one complete, failure-loudly path from capture through in-app publishing and docs-site deployment verification.

## Scope

- Own the repeatable-training-docs instructions and reusable tutorial validation commands.
- Reuse the existing capture, compose, publish, audit, and docs-site promotion seams.
- Exclude changes to individual product workflows except where the shared contract requires them.

## Source of Truth

- Canonical workflow: `.codex/skills/repeatable-training-docs/SKILL.md`
- Capture runtime: `scripts/tutorials/run-tutorial.ts` and `scripts/tutorials/tutorial-recorder.ts`
- Audit/writeback owner: `scripts/tutorials/audit-training-doc.ts` and `training_docs`
- Docs-site publisher: `scripts/tutorials/promote-to-alleato-docs-site.mjs`

Verification contract: Required

## Acceptance Criteria

- [x] The skill requires preflight authentication, route, form, and seed-data checks.
- [x] Capture success requires the complete artifact contract, valid source routes, and a playable video duration.
- [x] The skill requires value/summary assertions for stateful forms before final screenshots.
- [x] The skill mandates docs-safe screenshots for public docs promotion.
- [x] The skill requires in-app publish read-back, docs navigation generation, deployment, and exact live-route verification.
- [x] Executable validation fails with actionable errors when any artifact gate is unmet.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared validation owns cross-cutting artifact checks.
- [x] Errors are specific and actionable.
- [x] Docs-site delivery contract is handled.

## Integration and Verification

- [x] Targeted unit checks pass.
- [x] A real Owner Invoice packet passes the new validator.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing/invalid artifact, invalid captured route, failed video probe, failed publish read-back, or missing live route.
- Detection path: shared packet validator plus deployment and browser checks.
- Recovery path: fix the stated capture, workflow assertion, publishing, or docs-navigation boundary and rerun from that stage.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: The former skill relied on narrative checks and did not require a finalized video or end-to-end delivery proof.
- Prevention: A shared validator and explicit skill stop gates.
- Guardrail evidence: Pending implementation.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Unit checks | `node --test scripts/tutorials/__tests__/validate-training-packet.test.mjs` | Pass | Valid complete packet, blocked route, and unfinalized-video paths covered. |
| Real packet | `npm run tutorial:validate-packet -- docs/tutorials/invoicing/create-an-owner-invoice/manifest.json --require-docs-screenshots` | Pass | Six screenshots, valid routes, all support artifacts, and a 12.72-second video. |
| Publish | `git push origin HEAD:main`; `HEAD == origin/main` | Pass | Published at `f4f5ff3ec`. |
| Known unrelated check | Fresh isolated worktree test command | Not run there | The isolated worktree has no `node_modules`; the targeted validator suite passed in the active checkout. |

## Remaining Risk

- None.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
