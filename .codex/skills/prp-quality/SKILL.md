---
name: prp-quality
description: Validate a completed PRP for implementation readiness, context completeness, and one-pass execution confidence. Use this whenever the user asks to review, validate, score, approve, or sanity-check a PRP before execution.
---

# PRP Quality

Use this skill when the user wants a PRP reviewed before implementation.

## Input

Expected argument:

```text
<path/to/prp.md>
```

Examples:

```text
docs/PRPs/submittals/prp-submittals.md
docs/PRPs/ai/prp-ai-assistant.md
```

## Mission

Decide whether the PRP is ready for execution without relying on unstated repo
knowledge. The quality bar is whether an unfamiliar but capable implementation
agent could deliver the feature successfully using the PRP, referenced files,
and repository instructions.

## Required Validation Process

1. Read the PRP completely.
2. Read repository instructions before judging readiness:
   - `AGENTS.md`
   - Relevant nested `AGENTS.md` files for the PRP scope if they exist
3. Validate the PRP across these phases:
   - Structural validation
   - Context completeness validation
   - Information density validation
   - Implementation readiness validation
   - Validation-gates dry run
4. Verify referenced repo files exist and are specific enough to follow.
5. Flag placeholders, vague guidance, guessed naming, or missing validation
   commands as readiness failures.
6. Reject any PRP with an overall confidence score below `8/10`.

## Structural Validation

Verify the PRP contains and meaningfully fills in these sections:

- Goal
- Why
- What
- All Needed Context
- Implementation Blueprint
- Validation Loop
- Final Validation Checklist

Check that:

- Goal includes a concrete feature goal, deliverable, and success definition
- Implementation tasks exist and are ordered
- The final validation checklist is specific to the feature
- Any YAML or structured context blocks are well-formed enough to use

## Context Completeness Validation

Apply the no-prior-knowledge test:

> Could a capable engineer who does not already know this codebase implement the
> feature successfully using only this PRP, its references, and the repo rules?

Validate that:

- Referenced files exist
- URLs, docs, and examples are specific enough to be useful
- Known pitfalls are codebase-specific, not generic filler
- Naming and placement guidance are explicit
- Validation commands are repo-specific and executable in principle

## Information Density Validation

Reject vague references such as:

- "follow existing patterns" without naming the files
- "similar component" without the component path
- "add tests" without naming the test surface
- "update schema if needed" without a concrete table or migration path

Every implementation task should point to exact paths, functions, components,
types, services, routes, or migrations wherever the PRP expects work to happen.

## Implementation Readiness Validation

Verify that:

- Tasks are dependency-ordered
- File creation and modification order makes sense
- Integration points are named clearly
- Shared abstractions are reused instead of one-off paths when appropriate
- Anti-patterns and likely failure modes are covered

## Validation Gates Review

Assess whether the PRP's validation loop is strong enough to catch mistakes
before merge. Look for:

1. Static validation such as typecheck, lint, or schema verification
2. Targeted automated tests
3. Integration or route-level verification
4. Frontend or domain-specific proof where applicable

Flag missing or generic validation as a quality issue.

## Report Format

Always return a report in this structure:

```markdown
# PRP Quality Validation Report

**PRP File**: <path>
**Validation Date**: <YYYY-MM-DD>
**Overall Status**: APPROVED / REJECTED / NEEDS REVISION

## Scores (1-10)
- **Context Completeness**: <score>/10
- **Information Density**: <score>/10
- **Implementation Readiness**: <score>/10
- **Validation Quality**: <score>/10
- **Overall Confidence Score**: <score>/10

## Critical Issues (Must fix before approval)
- <issue with specific file/section reference and concrete fix>

## Medium Priority Issues (Should fix)
- <issue and improvement guidance>

## Minor Issues (Optional improvements)
- <optional improvement>

## Final Decision
**Status**: APPROVED / REJECTED / NEEDS REVISION
**Reasoning**: <specific reasoning>
**Next Steps**: <clear guidance>
```

## Decision Rules

- Do not approve a PRP below `8/10` overall confidence.
- Do not give vague feedback. Point to exact sections, files, or missing
  evidence.
- Do not skip validation phases because the PRP "looks good".
- Prefer rejection over false confidence when execution readiness is unclear.

## Failure-Loudly Rule

When the PRP is not ready, explain:

- The concrete cause
- The detection gap
- The prevention step

This skill should prevent silent handoff failures by forcing missing context,
weak validation, and vague implementation guidance to surface before execution.

## Source Command

When used in `/Users/meganharrison/Documents/alleato-pm`, this skill mirrors the
repo-local Claude command:

```text
.claude/commands/prp/prp-quality.md
```
