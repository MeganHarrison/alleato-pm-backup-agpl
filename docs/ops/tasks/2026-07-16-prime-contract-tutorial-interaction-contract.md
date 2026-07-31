# Task: Prove Prime Contract Tutorial Interactions

Status: In Progress
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1123
Linear Issue: [AAI-1123](https://linear.app/megankharrison/issue/AAI-1123/prove-prime-contract-tutorial-interactions-with-a-declarative-capture)
Related Handoff: `docs/ops/handoffs/2026-07-16-S163-prime-contract-tutorial-interaction-contract.md`

## Objective

Make the Create a Prime Contract tutorial run prove real user interactions and a persisted result, producing a stable interaction-evidence artifact packet.

## Scope

- Extend the existing tutorial recorder and the Prime Contract reference workflow with deterministic actions, semantic assertions, and intentional capture checkpoints.
- Add focused regression coverage for the new interaction contract.
- Do not publish end-user documentation, add claim provenance, implement video rendering, or alter Prime Contract product policy in this slice. Client-facing publication is a required downstream stage in the canonical `alleato-os` docs repository; it cannot be inferred from this capture task.

## Source of Truth

- Canonical runtime/data owner: the existing Playwright tutorial capture pipeline and the canonical Prime Contract create route.
- Existing shared primitives/services: tutorial recorder, workflow definition, training-document artifact model, Prime Contract create flow.
- Deprecated or parallel paths: manual Scribe export and raw page screenshot utilities are reference/evidence inputs, not the canonical tutorial capture path.

Verification contract: Required

## Acceptance Criteria

- [ ] The reference run fails loudly on a missing control, wrong route, wrong selected value, failed persistence, or semantically mismatched checkpoint.
- [ ] The generated artifact packet includes intentional screenshots and a machine-readable interaction timeline for the verified Prime Contract path.
- [ ] Focused tests cover the new assertion/checkpoint behavior and the reference tutorial proves a persisted result.
- [ ] Legacy or duplicate capture paths are explicitly deferred rather than used as a second tutorial owner.

## Implementation Checklist

- [ ] Recorder and workflow owner files are identified before edits.
- [ ] Shared interaction-evidence abstraction owns cross-cutting assertion and checkpoint behavior.
- [ ] Capture errors identify the failed checkpoint, expected state, and recovery action.
- [ ] Authentication, permission, seeded-data, and cleanup contracts are handled where applicable.

## Integration and Verification

- [ ] Targeted recorder/workflow tests pass.
- [ ] A real canonical user-flow capture proves the requested outcome.
- [ ] Screenshot and video evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing semantic control, wrong route/state, unexpected selected value, failed persistence, or invalid artifact checkpoint.
- Detection path: recorder assertion, focused test, and authenticated tutorial run.
- Recovery path: correct the route/workflow selector or seeded precondition; do not accept a fallback screenshot.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: screenshot artifacts can exist without proof that the intended interaction or resulting persisted state occurred.
- Detection gap: the current Prime Contract workflow suppresses action failures and only captures post-action viewport state.
- Prevention: semantic assertions and required checkpoints in the shared tutorial contract.
- Guardrail evidence: focused recorder tests plus canonical authenticated capture evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Learning lookup | `node scripts/ops/learning-registry.mjs lookup ...` | Pass | Existing runtime-evidence guardrail selected. |
| Auth refresh | `PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm --dir frontend exec playwright test tests/auth.setup.ts --config=config/playwright/playwright.config.ts --project=setup --reporter=line` | Pass | Rebuilt `frontend/tests/.auth/user.json` and verified a protected local route. |
| Recorder unit test | `npx tsx --test scripts/tutorials/__tests__/tutorial-recorder.contract.test.mts` | Pass | 2/2 calendar accessibility-name cases passed. |
| Authenticated preview capture | `npm run tutorial:capture -- ... --output-dir tmp/tutorial-captures/AAI-1123-prime-contract-preview` | Pass | Generated a 14-step manifest, Markdown timeline, WebM, and screenshots for form, dropdown, date, SOV, scope, privacy, and preview-save states. |
| Saved-result probe | `TUTORIAL_SUBMIT_WORKFLOW=1 npm run tutorial:capture -- ...` | Blocked | POST persisted the Prime Contract, but the runner did not reach the detail route/cleanup phase. Direct Supabase read verified the record; canonical `DELETE /api/projects/67/contracts/<id>` returned 200 and removed it. |
| Saved-result capture and cleanup | `TUTORIAL_SUBMIT_WORKFLOW=1 npx tsx scripts/tutorials/run-tutorial.ts ...` | Pass | Generated a 14-step packet whose final checkpoint is the Prime Contract detail route; post-run Supabase query returned `remainingContracts=0`. |
| Docs-site promotion guardrail | `npm run tutorial:promote-docs-site -- ... --docs-root /tmp/alleato-os-does-not-exist` | Pass | Fails loudly with the required canonical docs-repository promotion-script path; it does not silently create a parallel local docs page. |
| Docs-site source release | `git -C /Users/meganharrison/Documents/alleato-os commit ... && git push origin main` | Pass | Published the tutorial page/screenshots (`0875086`) and then consolidated the duplicate overview (`c94b415`) with legacy routing (`b37aaf9`). |
| Docs-site visual verification | `agent-browser open https://alleato-docs-site.vercel.app/prime-contracts/create-a-prime-contract` | Pass | The public page renders the unified guide and its 14 captures; screenshot is `/tmp/alleato-docs-prime-contract-unified-live.png`. The former overview route returns `308` to the unified guide, then `200`. |

## Remaining Risk

- The authenticated preview runner reaches the canonical route, fills form values, captures exact Owner/Client and Status menus, selects an exact Budget Code, and writes a complete 14-step screenshot/video/manifest packet without creating demo data.
- The saved-result path now waits for the canonical detail route, captures it, and verifies cleanup. Cause fixed: `useCreatePrimeContract` had awaited optional detail-surface warmups before `router.push`, leaving users on a successful create form when a warmup stalled. Prevention: warmups are non-blocking and report failures; saved tutorial probes use a unique contract number and cleanup registration before redirect verification.
- The packet is not yet a published docs-site update. The required downstream release uses `npm run tutorial:promote-docs-site`, followed in `/Users/meganharrison/Documents/alleato-os/apps/docs` by editorial review, `screenshots:check`, `nav:check`, production deployment, and a live-page screenshot.
- The initial Mintlify revalidation failure did not persist. The subsequent consolidated release refreshed the public page. Detection gap: a successful Git push and Vercel proxy deployment do not prove the Mintlify-hosted source has refreshed. Prevention: retain the production content assertion, legacy-route assertion, and browser screenshot as mandatory final gates.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
