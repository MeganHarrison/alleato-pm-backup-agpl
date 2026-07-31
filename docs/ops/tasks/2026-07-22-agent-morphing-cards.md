# Task: Present Agent Team as Morphing Cards

Status: Complete
Owner: SROOT-AGENT-MORPHING-CARDS-0722
Created: 2026-07-22
Task ID: AGENT-MORPHING-CARDS-0722
Linear Issue: N/A (user-directed dashboard refinement)
Related Handoff: N/A (single-session scoped change)

## Objective

Replace the static Agent Team rows on `/ai-dashboard` with compact cards that morph into a focused detail view.

## Scope

- Agent Team presentation in `ai-os-preview.tsx`.
- Shared morphing-dialog accessible-label forwarding.
- No changes to agent runtime data, health calculation, or API contracts.

## Source of Truth

- Canonical dashboard owner: `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx`.
- Shared motion primitive: `frontend/src/components/motion/morphing-dialog.tsx`.
- Existing static agent data: `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-data.ts`.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Each agent displays as a responsive status card.
- [x] Selecting an agent morphs the card into its detail view.
- [x] Cards retain health, tasks, latency, and last-run information; details also show token volume.
- [x] The morphing trigger has a readable accessible name and Escape closes the detail view.

## Integration and Verification

- [x] Focused ESLint passes for dashboard and shared motion files.
- [x] The shared morphing-dialog regression test passes.
- [x] Alleato surface-complexity audit passes.
- [x] Authenticated browser flow proves all 12 cards render, the Chief of Staff card opens, and Escape closes its dialog.

## Failure-Loudly Contract

- Cause surfaced as: N/A, presentational change using existing static agent data.
- Detection path: focused component test plus browser accessibility and dialog-state readback.
- Recovery path: the card retains the source agent metrics; reopen the card if its detail view is dismissed.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the dashboard used a flat table-like list for agents despite the intended card-detail interaction.
- Detection gap: no browser interaction check asserted a readable morphing-card trigger name.
- Prevention: `MorphingDialogTrigger` now honors caller-provided `aria-label` values.
- Guardrail evidence: `morphing-dialog-trigger.unit.test.tsx` and authenticated browser readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused lint | `pnpm --dir frontend exec eslint ...` | Pass | Dashboard and shared motion files clean. |
| Shared primitive test | `pnpm --dir frontend exec jest src/components/motion/__tests__/morphing-dialog-trigger.unit.test.tsx --runInBand` | Pass | 3 tests passed. |
| Alleato audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs ...` | Pass | No complexity-budget violation. |
| Browser grid | `/tmp/agent-morphing-cards-grid-final.png` | Pass | 12 readable agent-card triggers and no horizontal overflow. |
| Browser interaction | `/tmp/agent-morphing-card-detail.png` | Pass | Chief of Staff card opens; Escape closes the dialog. |

## Remaining Risk

- Production deployment follows the Vercel queue; no data-source behavior changed.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No work is deferred.
