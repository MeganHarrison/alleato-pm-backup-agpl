# Alleato Design Skill and Authority Audit

Date: 2026-07-28

## Executive finding

The weak results are not mainly a prompting problem. The repository exposes several incompatible design philosophies as if they were peers:

- restrained, workflow-first Alleato product rules;
- dark/cinematic/glowing “premium” interface guidance;
- card- and KPI-oriented legacy page templates;
- a stale table system that names components not present in the codebase;
- generic originality guidance that rewards novelty even when consistency is the product need.

An agent can follow one of these files faithfully and still violate another. The result is variable quality, excessive cards and chrome, invented components, inconsistent shells, and polished screens that miss basic usability states.

The corrected authority model is:

1. user request, `AGENTS.md`, task contract, and live behavior;
2. verified canonical route/components/data owners;
3. Alleato Experience System for positive composition;
4. Impeccable Alleato noise gate for removal and refinement;
5. usability/accessibility baseline and browser evidence;
6. generic design references only when they do not conflict.

## What each retained system should own

| System | Retained responsibility | Must not own |
| --- | --- | --- |
| Alleato Experience System | User/job/decision, page archetype, information hierarchy, relationships, interaction, AI evidence, responsive recomposition | Inventing component APIs; overriding repo layout; visual spectacle |
| Impeccable | Product-noise veto, hierarchy/refinement pass, critique, removal before styling | Product requirements; automatic addition of “premium” decoration |
| Alleato design doctrine | Compatibility alias and curated reference loader | A competing front door |
| Canonical page/table/detail/form skills | Implementation patterns verified against current code | Frozen mandates that contradict the live owner |
| Usability baseline | Semantics, accessibility, state completeness, recovery, content resilience | Subjective visual taste |
| Browser/UI audit | Runtime evidence and severity | Source-only assumptions or blanket product opinions |

## High-priority contradictions

### P0 — The Experience System was not publishable or discoverable

The supplied `.claude/skills/alleato-experience-system` directory was untracked, so it was absent from the active Codex skill catalog and from an isolated checkout based on `origin/main`.

**Impact:** agents could not reliably invoke it, regardless of how the user phrased the request.

**Correction:** publish the canonical skill, add `/alleato-experience-system`, add a compatibility skill entrypoint, and route design work to it.

### P1 — Root `DESIGN.md` competes with repo law

Root `DESIGN.md` is oversized, contains broken or misleading links, promotes page-shell/KPI/card patterns that conflict with the current `AGENTS.md` header and product-noise rules, and acts like a second constitution.

**Impact:** agents overweight an old, verbose document and reproduce banned patterns.

**Correction:** replace it in a follow-up with a short index that delegates to `AGENTS.md`, live canonical owners, the Experience System, and Impeccable. Add a link checker.

### P1 — Cinematic generic skills reward the wrong outcome

`premium-frontend-design` and `/design/designer` encourage dark defaults, glow, gradients, glass, unusual fonts, dramatic shadows, WebGL, animated entrances, and visual surprise. These techniques can serve a marketing artifact, but conflict with construction workflow UI and the always-on noise gate.

**Impact:** “premium” becomes spectacle, producing card grids and visual filler instead of clarity.

**Correction:** quarantine these skills to explicitly requested marketing/brand work. Retain only purpose-led signature, performance budgets, CSS-first escalation, and reduced-motion discipline.

### P1 — The old table design document is not grounded in code

`docs/design/table-system.md` describes migration to `AleatoDataTable`, `useDataTable`, and an RFI gold standard, but those named owners are not present. Current implementation uses `UnifiedTablePage`.

**Impact:** agents may invent a parallel table framework or migrate away from the actual canonical owner.

**Correction:** mark the document superseded or rewrite it from live code. Add a CI check that example owner paths resolve.

### P1 — Page creation and design gates disagree

`create-page`, `.claude/rules/DESIGN-SYSTEM-GATE.md`, `.claude/rules/TABLE-PAGE-GATE.md`, root `DESIGN.md`, and current `AGENTS.md` disagree about headers, shells, KPI rows, selection, bulk actions, cards, empty states, and edit patterns. Some referenced golden-example files are missing.

**Impact:** compliance depends on which file an agent happens to read last.

**Correction:** consolidate gates around live owners. Convert old rules into narrow compatibility notes or retire them.

### P1 — Experience System visual references were overgeneralized

The supplied relationship-map, pipeline, timeline, and AI canvases are predominantly dark, neon, and card-heavy. They contain useful spatial and data-flow patterns, but the prior skill treated the aesthetic as a broad product language.

**Impact:** ordinary forms, lists, and detail pages drift toward glowing control-room UI.

**Correction:** reserve dark/luminous treatment for bounded system-map or pipeline canvases. Use the attached architectural-industrial construction brief as the default shell and routine workflow direction.

### P2 — Impeccable is strong at critique but weak as a sole generator

Impeccable contains valuable restraint guidance and Nielsen-style review material, but it is procedural, includes unresolved template language, and its automated checks rely heavily on narrow text/regex signals. It says what to remove more reliably than what experience to build.

**Impact:** used alone, it can produce cautious generic layouts or superficial audit confidence.

**Correction:** pair it after the Experience System. Replace unresolved templates, shorten repeated doctrine, and expand tests from phrase detection to fixture-based routing, conflict, and output-quality evaluations.

### P2 — Useful skills contain over-broad rules

`interface-design` contributes intent-first design, domain exploration, signature tests, and token discipline, but overrewards uniqueness and creates a second local design authority. Responsive guidance correctly covers recomposition, capability queries, safe areas, and real-device testing, but blanket font/touch sizing is unsuitable for every dense desktop workbench.

**Correction:** incorporate the principles contextually; do not import the ceremonies or universal numeric mandates.

### P2 — Feedback and audit systems are valuable but underused

`docs/design/noise-gate-log.md` contains strong product-specific case law, and the frontend conversation-feedback ledger captures direct user preferences, but the ledger currently has very few entries. The UI audit workflow is strong when it inspects real routes, yet some blanket rules blur evidence with product opinion.

**Correction:** keep the evidence workflow, grow the feedback ledger, and require each audit rule to name whether it is repo law, usability baseline, domain requirement, or preference.

## GPT Taste and Design Taste Frontend

### `gpt-taste`: quarantine as an Awwwards generator

`C:\Users\KimiClaw\.agents\skills\gpt-taste\SKILL.md` describes itself as an elite Awwwards-level design and motion engineer. Its required defaults include simulated Python randomization, AIDA structure, a cinematic hero, gapless bento grid, mandatory GSAP, scroll pinning, hover scaling, huge section spacing, mesh/glow treatments, and Picsum assets.

This is incompatible with Alleato product UI. Applied to the Resource Library, it would likely recreate the screenshot's oversized brand chapters and add even more motion and spectacle.

Useful material is narrow:

- concise, legible marketing heroes;
- button-contrast checks;
- grid completeness;
- card-count restraint;
- overflow prevention.

Its Python “randomization” is performative rather than an executed design method. Random component selection prevents repetition but also prevents product coherence. `gpt-taste` should trigger only for an explicitly requested motion-led promotional experiment.

### `design-taste-frontend` v2: strong calibration, wrong default scope

`C:\Users\KimiClaw\.agents\skills\design-taste-frontend\SKILL.md` explicitly excludes dashboards, data tables, multi-step product UI, and dense application surfaces. That makes the Alleato Resource Library outside its intended scope even though “redesign” in its trigger description may attract it.

Its strongest contributions are:

- brief inference from page kind, audience, references, and existing brand assets;
- a one-line “Design Read” before implementation;
- preserve/overhaul/greenfield redesign classification;
- audit-first token, information-architecture, content, accessibility, SEO, and analytics preservation;
- dependency verification and honest use of established design systems;
- palette, shape, theme, icon, and CTA consistency locks;
- copy, contrast, responsive, performance, and reduced-motion checks.

These are now adapted into the Experience System's calibration and quality workflow.

Its problems:

- 12,853 words and 1,206 lines violate the skill-creator recommendation to keep the main skill under 500 lines;
- the default `8 / 6 / 4` variance/motion/density baseline is too expressive for operational software;
- many “contextual” rules become blanket preflight bans later in the file;
- it bans or discourages legitimate product choices such as Inter, long lists, row dividers, and single-theme applications;
- it tells marketing pages to convert long lists into cards, carousels, marquees, or pills, which would worsen a resource-library product surface;
- it mandates real imagery and dual-theme work too broadly;
- it suggests invented organic names/data while Alleato must not present invented data as real;
- its block-library contract points to a future `skills/taste-skill/blocks/` structure rather than bundled working blocks;
- the enormous checklist encourages checkbox compliance instead of prioritizing the primary job and rendered result.

Use its early inference and redesign protocol selectively. Do not load the entire skill for Alleato application UI.

### `design-taste-frontend-v1`: discovery collision and legacy risk

`C:\Users\KimiClaw\.agents\skills\design-taste-frontend-v1\SKILL.md` is preserved for backward compatibility, but it remains installed beside v2. Its instructions are substantially more aggressive:

- fixed `8 / 6 / 4` defaults;
- liquid glass, magnetic physics, perpetual micro-interactions, and staggered entry;
- bento-first composition;
- `rounded-[2.5rem]` card systems;
- infinite activity in every card;
- extensive GSAP/Three.js/Framer vocabulary.

It contains worthwhile dependency, state, animation-performance, cleanup, and responsive rules, but those already exist in safer sources. The duplicate installation creates discovery ambiguity. It should be removed from automatic new-work discovery and retained only if a named legacy workflow genuinely depends on it.

### Routing decision

| Skill | Alleato product UI | Alleato marketing/brand | Incorporate |
| --- | --- | --- | --- |
| `gpt-taste` | Never | Explicit Awwwards experiment only | Hero legibility, contrast, grid completeness |
| `design-taste-frontend` v2 | Do not invoke as generator | Optional, selectively | Brief inference, redesign modes, consistency locks, performance |
| `design-taste-frontend-v1` | Never | Legacy named dependency only | Nothing unique enough to justify automatic loading |

The user saying “premium,” “modern,” or “not boring” never changes a product surface into a marketing surface.

## Best material incorporated

From the existing Experience System:

- `context → relationships → signal → action → explanation`;
- page archetypes;
- evidence-aware AI and relationship modeling;
- progressive disclosure and responsive recomposition.

From the attached construction brief:

- architectural-industrial palette and texture;
- construction artifacts as visual anchors;
- compact toolbars, split detail, technical instrumentation;
- open composition and restrained depth;
- explicit state and responsive requirements.

From Impeccable and the product noise log:

- removal before restyling;
- every element must earn space;
- no nested cards, duplicate CTAs, decorative metrics, filler copy, or borders-as-hierarchy;
- concrete severity and user-impact reporting.

From interface and responsive guidance:

- intent first;
- content-driven breakpoints;
- input-capability queries;
- recognizable interaction patterns;
- purpose-led signature rather than generic novelty.

From `design-taste-frontend` v2:

- infer a one-line design read from surface, audience, job, references, and constraints;
- distinguish preserve, overhaul, and greenfield redesign modes;
- use contextual expressiveness, motion, and density dials without global defaults;
- lock palette, shapes, theme, icons, and CTA terminology;
- preserve behavior, accessibility, analytics, and content contracts during redesign.

From established web-interface guidance and usability heuristics:

- semantic controls and labels;
- keyboard/focus behavior;
- form metadata, validation, and preserved input;
- specific recovery;
- URL-backed view state;
- destructive-action safety;
- reduced motion, content extremes, performance, and responsive resilience.

## Recommended operating workflow

For a new page or redesign:

1. `/alleato-experience-system plan <target>`
2. verify the canonical route and shared owners;
3. implement the smallest coherent archetype;
4. run Impeccable's Alleato product noise gate;
5. review the live route against the usability baseline;
6. capture desktop/mobile evidence when responsive layout changed.

For an existing page that merely feels noisy:

1. run Impeccable directly;
2. remove unsupported elements;
3. invoke the Experience System only if the underlying archetype or workflow is wrong.

## Resource Library case study

Artifacts reviewed:

- `C:\Users\KimiClaw\Downloads\FireShot Capture 007 - Resource Library — Alleato Training - [].png`
- `C:\Users\KimiClaw\Desktop\project-management\alleato-resource-library.html`

The screenshot and HTML expose two opposite but related failure modes.

### Original screenshot: designed loudly instead of selectively

- An oversized black hero delays the retrieval job.
- Thirty nearly identical cards create an exhausting wall of repeated boxes.
- Colored side stripes, microcaps, pills, stars, and repeated `Open` actions spend attention without improving comparison.
- The permanent filter column and all metadata remain visible regardless of the user's current decision.
- The large AI section duplicates the header's AI action and consumes another full visual chapter.
- Brand character comes primarily from black/orange contrast and typography rather than the construction-learning workflow.

The page has energy, but poor attention economics and weak scan strategy.

### Current HTML redesign: reduction without composition

The HTML appends a second visual system beginning around line 204. The override changes fonts, surfaces, navigation, hero, cards, learning paths, finder, and footer without removing the first system.

- The card grid becomes one uninterrupted list of 30 visually similar rows.
- Learning paths and the training finder are visually suppressed rather than thoughtfully integrated.
- The page becomes quiet but nearly anonymous; hierarchy is too flat.
- Every row repeats `Open`, the star, type, title, description, and metadata with little prioritization.
- Desktop wastes horizontal space; mobile becomes an extremely long stacked catalog.
- The result is technically cleaner but not meaningfully more discoverable, differentiated, or premium.

This is “ban-based minimalism”: remove boxes and color until the page stops being noisy, without creating a stronger composition.

### Deterministic scan

`npx impeccable --json alleato-resource-library.html` returned 14 findings. Useful detections included:

- stale side-tab accents;
- the original hidden radial glow and decorative grid;
- 2.6:1 low-contrast text;
- all-caps body treatment;
- cramped bounded surfaces;
- a skipped heading level.

The scan also labeled Inter, a single-font product system, the warm neutral canvas, and every kicker as slop. Those findings conflict with other product guidance and are not automatically defects. Regex and DOM detectors can expose implementation residue, but they cannot decide whether a composition is premium, modern, or appropriate.

### Root workflow failure

The agent was allowed to move directly from an ambiguous adjective brief to implementation. It had:

- no calibrated interpretation of “premium,” “modern,” or “minimal”;
- no explicit keep/avoid analysis of the reference;
- no alternative information-architecture concepts;
- no clean-slate threshold for a structural redesign;
- no mandatory rendered screenshot critique;
- no comparative quality gate beyond rule compliance.

The corrected Experience System now requires taste calibration, content modeling, low-cost structural divergence when needed, clean structural implementation, and a desktop/mobile screenshot iteration loop.

### Likely better direction

For this resource library, the next design should begin with the discovery job:

- a compact library identity and search-first header;
- learning paths or resume/recommended content only when backed by real workflow data;
- compact filters with disclosure and visible active state;
- results optimized for scanning and comparison, not equal-weight cards;
- one meaningful resource-type cue, useful duration/source metadata, and save behavior;
- pagination or progressive loading instead of an uninterrupted 30-item mobile page;
- an optional preview/detail surface so users can inspect without losing their place;
- construction identity carried by content, language, and artifacts rather than decorative black/orange treatment.

This is a composition hypothesis, not permission to add every listed feature. The final Tier 1 content must be chosen from the actual user and data model.

### Calibrated target for the next iteration

```text
Job: Find, assess, save, and resume the right training resource quickly.
Tone: Calm, precise, current, and construction-aware; not theatrical or generic SaaS.
Hierarchy: Search and browse lead; library identity supports; metadata recedes.
Density: Scannable results with purposeful grouping or preview, not equal cards or a raw endless list.
Color: Warm neutral canvas and charcoal structure; orange only for selection, priority, or action.
Avoid: Oversized brand chapters, microcaps everywhere, side stripes, repeated generic CTAs, hidden capabilities, and tail-end CSS redesigns.
```

## Follow-up backlog

1. Replace root `DESIGN.md` with a concise canonical index and repair links.
2. Reconcile or retire `DESIGN-SYSTEM-GATE.md`, `TABLE-PAGE-GATE.md`, `create-page`, and `docs/design/table-system.md` against live code.
3. Rewrite Impeccable's unresolved templates and add fixture-based conflict/output evaluations.
4. Mark generic cinematic skills as marketing-only in their own frontmatter and documentation.
5. Add a design-authority CI check: referenced files/components must exist; no document may declare canonical status without appearing in `docs/ops/skills-routing.md`.
6. Expand the frontend feedback ledger with accepted/rejected examples and test its lookup behavior.

## Remaining risk

This change fixes discovery and gives agents a coherent route, but the contradictory legacy documents still exist. Until the follow-up consolidation lands, the routing map and authority section in the Experience System must be treated as the correction layer.
