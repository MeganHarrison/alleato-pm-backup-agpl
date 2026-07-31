---
name: alleato-design-doctrine
description: Legacy compatibility route for Alleato UI doctrine. When invoked, redirect to `impeccable` as the primary Alleato design entrypoint, then load the Alleato doctrine overlay and reference pack for workflow gates, blessed patterns, split-page rules, property-bar rules, and audit scripts.
---

# Alleato Design Doctrine

`impeccable` is now the single primary entrypoint for Alleato UI/design work.

Use this skill only when:

- a user explicitly names `alleato-design-doctrine`
- legacy prompts or pinned commands still reference it
- you need the Alleato-specific reference pack or audit scripts after entering through `impeccable`

## Required Behavior

If this skill is triggered:

1. Treat it as an alias, not a competing top-level design skill.
2. Invoke the `impeccable` flow for the actual task.
3. For Alleato product UI work, load:
   - `.agents/skills/impeccable/reference/alleato-doctrine.md`
   - `.agents/skills/impeccable/reference/alleato-product-noise-gate.md`
4. Load the relevant reference files in this folder when the task needs detailed Alleato pattern guidance:
   - `.agents/skills/impeccable/reference/alleato/product-design-constitution.md`
   - `.agents/skills/impeccable/reference/alleato/workflow-usability-gate.md`
   - `.agents/skills/impeccable/reference/alleato/surface-complexity-budgets.md`
   - `.agents/skills/impeccable/reference/alleato/blessed-patterns.md`
   - `.agents/skills/impeccable/reference/alleato/split-page-workspace.md`
   - `.agents/skills/impeccable/reference/alleato/detail-property-bar.md`
   - `.agents/skills/impeccable/reference/alleato/pattern-library-operating-model.md`
   - `.agents/skills/impeccable/reference/alleato/bad-vs-good-examples.md`
   - `.agents/skills/impeccable/reference/alleato/review-checklists.md`
5. Run the doctrine audit scripts when the task touches applicable UI files:

```bash
node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs <changed-ui-file...>
node .agents/skills/impeccable/scripts/alleato/audit-split-page-consistency.mjs <changed-ui-file...>
```

## Intent

This skill now exists to preserve compatibility and keep the Alleato reference pack discoverable without leaving two competing front doors for the same design workflow.
