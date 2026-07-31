# Task: Design Page Composition Guardrail

Status: Complete
Owner: SROOT1202
Created: 2026-07-28
Task ID: LOCAL-2026-07-28-DESIGN-PAGE-COMPOSITION
Linear Issue: Not required; bounded Standard documentation and agent-instruction repair.
Related Handoff: N/A; single-session Standard work.

## Objective

Make the canonical design guidance teach a coherent modern page composition,
including a resource-library recipe and a construction-specific visual
signature that does not depend on 3D visualization.

## Scope

- Root design authority, design index, principles, positive page archetypes,
  nested page-agent instructions, and a focused documentation verifier.
- Excludes product-page implementation and the in-progress training library.

## Source of Truth

- Canonical runtime/data owner: Root `DESIGN.md` and canonical shared frontend
  route owners.
- Existing shared primitives/services: `ProjectPageHeader`, `PageContainer`,
  `PageShell`, `UnifiedTablePage`, shared split-page and form patterns.
- Deprecated or parallel paths: Conflicting KPI/card guidance in nested
  `frontend/src/app/(main)/AGENTS.md`.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Root `DESIGN.md` links to positive page archetypes.
- [x] A resource-library archetype defines search, filtering, results, empty
  states, and responsive behavior.
- [x] The product signature uses real project artifacts without requiring 3D.
- [x] Nested agent instructions no longer prescribe KPI dashboards or
  card-wrapped forms.
- [x] Failure-loudly behavior is defined through a focused verifier.

## Implementation Checklist

- [x] Files/modules to change were listed before edits.
- [x] Shared design authority owns cross-cutting behavior.
- [x] Conflicting instructions were removed instead of layered over.
- [x] No product runtime, database, provider, authentication, permission, or
  delivery contract changed.

## Integration and Verification

- [x] Targeted Markdown lint passes.
- [x] Canonical design references resolve.
- [x] Focused design-documentation contract passes.
- [x] Known unrelated failures are recorded below.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the verifier names the missing canonical reference,
  archetype, non-3D signature, or reintroduced conflicting nested instruction.
- Detection path:
  `node scripts/verify/verify-design-page-composition-docs.mjs`.
- Recovery path: restore the missing canonical contract or remove the
  conflicting nested recipe, then rerun the verifier.

## Incident Learning

- Failure fingerprint: `design.page-composition-contract-drift`
- Root cause: Canonical and nested design instructions described incompatible
  page recipes, while prohibition-heavy guidance lacked positive archetypes.
- Detection gap: No check asserted one authority, a normal-page grammar, or the
  absence of legacy KPI/card recipes in nested instructions.
- Prevention: Canonical page archetypes, explicit non-3D product signature,
  corrected nested rules, and a focused verifier.
- Guardrail evidence:
  `node scripts/verify/verify-design-page-composition-docs.mjs` passes.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Diff integrity | `git diff --check` | Pass | No whitespace errors. |
| Markdown | `npx markdownlint-cli2 --no-globs ...` | Pass | Changed canonical docs have zero issues. |
| Link contract | Targeted PowerShell `Test-Path` check | Pass | Ten canonical references exist. |
| Design contract | `node scripts/verify/verify-design-page-composition-docs.mjs` | Pass | Authority, archetypes, signature, and nested rules agree. |

## Remaining Risk

- Documentation improves agent defaults but cannot prove visual quality on
  every future screen. UI tasks must still use browser evidence and the noise
  gate.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No deferred work remains.
