# Task: Repair Current RAG Verification Guardrails

Status: Complete
Owner: S20260729-RAGGUARDPUB
Created: 2026-07-29
Task ID: AAI-1280-RAG-GUARDS
Linear Issue: [AAI-1280](https://linear.app/megankharrison/issue/AAI-1280/complete-and-production-verify-the-eve-rag-pipeline)
Related Handoff: N/A; this is a single-session verification-tooling slice.

## Objective

Make the existing RAG source-health and assistant-tool-registry commands execute
their current canonical verifiers on Windows and Unix.

## Scope

- Root package command routing for source freshness.
- Cross-platform path comparison in the assistant tool-registry verifier.
- No runtime, schema, provider, retrieval, or source-data mutation.

## Source of Truth

- Source health: `scripts/verify/verify_source_control_plane_health.mjs`
- Assistant registry: `scripts/verify/verify_ai_assistant_tool_registry.mjs`
- Retired command: `scripts/verify/verify_integration_health.py`

Delivery lane: Standard

Verification contract: Optional

This is verification-tooling repair only. It does not change AI/RAG runtime
behavior, provider state, data, authentication, or deployment configuration.

## Acceptance Criteria

- [x] Source freshness invokes the current Node control-plane verifier.
- [x] Tool registry path checks behave identically on Windows and Unix.
- [x] The tool-registry verifier passes.
- [x] The source-health command reaches both live databases and fails loudly on
      actual unhealthy source families.

## Implementation Checklist

- [x] Files/modules were listed before edits.
- [x] Existing canonical verifiers are reused.
- [x] No parallel verifier was introduced.
- [x] Errors remain specific and actionable.

## Integration and Verification

- [x] `npm run rag:verify:assistant-tool-registry` passes.
- [x] Node syntax and `package.json` parsing pass.
- [x] `npm run rag:verify:source-freshness` reaches live data with secure local
      database URLs and reports the current unhealthy stages.
- [x] Task-owned files are published through `codex:finish`.

## Failure-Loudly Contract

- Cause surfaced as: missing database URL or a non-zero result containing the
  exact unhealthy source family and processing stage.
- Detection path: `npm run rag:verify:source-freshness`
- Recovery path: repair the named source owner or processing stage, then rerun
  the same command.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the package command still invoked the retired Python verifier,
  while Windows path separators caused false tool-registry ownership failures.
- Detection gap: neither command had been executed from the supported Windows
  workspace during the Eve cutover.
- Prevention: the package command now points at the canonical verifier and the
  registry normalizes paths before ownership comparisons.
- Guardrail evidence: focused command output recorded below.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| Assistant tool ownership | `npm run rag:verify:assistant-tool-registry` | Pass |
| Verifier syntax | `node --check scripts/verify/verify_ai_assistant_tool_registry.mjs` | Pass |
| Health verifier syntax | `node --check scripts/verify/verify_source_control_plane_health.mjs` | Pass |
| Package syntax | Parse `package.json` with Node | Pass |
| Live failure detection | `npm run rag:verify:source-freshness` with secure local DB URLs | Expected non-zero; identified unhealthy meeting, Teams, email, and SharePoint stages |

## Remaining Risk

- The command is repaired; the live failures it exposes belong to the parent
  AAI-1280 production-remediation task and are not hidden or waived here.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly recorded.
- [x] Deferred runtime remediation names its parent owner and next action.
