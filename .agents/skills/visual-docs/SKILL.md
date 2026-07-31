---
name: visual-docs
description: Build a designed HTML or SVG visual explainer, including an interactive page, cheat sheet, process workflow, mental-model diagram, or decision tree, from documentation, skills, workflows, PRDs, SOPs, architecture notes, or product docs. Use when the user wants a built, interactive, editable visual document, not a rendered poster image.
---

# Visual Docs

Build single-file HTML and SVG visual explainers. This is the interactive and
editable path. It does not use image generation.

Use this skill when the user wants to understand documentation primarily
through a visual system instead of long prose.

## Boundary

Use `visual-docs` for:

- Interactive HTML explainers
- One-screen cheat sheets
- Process workflows
- Mental-model or systems diagrams
- Decision trees
- Editable SVG documentation

Do not use it for:

- Illustrated poster or infographic images
- Decorative marketing art
- A static screenshot when the user needs an editable source

If the request is ambiguous about an interactive page versus a rendered
poster, ask which output they want before building.

## Required analysis

Before choosing a format, extract the source's underlying structure:

- Primary audience and job
- One-sentence takeaway
- Main concepts
- Actors and objects
- Inputs and outputs
- Chronological workflow
- Relationships and dependencies
- Decisions and branches
- Loops and failure paths
- Deliverables
- Pain points
- Evidence or sources that build trust

Convert these into visual elements. Do not merely decorate a prose summary.

## Choose the smallest useful asset

Select the format from the content:

### Interactive HTML

Use when the material has several layers or when a newcomer should be able to
explore from overview to detail.

Required shape:

- Hero-level summary at the top
- One dominant mental model
- Progressive disclosure for supporting detail
- Clickable or selectable workflow when interaction improves learning
- Search or filtering only when there is a genuine retrieval task
- Responsive light and dark themes

Done when a newcomer can explain the concept after about five minutes of
exploration.

### Cheat sheet

Use when a practitioner needs a one-screen working reference.

Required shape:

- Minimal prose
- Commands, steps, deliverables, rules, and heuristics as short labeled rows
- Print-friendly layout
- No supporting material that is not needed during execution

Done when someone can perform the workflow from the sheet alone.

### Process workflow

Use when sequence is the main idea.

Required shape:

- Numbered steps
- Directional arrows
- Loops
- Decision diamonds
- Swim lanes when multiple actors own different steps
- Explicit failure and recovery paths

Done when the diagram answers what happens first, next, and when something
fails.

### Mental-model diagram

Use when relationships matter more than sequence.

Choose one relationship grammar, such as:

- Hub and spoke
- Systems map
- Dependency map
- Concept web

Do not mix sequence and relationship diagrams into one ambiguous graphic.

Done when the viewer can explain how the parts fit together.

### Decision tree

Use when the source contains branching logic.

Every branch ends in a concrete action or outcome. Do not leave a leaf as
another unresolved question.

Done when a practitioner can follow the tree without reading the source.

## Visual direction

The target is hand-crafted intelligence: an architect or inventor sketched a
clear system in a premium field notebook.

Aim for:

- Apple's clarity
- Linear's restraint
- Notion's warmth
- Premium editorial information design
- Architectural concept drawings
- Refined fountain-pen linework
- Light watercolor accents
- Modern visual facilitation for professionals

Keep playfulness between 4 and 6 out of 10. Retain personality without
becoming juvenile, cartoonish, clip-art-like, or classroom-poster-like.

Avoid:

- Children's educational graphics
- Generic corporate illustration
- Comic-book treatment
- Emoji-heavy design
- Decorative dashboards
- Visual filler
- Gradients
- Glassmorphism
- Stock imagery
- Heavy shadows
- External font or asset dependencies

## Design tokens

Use these defaults unless the source has an established visual system:

```css
:root {
  --paper: #faf6ee;
  --ink: #2b2926;
  --ink-soft: #6b6660;
  --wash-yellow: #f5e6a8;
  --wash-green: #d5e3c8;
  --wash-purple: #dcd3ee;
  --wash-pink: #f3d5d8;
  --wash-blue: #cfe3f0;
}
```

Use system or locally available fonts. The artifact must render correctly
without Google Fonts, CDNs, remote scripts, or network access.

Use:

- Warm cream paper
- Near-black ink
- Fine 1.5px to 2px lines
- Slightly irregular 6px to 10px radii
- Watercolor washes for semantic grouping
- Numbered circles for steps
- Sticky-note treatment only for a real aside
- Small hand-drawn spot icons only when they communicate meaning
- Almost no shadow

## Build contract

1. Read all source material before selecting the asset.
2. State the primary audience, job, takeaway, and visual grammar in working
   context.
3. Build one self-contained `.html` or `.svg` file with inline CSS and
   JavaScript.
4. Use real source content. Never ship lorem ipsum or placeholder data.
5. Make the overview understandable without interaction.
6. Use progressive disclosure instead of a long prose page with effects added.
7. Make every interaction keyboard accessible and touch usable.
8. Preserve visible focus states and semantic headings.
9. Respect `prefers-reduced-motion`.
10. Avoid accidental horizontal overflow.
11. Include print styles when the output is a cheat sheet or working reference.
12. Save the source file and return a direct link when a shareable Artifact
    publisher is unavailable.

## Alleato project integration

When this skill is used in the Alleato project:

- Prefer `docs/ops/visuals/<descriptive-slug>.html` for internal visual
  explainers.
- Treat public customer documentation as owned by the separate
  `alleato-docs-site` repository.
- Use the project `agent-browser` skill for rendered verification.
- Apply the Alleato product noise gate when the output represents product UI.
- Capture a current desktop screenshot after the final source change.
- Capture 375px or 390px proof whenever the layout is responsive.
- Keep screenshots in the Codex visualization workspace when repository
  retention policy rejects binary evidence.

## Verification

Before calling the visual complete, verify:

- The file opens without network access.
- No external fonts, scripts, stylesheets, or images are required.
- The primary takeaway is obvious in a five-second scan.
- The workflow or relationship can be followed without source prose.
- Interactive controls change the expected state.
- Keyboard focus is visible.
- Desktop and mobile layouts have no horizontal overflow.
- Light and dark themes remain legible when both are present.
- Browser console errors are empty.
- The final screenshots come from the last source revision.

Use the smallest check that can falsify the artifact first, then browser proof.

## Failure behavior

Do not ship a silent or generic failure.

- If the source contains a contradiction, surface the exact unresolved
  decision.
- If a requested output requires imagery, ask whether to switch to a poster or
  image-generation workflow.
- If the artifact cannot be rendered, report the file, command, error, cause,
  detection gap, prevention step, and smallest recovery action.
- If final screenshot proof is blocked, mark the visual `Blocked/Deferred`.

## Output rule

If the user names a specific asset, produce that asset. Otherwise choose the
smallest useful format and explain the choice briefly.

Finish with:

- Artifact link
- What the visual explains
- Verification performed
- What remains
- Recommended next step
