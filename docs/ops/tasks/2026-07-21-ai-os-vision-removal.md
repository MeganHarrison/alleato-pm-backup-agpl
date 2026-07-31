# Task: Remove AI OS vision timeline

Status: Completed
Owner: Codex
Created: 2026-07-21
Task ID: local-ai-os-vision-removal
Linear Issue: Not required, micro-change fast path
Related Handoff: N/A, micro-change fast path

## Objective

Remove the duplicate "The path ahead" timeline from the canonical AI Operating System route so the actionable roadmap remains the final planning surface.

## Scope

- `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx`
- The corresponding AI OS data and styling no longer used after deletion.
- Excludes changes to the retained roadmap, navigation, data source, and deployment configuration.

## Source of Truth

- Canonical runtime owner: `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx`
- Existing shared primitives/services: `PageShell`, `AiDashboardWorkspaceShell`, `SectionTitle`
- Deprecated or parallel paths: N/A

Verification contract: Required

## Acceptance Criteria

- [x] The duplicate vision timeline is absent from the rendered AI OS page.
- [x] The retained roadmap remains the final planning surface.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before closeout.
- [x] Legacy timeline data and styling are removed.

## Implementation Checklist

- [x] Files/modules to change are listed.
- [x] The canonical page owner is changed directly.
- [x] No new error path is introduced.
- [x] Database, provider, authentication, permission, and delivery contracts are not applicable.

## Integration and Verification

- [x] Targeted ESLint check passes.
- [x] Actual authenticated user-flow screenshot proves the timeline is absent.
- [x] Evidence artifact is attached to the active Codex task comment.
- [x] Known unrelated failures are documented: the local Playwright browser bridge cannot initialize because `frontend/tests/e2e/seed.spec.ts` is loaded outside a test suite.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: N/A, this is a removal-only visual change with no new runtime failure path.
- Detection path: targeted source search confirms the timeline component, data, and styles have no remaining references.
- Recovery path: restore the removed timeline only through the canonical AI OS page owner if future product scope requires it.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: A static vision timeline duplicated the actionable roadmap on the same page.
- Detection gap: The original design lacked an attention-hierarchy review of the lower planning surfaces.
- Prevention: The AI OS noise gate now treats duplicate future-planning sections as removal candidates.
- Guardrail evidence: targeted source search and browser screenshot at closeout.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static references | `rg -n 'VISION_STEPS|VisionStep|styles.(vision|visionTrack|vstep|vline|vdot)' frontend/src/app/(main)/ai-dashboard` | Pass | No remaining page references. |
| Focused lint | `cd frontend && npx eslint src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx src/app/(main)/ai-dashboard/ai-os/ai-os-data.ts` | Pass | No lint output. |
| Browser evidence | `docs/ops/evidence/2026-07-21-ai-os-vision-removal/ai-os-without-vision-timeline.png` | Pass | Authenticated local capture of `/ai-dashboard/ai-os` after removal. |
| Publish | `npm run codex:finish -- --message "Remove AI OS vision timeline" --files …` | Pass | Published to `origin/main` at `186e4d317`; local HEAD matched remote at closeout. |

## Remaining Risk

- No remaining risk within this removal scope. The separate Playwright bridge seed-test setup issue is documented above and did not prevent authenticated browser verification with `agent-browser`.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A or linked.
- [x] No work is deferred.
