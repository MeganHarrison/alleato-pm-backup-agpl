# Exclude Intentional Pipeline Failures

Status: In Progress
Owner: Codex
Created: 2026-07-17
Task ID: Local blocker: Linear connector unavailable in this session
Linear Issue: Unavailable: no Linear connector/tool is exposed in the current session
Related Handoff: `docs/ops/handoffs/2026-07-17-S-current-exclude-intentional-pipeline-failures.md`

## Objective

Ensure the AI dashboard recovery list shows only actionable pipeline failures and excludes records whose lifecycle error marks them as intentionally excluded.

## Scope

- Canonical document lifecycle API and AI dashboard recovery list.
- Exclude intentional records based on the canonical status/error marker, not title matching in the UI.
- Compact recovery rows and bound visible error payloads to 160 characters.
- Do not alter ingestion history or retry behavior for genuinely failed records.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/documents/status/route.ts` and `frontend/src/app/(main)/ai-dashboard/rag-pipeline/rag-pipeline-preview.tsx`
- Existing shared primitives/services: document lifecycle normalization and existing dashboard query hook.
- Deprecated or parallel paths: None identified.

Verification contract: Required

## Acceptance Criteria

- [x] Intentional exclusions do not appear in the recovery list.
- [x] Genuine timeout failures remain visible with their actionable error text.
- [x] Intentional exclusion detection is covered by a regression test.
- [x] Screenshot evidence shows the canonical route and matches the changed revision.
- [x] Recovery rows are compact and error text is bounded to 160 characters.
- [ ] Failure-loudly behavior is defined for malformed or unknown lifecycle states.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared lifecycle classification owns the filtering behavior.
- [x] Errors remain specific and actionable.
- [x] No ingestion records are deleted or silently rewritten.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual authenticated runtime readback proves intentional records are absent and timeout records remain.
- [x] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: actionable failed lifecycle error text for non-intentional records.
- Detection path: API response plus recovery-list screenshot.
- Recovery path: retry or inspect the underlying pipeline stage; intentional exclusions require no retry.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: Recovery UI treated intentional exclusion lifecycle records as failed records.
- Detection gap: The UI filtered only by failed stage and did not apply the canonical intentional-skip marker.
- Prevention: Regression test and shared predicate for intentional lifecycle records.
- Guardrail evidence: Pending implementation and verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| Regression | `npm run test:unit -- --runInBand src/app/api/admin/source-sync/__tests__/intentional-skips.test.ts` | Pass | 8/8, including collection filtering that removes intentional exclusions but retains statement timeouts. |
| Static checks | `npx eslint src/app/api/documents/status/route.ts src/app/api/admin/source-sync/_lifecycle.ts src/app/api/admin/source-sync/__tests__/intentional-skips.test.ts` | Pass | No violations. |
| Runtime readback | Authenticated `GET /api/documents/status?type=meeting&source=fireflies&per_page=100` | Pass | 98 total rows, 0 `INTENTIONALLY_EXCLUDED:` rows, 11 statement-timeout rows, including the seven titles in the reported screenshot. |
| Desktop recovery | `docs/ops/evidence/2026-07-17-exclude-intentional-pipeline-failures-recovery-clean.png` | Pass | Canonical recovery list shows timeout failures and no intentional interview exclusion. |
| Tablet recovery | `docs/ops/evidence/2026-07-17-exclude-intentional-pipeline-failures-recovery-tablet.png` | Pass | Full recovery heading and timeout-only rows are visible without overflow. |
| Mobile recovery | `docs/ops/evidence/2026-07-17-exclude-intentional-pipeline-failures-recovery-mobile.png` | Pass | Recovery heading remains readable in the mobile layout. |
| Compact recovery regression | `npm run test:unit -- --runInBand --runTestsByPath src/app/(main)/ai-dashboard/__tests__/workspace-pages.test.tsx` | Pass | 8/8, including the 160-character recovery-error bound and ellipsis behavior. |
| Compact recovery visual | `docs/ops/evidence/2026-07-17-compact-pipeline-recovery-desktop.png` | Pass | Desktop recovery rows use smaller error text and tighter vertical spacing while preserving timeout cause, title, project, and time. |

## Remaining Risk

- Independent evidence review and publish/finish flow remain required before closeout. The compact list preserves full error detail only in the API/log source, by design.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
