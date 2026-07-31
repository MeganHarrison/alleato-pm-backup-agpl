# AI feature detail layout

Delivery lane: Standard

## Acceptance contract

- `/ai/features/assistant` uses the normal scrollable application surface, not the fixed-height chat treatment.
- The detail experience fills the available application canvas and preserves readable internal text measures.
- Only the global application header supplies breadcrumbs; the feature page retains a single back action.
- Anchor navigation reaches every section and the entire narrative remains scrollable.

## Experience plan

- **Archetype:** Storyline.
- **Objective:** Explain what the assistant does, its evidence-to-decision flow, and where people retain control.
- **Primary question:** Can I trust and use this AI capability in my project workflow?
- **Hierarchy:** back action and purpose; process/evidence; human controls; deployments and outcome.
- **Layout:** full-width application canvas with a full-bleed hero, a single section navigator, and open content zones.
- **Interaction:** normal application scrolling; section links use native anchors; back action returns to the feature inventory.
- **States:** loading follows app shell; empty/error content fails through the route boundary; narrow viewports stack the hero and section nav.
- **Accessibility:** semantic article/header/section landmarks, labelled in-page navigation, visible focus states, and no motion required for comprehension.

## Evidence

- `pnpm exec eslint src/app/(main)/layout.tsx src/features/ai/ai-feature-detail-page.tsx src/features/ai/ai-feature-route-page.tsx` passed.
- `git diff --check` passed.
- Next.js started in the isolated workspace, but the local Eve development server exited because its authored `alleato-assistant` module cannot resolve the `eve` package. This is unrelated local-runtime debt; it prevents authenticated browser proof in the isolated workspace.
