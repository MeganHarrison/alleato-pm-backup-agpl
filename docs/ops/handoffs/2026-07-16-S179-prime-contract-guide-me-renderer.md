# Handoff: 2026-07-16 — Prime Contract Guide me renderer

## Intake Block

1) Session ID: S179
2) Task ID: AAI-1134
3) Linear issue: AAI-1134
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1134/render-guide-me-for-prime-contract-basics
5) Current status: In Progress, renderer implementation is complete but live Prime Contract activation remains blocked by AAI-1133 verified focus-timeline publication.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/docs/ops/tasks/2026-07-16-prime-contract-guide-me-renderer.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-16-S179-prime-contract-guide-me-renderer.md`; `/Users/meganharrison/Documents/github/project-management/docs/ops/orchestration/session-board.md`; `/Users/meganharrison/Documents/github/project-management/frontend/src/features/knowledge/training-doc-experience.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/features/knowledge/app-training-doc-page.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/app/(main)/knowledge/app/[toolCategory]/[docSlug]/page.tsx`; `/Users/meganharrison/Documents/github/project-management/frontend/src/features/knowledge/__tests__/training-doc-experience.test.tsx`.
7) Commands run and outcome (pass/fail counts): Focused Jest 9/9 pass; changed-file ESLint pass; `npm run typecheck:changed` pass; Alleato complexity audit pass; handoff check pass; authenticated canonical-route capture pass for the required unavailable/recovery state.
8) Evidence artifacts (screenshot/video/report/log paths): `/Users/meganharrison/.codex/visualizations/2026/07/16/019f6c78-47be-7ed0-8303-3a7bdab49101/prime-contract-guide-me-fallback-state.png`.
9) Top 3 findings (frontend-visible issues first): (1) the canonical route now exposes Article, Annotated, and Guide me views; (2) Guide me refuses missing/malformed focus metadata and returns the user to the article instead of inventing an annotation; (3) AAI-1133 must publish normalized focus geometry before the verified screenshot experiences can activate.
10) Recommended next action (one line): Publish the AAI-1133 focus timeline, then prove both modes with canonical-route screenshots and independent review.
11) Handoff file path: `docs/ops/handoffs/2026-07-16-S179-prime-contract-guide-me-renderer.md`
12) Migration ledger evidence: N/A, existing JSON metadata field only.

## Linear Updates

- Kickoff comment: https://linear.app/megankharrison/issue/AAI-1134/render-guide-me-for-prime-contract-basics
- Milestone comments: Renderer checkpoint pending publication after this handoff update.
- Completion/blocker comment: Pending.

## Current Status

The shared renderer is implemented. The canonical route accepts `mode=annotated` and `mode=walkthrough`; both modes use one strict normalized-focus parser and retain the ordinary article as an explicit recovery path. The Guide me panel is a localized 20px-radius, light-shadow module with keyboard Back/Next, coordinated CSS-only transition states, and reduced-motion classes.

## Exact Next Step

Publish the AAI-1133 verified timeline with `action_metadata.focus` for every screenshot step, then capture both live modes on the canonical route and submit for independent review.

## Known Pitfalls

- Do not use the prototype route as a production data source.
- Do not use CSS selectors at render time; only capture-derived focus geometry is trustworthy.
- Do not show a partially focused screenshot as though it were verified.
- The docs publisher currently drops `action_metadata`; preserve focus metadata if docs-site annotations are required as part of AAI-1133.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/github/project-management
npm run linear:codex:check -- docs/ops/handoffs/2026-07-16-S179-prime-contract-guide-me-renderer.md
```

## Evidence

Focused Jest, changed-file lint, type-debt check, complexity audit, and authenticated canonical-route fallback screenshot are recorded in the task file.
