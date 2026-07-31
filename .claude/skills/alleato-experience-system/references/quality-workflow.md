# Visual Quality Workflow

Use this workflow for design, redesign, “make it premium,” “make it modern,” “make it minimal,” or any request where the user can recognize quality but cannot fully articulate it.

## 1. Diagnose the current artifact

Inspect the rendered surface and source. Record:

- the primary job the current page appears to support;
- the first three things the eye notices;
- what feels dated, generic, noisy, empty, or untrustworthy;
- structural problems versus styling problems;
- repeated elements and their information value;
- capabilities that are duplicated, hidden, or absent;
- whether multiple design systems or override layers coexist.

Do not begin by changing colors, radius, or type.

## 2. Calibrate taste from evidence

Use the user's references, disliked artifact, product context, and existing app. The user does not need to explain design vocabulary.

For each reference, extract observable traits:

| Dimension | Keep | Avoid | Target |
| --- | --- | --- | --- |
| Composition | e.g. open canvas, clear search anchor | oversized hero | compact search-led library |
| Density | e.g. scannable, calm | wall of equal cards | dense rows with progressive detail |
| Typography | e.g. confident hierarchy | microcaps everywhere | restrained product scale |
| Color | e.g. warm neutral and one accent | orange used decoratively | accent only for action/state |
| Surfaces | e.g. open sections | nested cards | bounded controls and previews only |
| Interaction | e.g. obvious retrieval and save | repeated generic “Open” links | row/detail behavior with clear destination |
| Character | e.g. architectural, technically credible | generic beige SaaS | artifact-led construction identity |

Translate adjectives into testable statements:

- “Premium” means precise proportions, typography, alignment, interaction details, and coherent restraint, not black backgrounds or expensive effects.
- “Modern” means current interaction patterns, responsive recomposition, strong content hierarchy, and reduced friction, not fashionable decoration.
- “Minimal” means fewer elements with stronger information value, not removal of hierarchy, identity, or capability.

Produce a six-line taste brief. If the user is available, present only consequential choices. Do not force them to explain why a reference feels good.

Add a one-line design read:

`Reading this as: <surface> for <audience>, supporting <job>, with a <visual language> at <density>.`

When useful, calibrate three contextual dials:

- **Expressiveness:** 1 is purely conventional; 10 is highly experimental.
- **Motion:** 1 is static except feedback; 10 is cinematic choreography.
- **Density:** 1 is gallery-like; 10 is cockpit-like.

Infer the values from the user, task, environment, and reference evidence. Never use a global baseline and never randomize them. Alleato product surfaces usually need low-to-moderate expressiveness, low motion, and job-dependent density.

## 3. Establish the content model

Rank the content and actions before layout:

- Tier 1: the job and information needed immediately;
- Tier 2: frequent supporting decisions and actions;
- Tier 3: optional evidence and metadata;
- hidden: advanced, historical, or rare content;
- removed: duplicate or unjustified elements.

Name the page archetype and the retrieval/manipulation behavior. A resource library, for example, is not merely a collection of cards; it is a discovery workflow involving search, browse, filter, compare, save, resume, and open.

## 4. Diverge cheaply

Before full implementation, create two or three low-cost compositions when the correct structure is uncertain. Use annotated wireframes, compact HTML mocks, or screenshot concepts. Vary the information architecture, not just colors.

Evaluate each against:

- five-second task clarity;
- scan path;
- information density;
- length and repetition;
- responsive viability;
- product character;
- reuse of canonical patterns.

Select one direction. Do not build multiple full implementations.

## 5. Build structure before finish

Implement in this order:

1. semantic structure and content order;
2. layout and responsive recomposition;
3. typography and spacing rhythm;
4. controls and interaction states;
5. color, surface, and detail;
6. motion only when it explains state.

Lock the chosen theme, accent strategy, radius/shape vocabulary, icon family, and CTA terminology unless a documented semantic reason requires variation.

### Clean-slate redesign rule

When the content hierarchy or page archetype changes materially:

- refactor the original structure;
- remove obsolete selectors and markup;
- preserve working behavior deliberately;
- do not append a trailing override stylesheet;
- do not hide valuable features to make the screenshot quieter.

Two visual systems in one file are an automatic failure even if the latest override looks acceptable.

## 6. Run the visual critique loop

Capture at least:

- one primary desktop viewport;
- one narrow/mobile viewport when the layout is responsive;
- any state central to the workflow, such as filters open or detail selected.

For each screenshot, run:

### Five-second test

- What is this page?
- What can the user do?
- Where should the eye go first?

### Squint test

- Is there one dominant hierarchy?
- Do lower-priority controls merge into the background?
- Are large dark, colored, or boxed regions consuming attention without equivalent value?

### Repetition test

- Does the page repeat the same card, label, icon, CTA, or metadata dozens of times?
- Could rows, grouping, a preview pane, pagination, or disclosure reduce the repetition?

### Precision test

- Are widths, alignment, type steps, line lengths, and vertical rhythm deliberate?
- Do controls share one vocabulary?
- Does the accent identify action or state rather than decorate?

### Character test

- Would removing the logo make this indistinguishable from a generic template?
- Is product character coming from domain artifacts, language, and interaction, or from superficial styling?

Fix the three largest gaps and render again. Repeat until there are no blockers or three critique cycles have completed. If the design still fails, report the unresolved problem rather than calling it polished.

## 7. Quality gate

Reject the result if any statement is true:

- the redesign is a tail-end CSS override over obsolete structure;
- “minimal” was achieved by flattening hierarchy or removing useful behavior;
- the first screen is dominated by branding instead of the primary job;
- repeated records have equal visual weight with no scan strategy;
- the page requires an unnecessarily long scroll without pagination, progressive loading, grouping, or a detail workflow;
- every item repeats the same generic action label;
- responsive behavior only stacks the desktop composition;
- the result matches the rules but has no coherent visual thesis;
- no screenshot critique occurred after implementation.

Automated design scans are supporting evidence, not taste authorities. They are useful for locating hidden legacy styles, accessibility defects, and repeated implementation smells. Review false positives against the product register and calibrated target. A system font or warm neutral surface may be correct product design even when a generic detector labels it unoriginal.

## 8. Closeout evidence

Report:

```text
Calibrated target:
Primary design thesis:
Structural change:
Screenshot iterations:
Largest issues fixed after rendering:
Noise gate:
Usability gate:
Remaining risk:
Regression guardrail:
```
