# Task: T6 — Convert the three handbooks to MDX (ALL-20)

Status: Done
Owner: Session S225
Created: 2026-07-26
Task ID: ALL-20
Linear Issue: ALL-20 (https://linear.app/alleato-group/issue/ALL-20)
Related Handoff: `docs/ops/handoffs/2026-07-26-S225-training-module-guides.md`

## Objective

Convert the three recovered handbooks (`training-source/{PM-Handbook,Superintendent-Handbook,Alleato-PM-Software}.md`)
into versioned MDX files under `frontend/src/content/training-guides/`, per
`specs/training-module-spec.md`'s locked decision #3 ("Keep the PM Handbook,
Superintendent Handbook, and Alleato-PM Software guide as versioned MDX
files... Do not add a `training_guide` table").

Scope is content + a validation guardrail only — no MDX compiler/dependency
is added, and no route wiring. `GuideViewer` (`frontend/src/features/training/GuideViewer.tsx`,
outside this session's owned paths) already accepts pre-rendered `content`
as a prop; whatever future route compiles these `.mdx` files into that prop
is a separate concern.

## Seams under test (tdd)

1. `parseGuideFrontmatter(source)` — splits a `---\n...\n---\n<body>` MDX
   file into `{ frontmatter, body }`. Pure function, no dependency added
   (gray-matter/next-mdx-remote aren't installed and adding them is out of
   scope for a content-only ticket).
2. Frontmatter field validation — `slug`/`title`/`description` are non-empty
   strings, `roleIds` is a real list.
3. Content guardrail test over the real 3 `.mdx` files — frontmatter present
   and well-formed, `slug` matches the filename, every `roleIds` entry is one
   of the 6 seeded role slugs (`project-engineer`, `assistant-project-manager`,
   `project-manager`, `estimator`, `assistant-superintendent`, `superintendent`),
   body is non-empty and contains no literal MDX-breaking `<Tag`/`{expr}`
   syntax (these are prose docs, not components).

## Implementation Checklist

- [x] Seam 1+2: red test -> green implementation (`parseGuideFrontmatter`)
- [x] Convert the 3 `.md` files to `.mdx` with frontmatter
- [x] Seam 3: content guardrail test over the real files
- [x] `code-review` self-review before calling this done

Delivery lane: Standard

Verification contract: Optional

## Code Review (Standards + Spec, two independent sub-agents)

Fixed point: `HEAD~1...HEAD` (one commit).

**Spec axis**: confirmed the .mdx bodies are byte-for-byte identical to the
source `.md` files (verified independently — a real `diff`, not just a
prose comparison) except for the added frontmatter block. Confirmed
"Resource cards"/"guide viewer route" (also named in the Linear ticket
title) already existed from prior sessions and this diff's narrower scope
(guide conversion only) is explicitly disclosed in the task file, not a
silent gap. One finding was a **false positive**: the reviewer initially
reported 14/12/6 horizontal-rule (`---`) separators "dropped" from the
parsed body per handbook — I verified this directly (`grep -c '^---$'` on
source vs. `parseGuideFrontmatter(...).body`) and all `---` lines are
preserved correctly; the reviewer's comparison method was wrong, not the
implementation. Real gap found: task checklist/Evidence were still
placeholders even though the underlying work was done — fixed here.

**Standards axis**: 4 findings, 2 real (fixed) and 2 false positives
(verified, not fixed):
1. **Real, fixed**: `parseYamlLite` silently `continue`d past any
   unrecognized frontmatter line instead of failing loudly (CLAUDE.md Core
   Principles). Now throws a specific "Malformed frontmatter line" error.
2. **Real, fixed**: no quote-stripping — `title: "Foo: Bar"` would have
   stored the literal quote characters. Added `stripSurroundingQuotes`.
   Added tests for both (red confirmed before the fix).
3. **False positive**: "non-ASCII inconsistency" in
   `alleato-pm-software-guide.mdx` (mixed U+2011/ASCII hyphens). Verified:
   the source `training-source/Alleato-PM-Software.md` already has this
   exact mix (30 U+2011 occurrences) — I did not introduce it; the body is
   byte-identical to source. Per CLAUDE.md's editing constraint, preserving
   pre-existing non-ASCII from *recovered source content* (not content I
   authored) is correct — "fixing" it would mean editorializing real
   business content, which the whole recovery effort has deliberately
   avoided. Left as-is.
4. **Judgement call, addressed by the fixes above**: test coverage gap for
   quoted values / malformed lines — now covered by the 2 new tests.

Full suite after fixes: `npx jest src/content/training-guides` -> 13/13
passed (11 original + 2 new).

## Evidence

| Check | Command / artifact | Result |
| --- | --- | --- |
| Unit tests | `npx jest src/content/training-guides` | 13 passed (2 test files) |
| Typecheck/lint | delegated to sub-agent | Zero errors/warnings in new files; 192 pre-existing unrelated errors elsewhere, untouched |
| Content fidelity | `diff` of each `.mdx` body vs. source `.md` | Byte-identical, all three guides |
| Independent code-review | Standards + Spec axes, 2 sub-agents | 2 real findings fixed, 2 false positives verified and left as-is with evidence |
