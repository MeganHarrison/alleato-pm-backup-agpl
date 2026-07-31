# Task: Remove Cumulative Knowledge Growth Chart

Status: Complete
Owner: SROOT-REMOVE-KNOWLEDGE-GRAPH-0722
Created: 2026-07-22
Task ID: REMOVE-KNOWLEDGE-GRAPH-0722
Linear Issue: N/A (user-directed Fast cleanup)
Related Handoff: N/A (single-session scoped change)

## Objective

Remove the illustrative cumulative knowledge-growth graph from the AI dashboard.

## Scope

- The AI OS knowledge-telemetry section and its unused chart/data code.
- No changes to ingestion, RAG pipeline, or live source-backed dashboard data.

## Source of Truth

- Canonical UI owner: `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx`.
- Existing chart owner: `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-charts.tsx`.
- Deprecated path: the illustrative cumulative growth series in `ai-os-data.ts`.

Delivery lane: Fast

Verification contract: Optional

## Acceptance Criteria

- [x] The cumulative knowledge-growth graph is absent from `/ai-dashboard`.
- [x] The daily ingestion chart remains visible.
- [x] The removal does not introduce horizontal overflow.

## Integration and Verification

- [x] Focused ESLint passes for the changed UI/data files.
- [x] Alleato surface-complexity audit passes.
- [x] Authenticated local browser readback confirms the removed chart is absent and the ingestion chart remains.
- [x] Task-owned files are ready for `codex:finish` publication.

## Failure-Loudly Contract

- Cause surfaced as: N/A, removal-only change.
- Detection path: browser DOM check for the removed chart aria label.
- Recovery path: restore the prior chart only through a new, user-approved request.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the cumulative illustrative trend did not earn its space beside the more actionable source-backed pipeline chart.
- Detection gap: visual dashboard review had not applied the reduction pass to secondary telemetry.
- Prevention: use the Alleato noise-gate reduction pass for dashboard additions and review secondary charts as removal candidates.
- Guardrail evidence: focused browser readback and surface-complexity audit.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused lint | `pnpm --dir frontend exec eslint ...` | Pass | Changed dashboard files clean. |
| Alleato audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs ...` | Pass | No complexity-budget violation. |
| Browser readback | `/tmp/remove-knowledge-growth-dashboard.png` | Pass | Removed chart absent, ingestion chart present, no horizontal overflow. |

## Remaining Risk

- None. The removed graph was illustrative only; production deployment follows the normal Vercel queue.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No work is deferred.
