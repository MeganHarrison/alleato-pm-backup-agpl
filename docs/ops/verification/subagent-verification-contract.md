# Sub-Agent Verification Contract

Sub-agents do not self-certify feature quality. A `PASS` result is valid only when the declared acceptance criteria and lane-required evidence artifacts are present.

Use this contract for High-risk work and only when a Standard task needs a machine-readable evidence bundle. Fast work never uses this contract. Standard contracts declare only evidence for their changed boundary; High-risk contracts add independent review and complete end-to-end release proof.

## Roles

- Builder: defines the manifest and implements the feature.
- Functional verifier: uses a fresh browser session to execute the complete flow, verify database persistence, reload/edit behavior, and failure paths.
- Visual verifier: reviews desktop, tablet, and mobile evidence against the Alleato noise gate.
- Evidence judge: validates the result with `verification-contract.mjs` and rejects incomplete or contradictory claims.

## High-risk sequence

1. Create a manifest from `scripts/templates/verification-manifest.example.json`.
2. Define observable outcomes before opening the browser.
3. Run the functional and visual verification passes independently.
4. Store browser artifacts under `tests/agent-browser-runs/<run>/`.
5. Create a result JSON containing the declared evidence paths.
6. Run:

```bash
npm run verify:contract -- \
  --manifest path/to/verification-manifest.json \
  --result path/to/verification-result.json \
  --root .
```

The result is not accepted until this command passes.

For High-risk publishable work, the same check runs through closeout:

```bash
npm run codex:finish -- \
  --message "Ship feature verification" \
  --files <task-owned-files> \
  --verification-manifest path/to/verification-manifest.json \
  --verification-result path/to/verification-result.json
```

`codex:finish` requires the manifest and result together for High-risk tasks. Standard tasks use the focused test and proof named in their task; `--no-verify` does not replace that proof. New task files declare a delivery lane.

Review acceptance uses the stricter command:

```bash
npm run verify:review-queue -- --strict docs/ops/handoffs/<handoff>.md
```

For a High-risk task, review acceptance requires a `PASS` result, not merely a valid `BLOCKED` or `INCONCLUSIVE` report. CI runs this check for changed handoffs.

Every PASS result also requires `independentReview.decision: APPROVED`, a reviewer identity, timestamp, and an existing review artifact. The reviewer must be a separate verifier/evidence-judge pass, not the builder's completion narrative.

Each manifest declares `riskLevel: standard|high`, the task ID, and claims. The result repeats the task ID and supplies matching claim evidence. Declare only the proof needed for the changed boundary; a High-risk task additionally declares its full release evidence.

## Evidence rules

When declared by the manifest, a `PASS` requires:

- screenshots of the starting, completed, and resulting states;
- a browser video and action log;
- database readback of every expected persisted field;
- reload/edit-prefill proof;
- a negative-path or validation result;
- an independent visual review for High-risk work;
- a durable regression test when the changed behavior can regress.

`FAIL`, `BLOCKED`, `INCONCLUSIVE`, and `NOT_RUN` are honest terminal outcomes and require a reason. The CLI records those statuses explicitly; it never prints a PASS success message for them. They must not be rewritten as `PASS` to satisfy a handoff.

## Failure contract

The validator fails loudly with the exact missing artifact, malformed manifest field, unresolved finding, or conflicting status. The recovery is to produce the missing evidence or report the correct non-pass status.

## Review rule

The evidence judge should review the verifier result independently from the builder's narrative. A screenshot can prove visible state, but it cannot prove database persistence; a database row can prove persistence, but it cannot prove responsive usability.
