# Recurring Failure Learning Loop

This directory is the canonical index for failure patterns that should make the
next investigation faster or prevent the same class of incident entirely.

The `.yaml` registry intentionally uses JSON-compatible YAML syntax so the
finish gate can parse it with Node.js alone, even when workspace dependencies
have not been installed.

Task and handoff documents remain the detailed evidence record. The registry is
the compact execution index that points an agent or developer to the right
owner, first checks, prior incidents, and guardrail.

## Maturity Model

| Maturity | Meaning |
| --- | --- |
| `recorded` | The incident and lesson are captured. |
| `diagnosable` | Symptoms map to exact first checks and expected signals. |
| `detectable` | An active check makes recurrence fail loudly or alerts with actionable evidence. |
| `prevented` | An active test or contract gate blocks the original failure before user impact. |

Detection is not prevention. A timeout, alert, or dashboard can make a failure
loud while the underlying defect remains possible.

## Commands

Search by symptom:

```bash
node scripts/ops/learning-registry.mjs lookup \
  --symptom "drawing zoom controls do nothing"
```

Search by owned paths:

```bash
node scripts/ops/learning-registry.mjs lookup \
  --files frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx
```

Validate the registry:

```bash
node scripts/ops/learning-registry.mjs audit
```

Validate staged task fingerprint references:

```bash
node scripts/ops/learning-registry.mjs audit --staged
```

Strict audit also rejects unresolved promotion debt:

```bash
node scripts/ops/learning-registry.mjs audit --strict
```

## Promotion Rule

When a failure class recurs, it must reach at least `detectable` maturity or
carry explicit promotion debt with an owner and next action. Repeated prose-only
lessons are not considered closed.

Significant bug tasks opt into the contract through an `## Incident Learning`
section. `codex:finish` validates staged task files that contain that section;
historical task files are not retroactively rejected.
