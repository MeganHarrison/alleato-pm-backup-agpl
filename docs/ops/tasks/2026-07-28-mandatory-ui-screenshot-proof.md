# Task: Mandatory UI Screenshot Proof

Status: Complete
Owner: SROOT1203
Created: 2026-07-28
Task ID: LOCAL-2026-07-28-MANDATORY-UI-SCREENSHOTS
Linear Issue: Not required; bounded Standard agent-instruction repair.
Related Handoff: N/A; single-session Standard work.

## Objective

Make current final-route screenshots a blocking completion requirement for
every user-facing frontend change.

## Scope

- Root repository rules, canonical design contract, page archetypes, nested
  frontend agent rules, recurring-failure record, and focused verifier.
- Excludes product UI and browser capture because this task changes
  documentation and verification logic only.

## Source of Truth

- Canonical runtime/data owner: Root `DESIGN.md` and `AGENTS.md`.
- Existing shared primitives/services: Repository-owned authenticated browser
  verification under `npm run verify:browser`.
- Deprecated or parallel paths: Advisory screenshot language that allowed UI
  completion without final still-image proof.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Every user-facing frontend change requires a current desktop screenshot.
- [x] Responsive changes additionally require 375px or 390px mobile proof.
- [x] State-specific changes require a screenshot of the changed state.
- [x] Invalid substitutes and invalid captures are explicitly named.
- [x] Missing proof blocks completion as `Blocked/Deferred`.
- [x] The automated design-documentation verifier enforces the rule.

## Implementation Checklist

- [x] Files/modules to change were listed before edits.
- [x] Shared documentation owns the cross-cutting rule.
- [x] Failure language is specific and actionable.
- [x] No product runtime, database, provider, authentication, permission, or
  external-delivery contract changed.

## Integration and Verification

- [x] Targeted Markdown lint passes.
- [x] Focused design-documentation contract passes.
- [x] Learning-registry audit passes.
- [x] Task-owned files are published through `codex:finish`.

## Failure-Loudly Contract

- Cause surfaced as: the verifier identifies the canonical or nested agent file
  missing the mandatory screenshot contract.
- Detection path:
  `node scripts/verify/verify-design-page-composition-docs.mjs`.
- Recovery path: restore the missing completion gate and rerun the verifier.

## Incident Learning

- Failure fingerprint: `design.page-composition-contract-drift`
- Root cause: Screenshot language was advisory and lane-dependent instead of a
  universal completion condition for user-facing frontend work.
- Detection gap: The documentation verifier did not assert the screenshot rule.
- Prevention: Same-revision desktop proof, conditional mobile/state proof, a
  blocked-without-proof rule, and automated documentation checks.
- Guardrail evidence:
  `node scripts/verify/verify-design-page-composition-docs.mjs` passes.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Diff integrity | `git diff --check` | Pass | No whitespace errors. |
| Markdown | Targeted `markdownlint-cli2 --no-globs` | Pass | Changed Markdown has zero issues. |
| Design contract | `node scripts/verify/verify-design-page-composition-docs.mjs` | Pass | Screenshot contract is present at both authority levels. |
| Learning registry | `node scripts/ops/learning-registry.mjs audit --task ...` | Pass | Fingerprint and task evidence agree. |

## Remaining Risk

- The documentation contract detects rule drift, while task reviewers must
  still reject screenshots that do not show the changed route or state.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No deferred work remains.
