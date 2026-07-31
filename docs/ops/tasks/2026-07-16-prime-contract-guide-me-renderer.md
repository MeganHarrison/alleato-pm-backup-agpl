# Task: Render Prime Contract Annotated and Guide Me Views

Status: In Progress
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1134
Linear Issue: [AAI-1134](https://linear.app/megankharrison/issue/AAI-1134/render-guide-me-for-prime-contract-basics)
Related Handoff: `docs/ops/handoffs/2026-07-16-S179-prime-contract-guide-me-renderer.md`

## Objective

Render the published Create a Prime Contract training timeline as annotated and Guide me views on the canonical in-app knowledge route, without creating a second documentation owner.

## Scope

- Add a shared client renderer to the existing in-app training-document page.
- Support `mode=annotated` and `mode=walkthrough` from the same canonical URL and published training-doc record.
- Keep the article view as the recoverable fallback when verified focus geometry is unavailable.
- Do not write or infer training data, change the Prime Contract form, or publish capture data. AAI-1133 owns the verified timeline publication.

## Source of Truth

- Canonical runtime/data owner: published `training_docs`, `training_doc_steps`, and `training_doc_assets` read by `getPublishedTrainingDocBySlug`.
- Existing shared primitives/services: `AppTrainingDocPage`, `Button`, signed training-doc assets, and `action_metadata`.
- Deprecated or parallel paths: `/knowledge/app/prototype/prime-contract` is a visual reference only and cannot become the production data owner.

Verification contract: Required

## Acceptance Criteria

- [ ] The canonical training-doc route renders annotated and Guide me modes from one published document record.
- [ ] Both modes pair each screenshot with persisted, normalized focus geometry, instruction, and expected result.
- [ ] Guide me provides keyboard-operable Back/Next controls, progress, coordinated transition behavior, and reduced-motion support.
- [ ] Missing or malformed focus metadata fails loudly with a specific article-recovery path.
- [ ] The guide panel is a localized 20px-radius, light-shadow surface, without a page-level wrapper or duplicate documentation owner.

## Implementation Checklist

- [x] Claim the Linear issue and orchestration scope before coding.
- [x] Add a shared focus-metadata parser and renderer instead of route-local screenshot logic.
- [x] Add query-mode routing to the canonical training-doc route.
- [x] Cover focus parsing, unavailable recovery, annotated selection, and Guide me progression with focused tests.

## Integration and Verification

- [x] Targeted tests and changed-file lint pass.
- [ ] Browser evidence proves both modes on the canonical route using verified published focus data.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing or malformed verified focus geometry for a published training-doc step.
- Detection path: shared metadata parser, focused tests, and canonical-route browser view.
- Recovery path: return to the article view and republish the verified capture timeline through AAI-1133.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: tutorial screenshots can be published without sufficient geometry to render a trustworthy in-app annotation.
- Detection gap: the legacy in-app reader renders screenshots but does not validate focus metadata.
- Prevention: reject Guide me and annotated activation without capture-derived normalized focus rectangles.
- Guardrail evidence: focused renderer tests and canonical-route browser proof.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Production owner, scope boundary, and verification gate recorded before implementation. |
| Focused renderer tests | `pnpm exec jest --runInBand --runTestsByPath src/features/knowledge/__tests__/training-doc-experience.test.tsx src/features/knowledge/__tests__/app-training-doc-page.test.tsx` | Pass | 9 tests cover normalized focus validation, annotated step selection, Guide me keyboard progression, and article recovery. |
| Changed-file lint | `pnpm exec eslint ...training-doc-experience.tsx ...app-training-doc-page.tsx ...[docSlug]/page.tsx` | Pass | No diagnostics. |
| Static focus/type debt | `npm run typecheck:changed` | Pass | No new explicit `any` debt; the repository has no file-scoped TypeScript compiler. |
| Alleato complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs ...` | Pass | Shared renderer and existing page remain within the product-surface budget. |
| Canonical route guardrail | `/Users/meganharrison/.codex/visualizations/2026/07/16/019f6c78-47be-7ed0-8303-3a7bdab49101/prime-contract-guide-me-fallback-state.png` | Pass | Authenticated route renders the mode switch and explicit article recovery because current published Prime Contract steps lack `action_metadata.focus`. |

## Remaining Risk

- AAI-1133 must publish verified focus geometry before the production modes can be visually proven with the Prime Contract data. Until then, the fallback must remain explicit and recoverable.
- Browser access was refreshed with the existing Playwright setup state. The original route load exceeded 25 seconds while the app shell was loading; after the load settled, authenticated canonical-route evidence passed. The remaining limitation is data-contract readiness, not authentication.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
