# Feature Audit Report: Training Growth Assessment

| Field | Value |
|---|---|
| **Date** | 2026-07-28 |
| **Tool** | Training Growth Assessment |
| **URL** | `https://projects.alleatogroup.com/training/growth` |
| **Overall Verdict** | PARTIAL |
| **Delivery lane** | Standard (bounded client/runtime boundary) |

## Executive Summary

The live assessment's primary persistence boundary works: validation blocks an
incomplete plan, a completed assessment saves with HTTP 200, and reload restores
the score, target, cadence, and focus-plan values on desktop and mobile. The
audit fixed draft-loss, silent same-date replacement, indefinite save, stale
copy/tests, and write-only history detail. The assessment method itself still
needs a database-backed redesign before it can truthfully support universal core
skills and user-selected two-to-four focus skills.

## Scorecard

| Category | Result | Details |
|---|---:|---|
| Functional browser checks | 8/8 pass | Load, validation, save, response, reload, plan readback, mobile, no overflow |
| Focused automated tests | 27/27 pass | Six suites |
| Persistence readback | 5/5 pass | Scores, targets, plans, cadence, history aggregate |
| Negative paths | 3/3 pass | Incomplete plan, dirty role switch, same-date replacement |
| Accessibility | Needs work | Five assessment contrast nodes plus shared-shell landmark findings |
| Issues found | 0 critical / 4 high / 5 medium / 3 low | Includes content-contract and accessibility findings |
| Issues fixed | 9 | Client safety, reviewability, timeout/retry, navigation, copy, and regression coverage |

## Functional Results

| Flow | Result | Evidence |
|---|---|---|
| Authenticated production load | Pass | `../../docs/ops/evidence/training-growth/2026-07-28/01-production-start.png` |
| Required focus-plan validation | Pass | `../../docs/ops/evidence/training-growth/2026-07-28/02-required-plan-blocks-save.png` |
| Complete form before save | Pass | `../../docs/ops/evidence/training-growth/2026-07-28/03-complete-form-before-submit.png` |
| Production POST and success | Pass | HTTP 200; `../../docs/ops/evidence/training-growth/2026-07-28/04-save-success.png` |
| Reloaded desktop/mobile state | Pass | `../../docs/ops/evidence/training-growth/2026-07-28/05-mobile-reload.png`, `../../docs/ops/evidence/training-growth/2026-07-28/07-mobile-bottom.png` |
| Saved evidence and plans reviewable | Fixed | `../../docs/ops/evidence/training-growth/2026-07-28/09-local-history-detail-fixed.png` |
| Unsaved role-switch protection | Fixed | `../../docs/ops/evidence/training-growth/2026-07-28/10-local-unsaved-role-guard.png` |
| Same-date replacement disclosure | Fixed | `../../docs/ops/evidence/training-growth/2026-07-28/11-local-same-date-update-guard.png` |
| Mobile expanded history | Pass | `../../docs/ops/evidence/training-growth/2026-07-28/13-local-mobile-history-detail-390.png` |
| In-app navigation draft guard | Pass | `../../docs/ops/evidence/training-growth/2026-07-28/14-local-navigation-guard.png` |
| Production post-deploy history | Pass | `../../docs/ops/evidence/training-growth/2026-07-28/15-production-post-deploy-history.png` |
| Production post-deploy draft guard | Pass | `../../docs/ops/evidence/training-growth/2026-07-28/16-production-post-deploy-navigation-guard.png` |

The production save restored exact distinct values after reload and returned an
average of 59, a +9 delta, and eight changed skills for the Jul 28, 2026 Project
Engineer row. The fixed history view reads the already-returned private JSON; it
does not broaden server access or expose another user's data.

## Issues and Disposition

### TG-001 — Unsaved role changes discarded the current draft — HIGH — FIXED

Role changes replaced the local draft without warning. The shared confirmation
primitive now requires an explicit discard decision, and `beforeunload` covers
browser navigation.

### TG-002 — Same-date saves silently replaced the prior check-in — HIGH — FIXED

The server correctly performs an idempotent same-user/role/date upsert, but the
client did not disclose replacement. The action now reads “Update check-in” and
requires confirmation.

### TG-003 — Saved qualitative evidence was not reviewable — HIGH — FIXED

History rendered only aggregates even though the authorized response contained
the saved assessment. Recent check-ins now progressively disclose skill scores,
evidence, and focus-plan action/frequency/measure.

### TG-004 — Assessment contract does not match the stated method — HIGH — OPEN

Role assessments omit universal core skills, force the top four gap-ranked
skills, and do not allow a learner to choose two to four priorities. Fixing this
requires a validated database/trigger contract change. The required production
Supabase types gate is blocked by an invalid management credential, unavailable
local container runtime, and Management API HTTP 403.

### TG-005 — Focus-ranking copy claimed impact × gap — MEDIUM — FIXED

The implementation ranks only by target gap. The UI now says “ranked by gap.”

### TG-006 — Save could remain indefinitely pending — MEDIUM — FIXED

The client now uses the shared timed API helper and gives a specific retry
message after 20 seconds.

### TG-007 — History was capped but labeled as complete history — MEDIUM — FIXED

The heading now accurately says “Recent check-ins.”

### TG-008 — Assessment theme has contrast failures — MEDIUM — OPEN

The production accessibility scan found five assessment contrast nodes. The
canonical training theme stylesheet is under another active writer lease, so
this task preserved the evidence and avoided an overlapping edit.

### TG-009 — Shared shell exposes duplicate/nested main landmarks — MEDIUM — OPEN

This is outside the assessment component boundary and should be corrected by
the shared layout owner.

### TG-010 — Default 50/70 scores may anchor responses — LOW — OPEN

Consider an explicit unscored state or a short validated calibration exercise.

### TG-011 — Evidence remains free-form — LOW — OPEN

Consider structured prompts for situation, behavior, outcome, and source after
the database contract is available.

### TG-012 — Client component remains large — LOW — OPEN

`SkillGrowthClient.tsx` still coordinates assessment, planning, history, and
navigation safety. Split only when doing so preserves the current canonical
owner rather than creating parallel components.

### TG-013 — Timed-out retries could bypass replacement review — MEDIUM — FIXED

The client now remembers an uncertain role/date save. A retry is labeled
explicitly and requires confirmation because the first request may have
completed after the browser aborted.

### TG-014 — Client-side navigation could discard a draft — MEDIUM — FIXED

A shared unsaved-changes guard now covers ordinary anchor-based App Router
navigation in addition to full page exits. Confirmed navigation takes a single
full location transition so it cannot race the intercepted client transition.

## Noise Gate

**Verdict:** Needs revision.

- Primary job: honestly score role capability, select a focused development
  plan, and revisit evidence over time.
- Simplified in this change: removed the false impact claim, renamed capped
  history, and kept detailed saved content hidden until requested.
- Remaining noise/risk: long form density, instructional microcopy with weak
  contrast, and method claims that exceed the persisted contract.
- Regression guardrail: focused client tests cover discard/update decisions and
  history detail; the E2E now checks the POST response, reload, exact role, saved
  evidence, mobile cold load, page errors, and growth API failures.

## Evidence Index

| Artifact | Purpose |
|---|---|
| `../../docs/ops/evidence/training-growth/2026-07-28/01-production-start.png` | Production start state |
| `../../docs/ops/evidence/training-growth/2026-07-28/02-required-plan-blocks-save.png` | Negative validation path |
| `../../docs/ops/evidence/training-growth/2026-07-28/03-complete-form-before-submit.png` | Complete pre-submit state |
| `../../docs/ops/evidence/training-growth/2026-07-28/04-save-success.png` | Successful production save |
| `../../docs/ops/evidence/training-growth/2026-07-28/05-mobile-reload.png` | Mobile reload/readback |
| `../../docs/ops/evidence/training-growth/2026-07-28/07-mobile-bottom.png` | Mobile bottom controls/history |
| `../../docs/ops/evidence/training-growth/2026-07-28/09-local-history-detail-fixed.png` | Saved-detail review |
| `../../docs/ops/evidence/training-growth/2026-07-28/10-local-unsaved-role-guard.png` | Dirty-role confirmation |
| `../../docs/ops/evidence/training-growth/2026-07-28/11-local-same-date-update-guard.png` | Replacement confirmation |
| `../../docs/ops/evidence/training-growth/2026-07-28/13-local-mobile-history-detail-390.png` | Mobile detail/no overflow |
| `../../docs/ops/evidence/training-growth/2026-07-28/14-local-navigation-guard.png` | In-app navigation draft protection |
| `../../docs/ops/evidence/training-growth/2026-07-28/15-production-post-deploy-history.png` | Live saved-detail readback after deployment |
| `../../docs/ops/evidence/training-growth/2026-07-28/16-production-post-deploy-navigation-guard.png` | Live draft-navigation guard after deployment |

Release evidence: commit `61520a92da1b9d6d55f502ac2f88da3975da499c`
was served by Ready production deployment
`dpl_ujhfCX1T7YW9hXwqg8gz51FR6kiT` at
`https://projects.alleatogroup.com`.

## Recommended Next Work

1. Restore valid production Supabase schema-introspection access, regenerate
   types, and design a migration/trigger contract for universal core skills and
   learner-selected two-to-four priorities.
2. Have the active training-theme owner remediate the recorded contrast nodes,
   then rerun the production accessibility scan.
3. Correct duplicate/nested `main` landmarks in the shared shell.
