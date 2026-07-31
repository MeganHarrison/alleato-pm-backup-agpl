# Written Training Guides

Status: **Resolved** (2026-07-27, sessions S225 + S232 + S250 / ALL-20). The four
handbooks landed on disk at `training-source/{PM-Handbook,Superintendent-Handbook,Alleato-PM-Software}.md`
and `training-source/docs/Alleato_Self_Evaluation_Workbook.pdf`, and are
converted here as versioned MDX with frontmatter, per
`specs/training-module-spec.md`'s locked decision #3 ("Keep the PM Handbook,
Superintendent Handbook, and Alleato-PM Software guide as versioned MDX
files... Do not add a `training_guide` table").

## Files

- `pm-handbook.mdx` — roles: `project-engineer`, `assistant-project-manager`, `project-manager`
- `superintendent-handbook.mdx` — roles: `assistant-superintendent`, `superintendent`
- `alleato-pm-software-guide.mdx` — roles: all six (general software guide)
- `manager-coaching-guide.mdx` — roles: `project-manager`, `superintendent`

## Frontmatter shape

```yaml
---
slug: pm-handbook
title: PM Handbook
description: One-sentence summary.
roleIds:
  - project-engineer
  - project-manager
---
```

Parsed by `frontmatter.ts` (`parseGuideFrontmatter`) and loaded through
`catalog.ts`, the single allowlisted owner for guide slugs and source files.
The authenticated `/training/guides/[guideSlug]` route renders each body through
the shared `MarkdownRenderer` and `GuideViewer`; unknown slugs use the canonical
not-found boundary. No separate database or MDX runtime is required because the
guide corpus is prose-only Markdown stored in versioned `.mdx` files.

## Validation

`__tests__/guides.test.ts` guards all four files: frontmatter is well-formed,
`slug` matches the filename, every `roleIds` entry is one of the 6 seeded
role slugs (`project-engineer`, `assistant-project-manager`, `project-manager`,
`estimator`, `assistant-superintendent`, `superintendent` — see
`scripts/training/source/resources.json`), and the body contains no
MDX-breaking JSX-like syntax or external-product branding. `catalog.test.ts`
guards the runtime registry, render-ready bodies, and unknown-slug behavior.
