# Handoff: 2026-07-22 - AAI-1191 Named Baselines and Date Variance

## Intake Block

1) Session ID: S216
2) Task ID: AAI-1191
3) Linear issue: https://linear.app/megankharrison/issue/AAI-1191/add-baselines-revisions-and-controlled-schedule-publishing
4) Current status: In Progress - final publication and browser evidence.
5) Ownership: revision-boundary hardening, named baseline metadata/RPC/API, date variance, canonical controls, Tracking Gantt overlay, focused tests, migration/readback, browser evidence, and closeout control plane.
6) Next action: publish the independently approved revision, verify the exact production deployment, and capture authenticated desktop/mobile evidence.

## Verification Contract

Verification contract: Required

- Focused unit, route, and component tests must pass.
- The forward migration must be applied to the linked Supabase project and present in the remote migration ledger.
- Remote readback must prove manager/admin guards, one active baseline, immutable snapshot triggers, and complete deadline/calendar/submittal capture owners.
- Authenticated canonical desktop and mobile schedule proof must show baseline capture/activation, visible variance, and Tracking Gantt overlay.
- Independent React/TypeScript, database, and final code review must approve the delivered revision before publication.

## Product Noise Gate

- Primary user/job/decision: project manager / freeze and compare the plan / identify material date movement.
- Tier 1: active baseline and variance.
- Tier 2: capture and activate.
- Tier 3: history and immutable metadata.
- Hidden by default: management/history details.
- Removed: cards, duplicate summaries, and a second scheduling surface.
- Primary action: capture or activate a named baseline.
- Failure loudly: never retain or render stale comparison state after a failed baseline request.

## Evidence

- Three migration versions are applied and match the remote ledger: `20260722045025`, `20260722051959`, and `20260722052640`.
- Live readback proves RLS, grants, immutable triggers, current-pointer integrity, composite ownership, one-active-baseline enforcement, coherent source locking, alert preservation, and snapshot provenance.
- Rollback probes prove direct historical mutation and direct authenticated current-pointer mutation are blocked.
- Generated database types match the linked schema.
- Fifteen focused Jest suites pass 36 tests; changed-file lint debt, touched-file TypeScript, build-route contracts, and whitespace checks pass.
- Independent code, database, and React re-reviews report no remaining actionable findings.
- Production desktop/mobile proof remains the final closeout action.
