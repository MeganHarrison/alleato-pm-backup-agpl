# Task: Eve approval UI redesign

Status: Complete
Owner: Codex
Created: 2026-07-30
Task ID: AAI-1274-APPROVAL-UI-REDESIGN
Linear Issue: Existing parent AAI-1274
Related Handoff: N/A

## Objective

Make Eve write approvals easy to review, decline, and confirm without exposing raw implementation data as the primary interface.

## Scope

- Shared AI tool confirmation, input summary, output receipt, and RFI approval composition.
- Excludes changes to Eve approval transport, write authorization, database behavior, and non-Eve write tools.

## Source of Truth

- Canonical runtime/data owner: Eve tool lifecycle and `/api/ai-assistant/eve/tools`.
- Existing shared primitives/services: `frontend/src/components/ai-elements/confirmation.tsx`, `frontend/src/components/ai-elements/tool.tsx`, and `frontend/src/components/ai-assistant/chat-area.tsx`.
- Deprecated or parallel paths: N/A.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Pending approval presents the human decision fields before technical data.
- [x] Declining clearly confirms that no project data changed.
- [x] Successful approval presents a compact record summary, audit receipt state, and canonical record action.
- [x] The workflow is usable at 375, 414, 768, 1024, and 1440 pixel widths.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are unchanged.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: declined, execution error, or missing approval identifier is shown at the inline tool boundary.
- Detection path: visible Eve tool state plus focused component tests and authenticated browser proof.
- Recovery path: ask Eve to revise a declined proposal, retry a failed action, or open the created canonical record.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Shared component coverage and live responsive screenshots.
- Guardrail evidence: Four focused component tests, strict targeted ESLint, production Next.js build, authenticated Eve flows, and five responsive widths.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Component contract | `pnpm --dir frontend exec jest --runInBand --runTestsByPath src/components/ai-elements/__tests__/approval-workflow.test.tsx` | Pass | 4 of 4 approval summary, denial, success receipt, and transitional-state assertions pass. |
| Targeted lint | `pnpm --dir frontend exec eslint ... --no-cache` | Pass | Shared primitives, integration composition, and tests have zero errors or warnings. |
| Production build | Vercel production deployment for final `origin/main` | Pass | Next.js production build completed and the final deployment reached Ready. |
| Pending approval | `AAI-1274-approval-ui-pending-desktop.png` | Pass | Human-readable fields lead; raw request is behind Technical details. |
| Denied approval | `AAI-1274-approval-ui-denied-desktop.png` | Pass | Resolved state says the RFI was not created and no project data changed. |
| Successful approval | `AAI-1274-approval-ui-success-desktop.png` | Pass | Compact created-record receipt and canonical Open RFI action render. |
| Responsive widths | Agent-browser at 375, 414, 768, 1024, and 1440 pixels | Pass | `scrollWidth === clientWidth` at every required width. |
| QA cleanup | Authenticated DELETE then GET for QA RFI `0a59c810-9e9f-4bee-af47-0bc92ad75228` | Pass | DELETE returned 200 and readback returned 404; active project left clean. |

## Remaining Risk

- Generic tools without a registered field order use the safe shared fallback summary; add a registered order when a new write tool needs domain-specific labels.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
