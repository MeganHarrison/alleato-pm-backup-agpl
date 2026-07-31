---
name: alleato-experience-system
description: Plan, design, implement, or review Alleato product experiences as a coherent AI-native construction operating system. Use for Alleato page architecture, information hierarchy, interaction design, data visualization, motion, AI transparency, visual-system decisions, flagship experiences, redesigns, and final experience-quality reviews.
---

# Alleato Experience System

Create product experiences that help users understand what is happening, what matters, what is connected, and what to do next.

## Load the doctrine

Before making experience decisions, read:

- `references/experience-system.md` for the complete product doctrine, page archetypes, visual and interaction language, AI rules, anti-patterns, and review standard.
- `references/implementation-playbook.md` for the required UI plan, component families, delivery sequence, and definition of done.

Treat repository instructions, existing design tokens, shared components, accessibility requirements, and the Alleato product noise gate as binding constraints. Reuse canonical owners before proposing new primitives. Remove low-signal content before restyling it.

## Select the operating mode

Choose only the mode required by the request:

1. **Plan**: Produce the pre-code UI plan and stop when the user requested planning or approval.
2. **Implement**: Produce the UI plan in commentary, then build. Treat an explicit request to build or redesign as approval to proceed unless the user asks for a plan-first checkpoint.
3. **Review**: Audit the running experience and return evidence-backed findings, removal opportunities, risks, and an approval verdict.

Do not infer product quality from source code alone. For reviews and redesigns, inspect the running page and current visual evidence first.

## Run the experience workflow

Apply these specialist lenses in order. They are review lenses and do not require spawning subagents.

1. **Product story**: Read `references/product-story-designer.md`. Define the narrative question, material change, consequence, required decision, evidence, and section order.
2. **Experience architecture**: Read `references/experience-architect.md`. Select the page archetype, core objects, hierarchy, layout, interaction model, states, and anti-pattern risks.
3. **Data visualization**: Read `references/data-visualization-designer.md` only when relationships, change, risk, flow, or comparison may benefit from visualization. Keep a precise table alternative when exact values matter.
4. **Interaction**: Read `references/interaction-designer.md` for editing, selection, keyboard, search, inspectors, undo, touch, focus, and contextual actions.
5. **Visual system**: Read `references/visual-systems-designer.md` for tokens, typography, surfaces, semantic color, borders, depth, and icon treatment.
6. **Motion**: Read `references/motion-designer.md` only when motion can explain state, causality, flow, or direct manipulation. Always define reduced-motion behavior.
7. **Final review**: Reapply `references/experience-architect.md` and issue an explicit approval, needs-rework, or blocked verdict.

## Produce the pre-code UI plan

Before implementation, state:

1. Page archetype
2. User objective
3. Primary decision or action
4. Information hierarchy
5. Main objects and relationships
6. Layout zones
7. Interaction model
8. Visualization choice or reason none is needed
9. Loading, empty, error, success, and AI states
10. Motion plan or reason motion is unnecessary
11. Mobile behavior
12. Accessibility considerations

Keep the plan concise enough to guide implementation. Do not turn it into decorative product prose.

## Use the visual references selectively

The supplied source images live in `assets/visual-references/`. Inspect them when the user asks to match, evolve, compare, or derive Alleato’s visual direction. Do not copy a screenshot literally or let reference aesthetics override workflow clarity, shared components, accessibility, or repository constraints.

## Implementation guardrails

- Build reusable product-level components rather than page-local styling.
- Prefer existing Alleato primitives and canonical route owners.
- Make relationships visible only when they improve a real decision.
- Expose AI state, evidence, confidence, human control, and recovery.
- Preserve power-user density without creating visual noise.
- Avoid card grids, disconnected metrics, nested cards, excessive borders, decorative charts, ambient motion, and novelty without purpose.
- Implement failure states that are specific, actionable, and loud.
- Support keyboard use, mobile adaptation, reduced motion, and accessible non-visual alternatives.

## Closeout

Report:

- Experience Architect verdict
- Noise gate pass or fail
- What was removed or simplified
- Evidence captured at the changed boundary
- Remaining risk
- Regression guardrail
- Recommended next step
