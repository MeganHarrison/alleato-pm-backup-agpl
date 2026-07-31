# Task: Add Executive Dashboard Visualizations

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1140
Linear Issue: [AAI-1140](https://linear.app/megankharrison/issue/AAI-1140/add-lifecycle-activity-river-and-ai-opportunity-visualizations-to-the)
Related Handoff: `docs/ops/handoffs/2026-07-16-S181-executive-dashboard-visualizations.md`

## Objective

Make `/ai-dashboard` show Brandon the most important company intervention within 15 seconds through a source-backed Project Lifecycle Funnel, Activity River, and AI Opportunity Wheel.

## Scope

- Add one read-only dashboard adapter at `/api/ai-dashboard/visualizations` over canonical project, prospect, activity, and curated intelligence records, with its shared typed contract under `frontend/src/lib/ai-dashboard/**`.
- Add three coordinated interactive visualizations to the existing AI Dashboard Overview.
- Reuse the existing AI Dashboard shell, semantic tokens, React Query contract, Recharts, tooltip, select, and slideover primitives.
- Include project, time-range, metric, comparison, sorting, keyboard, tooltip, source, loading, empty, incomplete, and error behavior where the underlying source supports it.
- Preserve existing child-page navigation, Daily Brief, operating health, and executive attention paths.
- Exclude new database tables, migrations, normalized event writers, opportunity-value invention, and new AI generation.

## Source of Truth

- Lifecycle: `public.prospects` and `public.projects`; prospect status/probability/value and project stage/phase/budget/completion fields remain canonical.
- Activity: current project and source activity tables, aggregated by time bucket before returning to the browser; details remain source-linked records.
- Opportunities: curated `public.insight_cards` with target and evidence ownership. No clean Pipeline B opportunity-value contract exists, so unsupported dollar impact stays unavailable.
- Existing shared primitives: `frontend/src/app/(main)/ai-dashboard/live-data.ts`, `frontend/src/components/ui/charts.tsx`, `frontend/src/components/ui/unified-slideover.tsx`, design-system controls, and the AI Dashboard workspace shell.
- Deprecated or parallel paths: hard-coded sample arrays, synthetic historical comparisons, fabricated impact values, and a second normalized event store.

Verification contract: Required

## Acceptance Criteria

- [x] All three visualizations render from real canonical data or an explicit source-specific incomplete state.
- [x] Lifecycle metric, activity range/project, opportunity category, and drill-down interactions work with keyboard and pointer input.
- [x] Every stage, stream, insight, project, and source link opens the correct focused panel or canonical destination.
- [x] Confirmed, estimated, AI-inferred, and incomplete values are visibly distinguished.
- [x] Loading, empty, incomplete, permission, and error states name the source and recovery path.
- [x] Data refresh time is visible and no unsupported comparison or dollar value is shown.
- [x] Desktop, tablet, and mobile layouts avoid overlap and horizontal page overflow.
- [x] Dark and light themes retain legibility and semantic state meaning.
- [x] The previous generic portfolio charts are removed so the dashboard does not become an additive chart wall.

## Implementation Checklist

- [x] AAI-1140 and S181 define scope before product edits.
- [x] Shared server adapter owns aggregation and source-integrity labels.
- [x] Shared dashboard visualization shell owns consistent headings, source state, tooltips, and drill-down treatment.
- [x] Recharts renders only aggregated series; detail rows load or reveal only after interaction.
- [x] Focused tests reject fabricated values and cover interactions plus failure states.
- [x] Database, provider, authentication, permission, and delivery ownership remain unchanged.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Authenticated API readback proves current source values.
- [x] Authenticated desktop, tablet, and mobile browser flows pass.
- [x] Dark and light mode screenshots are captured and visually reviewed.
- [x] Independent functional and visual review approves the result.
- [x] Impeccable surface and noise-gate checks pass.
- [x] Verification contract passes with `--require-pass`.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the unavailable canonical source, omitted metric, and affected visualization.
- Detection path: source query errors, focused contract tests, authenticated browser readback, and exact-route screenshots.
- Recovery path: retry the source, open the canonical data-quality route, or review incomplete records without drawing a misleading visual.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the existing Overview uses generic charts because no dashboard-specific source adapter yet unifies lifecycle, activity, and curated intelligence records.
- Detection gap: visual tests did not require source labels, interactive drill-down, or a visible incomplete-data contract for executive charts.
- Prevention: one typed server adapter plus regression tests that reject unsupported values and require source/recovery states.
- Guardrail evidence: focused contract tests, source-named API failure recovery, exact-route responsive screenshots, independent review, and verification contract PASS.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1140 and S181 | Pass | Scope, owners, exclusions, and done gate captured before implementation. |
| Source inventory | Generated database types and canonical readers | Pass | Lifecycle and activity records exist; Pipeline B has no clean opportunity-value equivalent. |
| Focused tests | Dashboard, visualization, and theme Jest suites | Pass | 3 suites and 9 tests passed. |
| Targeted lint | Task-owned frontend files | Pass | No warnings or errors. |
| API readback | `/api/ai-dashboard/visualizations?range=7d` | Pass | 113 lifecycle records, 4,213 returned activity events, 4,770 source records, 546 AI inferences, and no invented opportunity value. |
| Project scoping | `projectId=1102` | Pass | One preconstruction lifecycle record; zero unrelated stages, activity events, and opportunities. |
| Responsive visual proof | `docs/ops/evidence/2026-07-16-executive-dashboard-visualizations/screenshots/` | Pass | Desktop dark/light, tablet, exact 375x812 mobile, and failure recovery reviewed. |
| Independent review | `independent-review.md` | Pass | Bohr approved; no task blocker remains. |
| Noise gate | `visual-review.md` | Pass | Generic charts and duplicate attention section removed; no nested cards, KPI row, or fabricated values. |
| Verification contract | `verification-result.json` | Pass | Required claims and artifact integrity passed with `--require-pass`. |
| Linear proof | AAI-1140 attachments and milestone comment `d66f0830-07d6-4a89-95b4-38697932d4e5` | Pass | Viewable desktop and mobile screenshots are attached to the tracked issue. |

## Remaining Risk

- Historical stage transitions and realized opportunity impact are not canonical today. The initial UI must label those fields unavailable rather than synthesize comparisons.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
