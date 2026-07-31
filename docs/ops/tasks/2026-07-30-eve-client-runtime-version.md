# Task: Align Eve Client and Agent Runtime

Status: In Progress
Owner: Codex
Created: 2026-07-30
Task ID: AAI-1274
Linear Issue: AAI-1274
Related Handoff: N/A

## Objective

The Alleato frontend must consume the complete Eve 0.27.13 stream produced by
the canonical `agents/alleato-assistant` runtime and render the full assistant
answer in a real authenticated browser session.

## Scope

- Align the frontend `eve` and `ai` runtime dependencies with the canonical Eve
  agent.
- Refresh both frontend lockfiles because both remain active repository inputs.
- Exclude changes to the Eve agent, tool implementations, and chat UI unless
  version alignment does not resolve the reproduced stream failure.

## Source of Truth

- Canonical runtime/data owner: `agents/alleato-assistant/package.json`
- Existing shared primitives/services: `eve/react`, `frontend/src/hooks/use-alleato-eve-chat.ts`
- Deprecated or parallel paths: Eve `0.22.6` in the frontend dependency graph

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Frontend `eve` resolves to the same `0.27.13` release as the agent.
- [x] Frontend `ai` satisfies Eve 0.27.13's `^7.0.38` peer contract.
- [x] Existing Eve-only architecture guard passes and package-manager readback
      proves one frontend AI SDK version.
- [x] A real authenticated `/ai` turn renders the complete answer, not only its
      first Markdown token.
- [x] Browser screenshot, session URL, tool trace, and source/data proof are
      recorded before the fix is called complete.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared framework runtime owns stream parsing; no custom parser is added.
- [x] The dependency mismatch is surfaced as the specific failure cause.
- [x] Package-manager readback proves the resolved client version.

## Integration and Verification

- [x] Targeted dependency and static checks pass.
- [x] Actual user-flow readback proves the requested outcome.
- [x] Failure screenshot and exact session URL are recorded.
- [x] Independent review is complete.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: frontend and agent Eve versions differ, or the browser
  renders less text than Eve's completed stream event.
- Detection path: resolved-package readback, Eve stream artifact, and
  authenticated browser screenshot.
- Recovery path: pin the frontend to the agent's exact Eve release, align the AI
  SDK peer, reinstall from the canonical lockfile, and rerun the same browser
  prompt.

## Incident Learning

- Failure fingerprint: `ai.chat-approval-boundary-drift`
- Root cause: the frontend resolved Eve 0.22.6 while the canonical agent ran
  Eve 0.27.13; the completed stream contained the full answer but the live
  browser retained only the first `**`.
- Detection gap: the Eve-only verifier proved one generation owner but did not
  block a client/server Eve package-version mismatch or a nested AI SDK split.
- Prevention: exact pins plus package-manager graph readback are required for
  this release. A repository version-skew test must be published before final
  closeout because no existing version-alignment guard was found.
- Guardrail evidence: `npm run verify:eve-only-runtime`, `pnpm list ai eve
  @ai-sdk/react --depth 2`, and `npm ls ai eve @ai-sdk/react
  --package-lock-only --all --legacy-peer-deps`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Failure browser proof | `C:\Users\KimiClaw\AppData\Local\Temp\eve-smoke-getProjectBudgetSummary-failed-2026-07-30.png` | Failed as expected | UI displayed tool steps but only `**` for the final answer. |
| Failure session | `http://localhost:3012/ai?session=d3a22920-ef7f-4d3d-96a9-6d77af584b17` | Reproduced | Session 202, stream 200, tool callbacks 200. |
| Stream boundary | `agents/alleato-assistant/.eve/.workflow-data/streams/chunks/.../chnk_01KYTHFPFE0VZRX6P2JD7HC3SK.bin` | Full answer present | `message.completed` contains the complete answer, localizing the loss to the client side. |
| Version readback | `frontend/node_modules/eve/package.json` and `agents/alleato-assistant/package.json` | Failed before fix | Frontend 0.22.6 versus agent 0.27.13. |
| Corrected version readback | `node -e "<resolved Eve and AI version assertion>"` | Passed | Frontend Eve 0.27.13, agent Eve 0.27.13, frontend AI 7.0.42. |
| Full frontend AI graph | `pnpm list ai eve @ai-sdk/react --depth 2`; `npm ls ai eve @ai-sdk/react --package-lock-only --all --legacy-peer-deps` | Passed | `@ai-sdk/react` 4.0.45, root AI, Eve peer, and both lockfiles resolve only AI 7.0.42. |
| Eve-only runtime guard | `npm run verify:eve-only-runtime` | Passed | One canonical generation owner remains. |
| Focused transport tests | `pnpm --dir frontend exec jest --runInBand --runTestsByPath ...` | Passed | 3 suites, 10 tests. |
| Corrected browser proof | `C:\Users\KimiClaw\AppData\Local\Temp\eve-smoke-getProjectBudgetSummary-passed-2026-07-30.png` | Passed | Full response rendered with project, contract, change-order, and change-event data. |
| Corrected session | `http://localhost:3042/ai?session=0a10b98f-0d58-4447-95b2-978e8ac79446` | Passed | Session 202, stream 200, persistence POST/GET 200, visible answer complete. |
| Post-review two-turn proof | `C:\Users\KimiClaw\AppData\Local\Temp\eve-runtime-aligned-two-turn-2026-07-30.png` | Passed | Session `836d556a-f2fd-4b26-a9a3-04aca0df1217` invoked `getDomainIntelligence`, reached `session.waiting`, accepted a continuation, invoked `getDraftArtifact`, and completed the second turn. |
| Independent re-review | Reviewer inspection of the four scoped files and resolved dependency graphs | Passed | No remaining correctness, security, or regression findings. |

## Remaining Risk

- The independent review's split-AI finding is fixed. A repository version-skew
  test and publication remain before release closeout.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No deferred implementation is hidden.
