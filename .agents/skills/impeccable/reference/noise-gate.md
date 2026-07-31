# Noise Gate

Audit a product UI for additive visual noise, cognitive overload, weak attention hierarchy, and elements that do not earn their place.

For Alleato PM product work, this command is governed by [alleato-product-noise-gate.md](alleato-product-noise-gate.md). Load it first.

## Scope

Use this command when:

- A new page, feature, form, table, AI surface, executive brief, or project intelligence view is being finalized.
- The user says the UI is cluttered, noisy, overwhelming, too dashboard-like, over-designed, or full of unnecessary elements.
- A design critique needs to focus specifically on removal and attention allocation.
- A frontend change is ready to close and needs final approval against the visual-noise standard.

This command may be audit-only if the user asks for review. Otherwise, fix the UI before reporting completion.

## Required Inputs

Inspect the target source and, when possible, the live rendered page. Identify:

- Primary user.
- Primary job.
- Primary decision.
- Primary action.
- Key states.
- Current visible elements.

If the target is ambiguous, inspect neighboring routes/components before asking. Ask only when the primary job cannot be determined from context.

## Attention Architecture

Produce:

```text
Primary user:
Primary job:
Primary decision:
Tier 1:
Tier 2:
Tier 3:
Hide until requested:
Remove:
Primary action:
Failure-loudly behavior:
```

Tier 3 through Tier 5 content must not compete visually with Tier 1.

## Element Audit

For meaningful visible elements, score:

```text
Element:
Purpose:
User value, 0-10:
Cognitive cost, 0-10:
Decision: keep / simplify / remove
Reason:
```

Remove or simplify anything where cognitive cost exceeds user value.

## Automatic Removal Candidates

Challenge these first:

- Wrapper cards around page sections.
- Nested cards.
- Decorative icons.
- Decorative badges.
- Helper panels.
- Finder widgets.
- Insight strips.
- Duplicate CTAs.
- Duplicate summaries.
- Redundant descriptions or subtitles that restate the title, paraphrase it, or state the obvious (e.g. title "Edit Subcontract" + description "Update subcontract details"). For each `description`/`subtitle`/dialog body, name the specific information it adds beyond the title; if you cannot, remove it.
- Extra filters or search boxes.
- Charts that do not support a decision.
- Gradients, glows, glass, heavy shadows, or animated decoration.
- Metadata visible before it is needed.

## Fix Strategy

Apply fixes in this order:

1. Remove.
2. Hide behind disclosure.
3. Merge with existing content.
4. Demote visually.
5. Restyle only if the element has proven value.

Do not solve noise by making noisy elements prettier.

## Verification

Run:

- 5-second scan test: where am I, what is this, what matters most, what should I do next?
- 15-second executive test for executive/project-intelligence surfaces.
- Failure-loudly check for errors and missing data.
- Responsive check where layout changes materially.

## Output

Return:

```text
Gate: pass / needs revision
Top noise sources:
Removed or simplified:
Kept because:
Remaining risk:
Regression guardrail:
```

If changes were made, include changed files and verification evidence.
