# Task: Remove Redundant AI Dashboard Status Copy

Status: Complete
Owner: Codex
Created: 2026-07-17
Task ID: AAI-1142
Linear Issue: [AAI-1142](https://linear.app/megankharrison/issue/AAI-1142/remove-redundant-ai-dashboard-status-copy)
Related Handoff: `docs/ops/handoffs/2026-07-17-S183-ai-dashboard-noise-reduction.md`

## Objective

Remove two low-value metadata strings from the AI Dashboard overview without removing the source recovery path or record context Brandon needs.

## Scope

- Remove the Overview intro's generated-brief status label.
- Remove the Project Lifecycle source diagnostic sentence while preserving `Review source` and record totals.
- Keep child-page status labels and other visualization source details unchanged.
- Exclude data, API, database, authentication, provider, theme, and delivery behavior changes.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/(main)/ai-dashboard/**`
- Shared intro owner: `frontend/src/app/(main)/ai-dashboard/workspace-primitives.tsx`
- Visualization source-state owner: `frontend/src/app/(main)/ai-dashboard/visualizations/executive-dashboard-visualizations.tsx`
- Deprecated or parallel paths: N/A

Verification contract: Required

## Acceptance Criteria

- [x] `/ai-dashboard` no longer renders `Brief generated ...` or a replacement intro status label.
- [x] Project Lifecycle no longer renders the prospect/lifecycle diagnostic sentence.
- [x] Project Lifecycle retains its `/projects` recovery link and record totals.
- [x] Child pages retain their shared intro status labels.
- [x] Desktop and 375px mobile quality is independently approved with no document overflow.

## Implementation Checklist

- [x] Files/modules to change are listed before closeout.
- [x] The shared intro primitive owns optional status rendering.
- [x] The shared source-line primitive owns compact detail visibility.
- [x] Focused tests prevent the removed copy from returning and preserve recovery.
- [x] Database, provider, authentication, permission, and delivery contracts remain unchanged.

## Integration and Verification

- [x] Focused Jest, targeted ESLint, changed-file quality, and surface-complexity checks pass.
- [x] Authenticated browser readback proves both strings are absent and recovery remains.
- [x] Desktop and 375px mobile screenshots exist and are attached to AAI-1142.
- [x] Independent functional and visual review approves the result.
- [x] Verification contract passes with `--require-pass`.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: focused assertions fail when removed metadata returns or the recovery link disappears.
- Detection path: focused Jest, authenticated DOM text/link readback, overflow checks, screenshots, and independent review.
- Recovery path: restore the compact source recovery contract or optional intro status boundary, then recapture the exact route.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: source freshness and incompleteness metadata was presented at the same time as decision content even though the actionable recovery path and record totals were sufficient.
- Detection gap: existing tests covered data integrity and recovery failures but did not prohibit these two low-value strings on the primary executive surface.
- Prevention: focused negative assertions now cover the intro and lifecycle copy while a positive assertion preserves `/projects` recovery.
- Guardrail evidence: focused tests, noise audit, authenticated desktop/mobile proof, Linear screenshot attachments, independent review, and verification contract PASS.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused tests | Two AI Dashboard Jest suites | Pass | 2 suites / 7 tests passed. |
| Static quality | Targeted ESLint and `frontend` `quality:changed` | Pass | No new debt or unsafe patterns. |
| Design audit | Alleato surface-complexity audit | Pass | Three changed UI files passed. |
| Browser proof | `docs/ops/evidence/2026-07-17-ai-dashboard-noise-reduction/verification.md` | Pass | Both strings absent; recovery and totals retained; zero document overflow. |
| Visual evidence | `docs/ops/evidence/2026-07-17-ai-dashboard-noise-reduction/screenshots/` | Pass | Authenticated desktop and 375px captures. |
| Independent review | `docs/ops/evidence/2026-07-17-ai-dashboard-noise-reduction/independent-review.md` | Pass | Lovelace approved with no blocker. |
| Linear proof | AAI-1142 attachments | Pass | Desktop and mobile screenshots are viewable on the issue. |

## Remaining Risk

- Live dashboard values and timestamps are time-sensitive. The tested presentation contract does not depend on their exact values.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
