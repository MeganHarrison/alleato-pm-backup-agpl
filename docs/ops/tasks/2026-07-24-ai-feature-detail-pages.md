# Task: AI Feature Catalog And Detail Pages

Status: Complete
Owner: Codex S019f94fa2
Created: 2026-07-24
Task ID: ai-feature-detail-correction
Linear Issue: Not created; this is a single-session correction with no external coordination requirement.
Related Handoff: N/A

## Objective

Make `/ai/features` the AI capability catalog and make every catalog item open a dedicated `/ai/features/[featureSlug]` explainer page using the supplied Dayos reference as the approved layout direction.

## Scope

- Own the AI feature catalog data, table destinations, and shared feature-detail page.
- Back the seven public feature URLs with static route modules so the catalog does not increase the provider's dynamic-route count.
- Restore `/ai` to its original conversational welcome state while retaining the already-published MKH shell and widget branding.
- Add focused route/data tests plus desktop and mobile browser evidence.
- Exclude AI runtime, retrieval, provider, database, Vercel, and domain changes.

## Source of Truth

- Canonical runtime/data owner: Existing `/ai` assistant and the feature routes under `frontend/src/app/(main)/ai/`.
- Existing shared primitives/services: `UnifiedTablePage`, `PageShell`, `Button`, and the existing AI workflow routes.
- Deprecated or parallel paths: The Dayos-derived hero and WIP prompt starters on `/ai` are the incorrect presentation owner and are removed.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] `/ai/features` remains the canonical searchable catalog.
- [x] Every catalog row and feature-name link opens `/ai/features/[featureSlug]`.
- [x] Every detail route uses one shared detail component and one typed catalog.
- [x] Every detail URL has a static route module and the removed dynamic route no longer consumes provider route budget.
- [x] The supplied cost allocation and WIP use case appears in the catalog and has a complete detail page.
- [x] Detail pages include overview, humans-in-the-loop, deployment, sample-process, Challenge, Solution, and Result content.
- [x] Every detail page exposes one workflow launch action plus a return-to-catalog path.
- [x] Unknown slugs fail closed with `notFound()`.
- [x] `/ai` no longer carries the feature-detail hero, copy, or WIP-specific prompt starters.
- [x] Desktop and mobile authenticated browser evidence confirms catalog-to-detail navigation and `/ai` restoration.
- [x] Independent review approves the route ownership, interaction, and visual hierarchy.

## Implementation Checklist

- [x] Task-owned files and exact-path workspace lease were registered before edits.
- [x] `ai-feature-catalog.ts` owns shared catalog and detail content.
- [x] `ai-feature-detail-page.tsx` owns the shared presentation.
- [x] `ai-feature-route-page.tsx` owns shared route metadata and page composition.
- [x] Project-map and system-map artifacts include the seven static feature routes.
- [x] Existing table and app-shell primitives are reused.
- [x] AI runtime and workflow behavior are unchanged.
- [x] Focused checks, doctrine audit, and route check pass.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [x] Actual catalog-to-detail user flow is browser-tested.
- [x] `/ai` browser proof shows the restored assistant welcome.
- [x] Desktop and mobile screenshot artifacts are stored under `tests/agent-browser-runs/2026-07-24-ai-feature-detail-pages/`.
- [x] Independent review is recorded.
- [x] Task-owned files are published to `MeganHarrison/alleato-pm-backup` `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: unknown `featureSlug` resolves through `notFound()`; missing or duplicate catalog route ownership fails the focused catalog test.
- Detection path: `ai-feature-catalog.test.ts`, `npm run check:routes`, and browser navigation from the catalog.
- Recovery path: return to `/ai/features`; catalog data keeps the live workflow destination separate as `launchHref`.

## Incident Learning

- Failure fingerprint: `architecture.canonical-daily-brief-route-owner-drift`
- Failure-class match: presentation intended for a detail artifact was installed on the landing/runtime surface.
- Root cause: The visual reference was treated as a redesign of the existing `/ai` assistant instead of establishing the requested catalog-to-detail information architecture.
- Detection gap: No route ownership acceptance test required the catalog destination and feature-detail route before the visual work was published.
- Prevention: One typed catalog now separates `href` (detail education) from `launchHref` (live workflow), and the focused test requires that separation for every feature.
- Guardrail evidence: `frontend/src/features/ai/__tests__/ai-feature-catalog.test.ts`.
- Provider guardrail: the focused test requires one static route file per catalog entry and rejects restoration of the dynamic `[featureSlug]` route.

## Evidence

| Check            | Command / artifact                                                                | Result | Notes                                                       |
| ---------------- | --------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Task setup       | This task file                                                                    | Pass   | High-risk acceptance and failure-loudly contracts captured. |
| Route ownership  | `frontend/src/features/ai/__tests__/ai-feature-catalog.test.ts`                   | Pass   | Unique detail routes and separate launch routes.            |
| Focused tests    | 3 focused Jest suites                                                             | Pass   | 20 tests passed.                                            |
| Route budget     | `npm run verify:nonprod-routes`                                                   | Pass   | 654/654 dynamic files; 2042/2042 generated routes.          |
| Production build | `cd frontend && pnpm run build:production`                                        | Pass   | Post-refactor build completed in 38.6 seconds with no errors. |
| Visual doctrine  | `audit-surface-complexity.mjs` on new and restored UI files                       | Pass   | New surfaces pass; pre-existing chat picker warning noted.  |
| Desktop proof    | `tests/agent-browser-runs/2026-07-24-ai-feature-detail-pages/desktop-feature-detail.png` | Pass   | Dayos-derived feature detail hero and content transition.   |
| Mobile proof     | `mobile-feature-detail.png` and `mobile-feature-content.png`                      | Pass   | Hero, feature navigation, and Challenge; no overflow.       |
| Chat restoration | `tests/agent-browser-runs/2026-07-24-ai-feature-detail-pages/desktop-ai-restored.png`    | Pass   | `/ai` remains the conversational assistant.                 |
| Interaction log  | `tests/agent-browser-runs/2026-07-24-ai-feature-detail-pages/verification.md`            | Pass   | Click, anchors, 404 recovery, and chat route recorded.      |
| Review           | Independent code/design and visual reviewers                                      | Pass   | No blocking findings.                                       |

## Remaining Risk

- The new detail copy is a first-pass product narrative and should be refined feature by feature after the information architecture and visual system are accepted.
- The shared header route selector currently labels `/ai` as `AI Features` while the breadcrumb says `Alleato AI`; this is a separate shared-header matching issue and does not change the restored chat content or feature-route ownership.

## Final Status

- [x] All required implementation and verification checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No deployment or domain change is in scope.
