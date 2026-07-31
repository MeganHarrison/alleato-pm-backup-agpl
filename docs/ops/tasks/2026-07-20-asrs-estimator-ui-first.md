# Task: Build UI-First ASRS Estimator

Status: Pending Review
Owner: Codex S201
Created: 2026-07-20
Task ID: AAI-1203
Linear Issue: [AAI-1203](https://linear.app/megankharrison/issue/AAI-1203/build-ui-first-asrs-estimator-with-pending-review-results)
Related Handoff: `docs/ops/handoffs/2026-07-20-S201-asrs-estimator-ui-first.md`

## Objective

Add a working Estimator tab to the canonical `/fm-global` experience so users can evaluate the currently supported FMDS Batch 1 rules now while unsupported or unverified outputs remain visible as Pending Review.

## Scope

- Owned UI: Estimator tab and responsive form/result workflow within the existing FM Global dashboard.
- Owned server contract: authenticated API route and typed server-only adapter for the dedicated ASRS `evaluate_fmds_batch1_rules` RPC.
- Owned rules: current Batch 1 hose demand, transverse-flue, obstruction, adequacy/escalation, and vertical-barrier evaluation.
- Explicit exclusions: corpus activation, review-state writes, AI chat, storage of user scenarios, full sprinkler-head-count logic, and unsupported FMDS engineering inference.

## Source of Truth

- Canonical runtime/data owner: dedicated ASRS Supabase project `vqnnvpnoitqhijkztyhq`, service-only RPC `public.evaluate_fmds_batch1_rules`.
- Existing shared primitives/services: `PageShell`, `PageTabs`, shared form controls, `StatusBadge`, `withApiGuardrails`, `getApiRouteUser`, and a shared server-only ASRS REST boundary.
- Deprecated or parallel paths: PM APP legacy FM/ASRS lookup tables and any direct browser access to the ASRS service key.

Verification contract: Required

## Attention Brief

- Primary user: ASRS estimator or engineer assembling an initial configuration.
- Primary job: enter known configuration values and identify applicable FMDS requirements.
- Primary decision: which outputs are verified now and which still require source review.
- Tier 1: configuration inputs, Evaluate action, verified versus Pending Review status.
- Tier 2: deterministic result values and exact source citations.
- Tier 3: missing-input and unsupported-capability explanations.
- Hide until requested: extraction confidence, review-event IDs, raw JSON, and implementation metadata.
- Remove: summary cards, dashboard metrics, decorative panels, duplicate actions, and review diagnostics.
- Primary action: Evaluate.
- Failure-loudly behavior: preserve inputs and name the exact authentication, configuration, RPC, validation, or unsupported-rule failure.

## Workflow Map

- User action: complete the estimator fields and select Evaluate.
- Frontend owner: `frontend/src/app/(main)/fm-global/asrs-estimator.tsx` integrated through `fm-global-dashboard-client.tsx`.
- Shared primitives: existing page tabs, buttons, inputs, selects, labels, status display, and open page sections.
- Client state: input draft, submitting state, result, and actionable error.
- API route: `POST /api/fm-global/estimator/evaluate`.
- Validation: shared Zod request schema and typed result parser.
- Server helper: server-only ASRS evaluator adapter.
- Supabase owner: `evaluate_fmds_batch1_rules(uuid,jsonb)` and staging revision readback.
- Side effects: read-only evaluation; no persistence and no activation.
- Expected success evidence: verified Batch 1 outputs with citations plus Pending Review rows for unsupported capabilities.
- Expected failure behavior: input remains intact and a specific recovery message is shown.

## Acceptance Criteria

- [x] Users can open the Estimator tab, enter a supported configuration, and receive deterministic results.
- [x] Verified outputs show value, unit, status, and source citation.
- [x] Unsupported or not-yet-reviewed outputs remain visible as Pending Review with the exact missing rule/input.
- [x] No client bundle or response exposes the ASRS service credential.
- [x] Authentication, validation, configuration, database, and unsupported-rule failures are specific and actionable.
- [x] The April 2026 revision remains staging and no active retrieval chunks are created.
- [x] The workflow works without horizontal overflow at desktop and mobile sizes.

## Implementation Checklist

- [x] Attempt dedicated type generation, confirm the live RPC contract, and define an explicit typed boundary when the generation endpoint rejects the current credential.
- [x] Add a shared typed estimator request/result contract.
- [x] Add an authenticated, server-only evaluation route using the shared ASRS REST boundary.
- [x] Reuse the existing dashboard tabs and shared form/status primitives for the estimator UI.
- [x] Add focused contract, route, citation, and realtime regression tests.
- [x] Post kickoff, milestone, evidence, and handoff comments to AAI-1203.

## Integration and Verification

- [x] Targeted Jest and ESLint checks pass.
- [x] Route guardrails and doctrine complexity audit pass.
- [x] Live RPC readback proves the same result shown by the API/UI.
- [x] Authenticated browser flow is verified at desktop and mobile widths.
- [x] Viewable screenshots are attached to AAI-1203.
- [x] Task-owned files are published to `origin/feat/asrs-intelligence` and the implementation commit equals the remote branch.

## Failure-Loudly Contract

- Cause surfaced as: expired authentication, invalid field/value, missing ASRS server configuration, failed RPC, missing reviewed rule, unsupported input combination, or incomplete FMDS coverage.
- Detection path: route response, inline form error, result status, focused tests, live readback, and canonical-route browser replay.
- Recovery path: correct the named input/configuration or continue with the result explicitly marked Pending Review; never invent a requirement.

## Incident Learning

- Failure fingerprint: authenticated pages crashed with `cannot add postgres_changes callbacks ... after subscribe()`.
- Root cause: the browser Supabase client is a singleton and its realtime client returns an existing channel for a duplicate topic; multiple `useCollaborationNotifications` instances reused `notifications:{userId}` and the second instance attempted to add a callback after the first subscribed.
- Detection gap: the shared hook had no regression assertion that independently mounted consumers receive distinct channel topics.
- Prevention: every hook instance now derives a stable unique channel topic and removes that channel during cleanup; a focused regression test asserts the uniqueness contract.
- Guardrail evidence: authenticated browser replay loads `/fm-global`; focused notification-channel test passes.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | AAI-1203, this task file, and S201 handoff | Pass | UI-first scope, safety boundary, workflow map, and done gate recorded before product edits. |
| Dedicated type gate | `npx supabase gen types typescript --project-id vqnnvpnoitqhijkztyhq --schema public` | Credential blocked; safely handled | Supabase returned insufficient privileges. Live `psql` introspection confirmed `evaluate_fmds_batch1_rules(uuid,jsonb) -> jsonb`; the route uses an explicit typed request/result boundary and server-only REST helper rather than an untyped RPC cast. |
| Focused tests | `npx jest --runInBand --silent --runTestsByPath ...` | Pass | 4 suites, 9 tests: estimator contract, adapter, API route, citation display, and realtime channel regression. |
| Focused lint and design | Targeted ESLint; `design:no-new-form-violations`; `design:no-new-disables`; `design:ratchet` | Pass | No new lint/form/disable debt; design count remains below baseline. |
| Route safety | `npm run check:routes`; `GUARDRAIL_ENFORCE_RAW_ERRORS=true node scripts/check-changed-route-guardrails.mjs` | Pass | No route conflicts; 2 changed API routes use structured guardrails and no raw error response. |
| Live evaluator readback | Dedicated ASRS `psql` evaluation for 12 standard-coverage sprinklers, 1.5 in. net width, 11 ft distance | Pass | Staging; 250 gpm; 60 min; 1.5 in. qualifies; >10 ft requires in-rack sprinklers; 0 chunks under an active revision. |
| Desktop browser proof | `docs/ops/evidence/2026-07-20-asrs-estimator-ui-first/asrs-estimator-desktop-top.png` | Pass | Canonical `/fm-global` route shows Verified and Pending Review requirements together. Attached to AAI-1203. |
| Mobile browser proof | `docs/ops/evidence/2026-07-20-asrs-estimator-ui-first/asrs-estimator-mobile-results.png` | Pass | 390 px viewport and 390 px document width; no horizontal document overflow. Attached to AAI-1203. |
| Broad TypeScript check | `npx tsc --noEmit --pretty false` | Inconclusive, unrelated repo constraint | Full-project check exhausted the 4 GB Node heap before producing diagnostics. Focused Jest, ESLint, browser compilation, and route checks all pass; no task-owned type error surfaced. |
| Broad changed-quality wrapper | `npm --prefix frontend run quality:changed` | Inconclusive, unrelated branch debt | The unsafe-pattern checker flagged wording in pre-existing committed `frontend/src/lib/schemas/fm-global-vocabulary.unit.test.ts`; task-owned unsafe-pattern and route checks pass. |
| Publication | `git push origin feat/asrs-intelligence`; local/remote readback | Pass | Implementation published at `0f2bf87ac`; AAI-1203 is In Review with final handoff comment `05eb36bf-4922-4985-a81d-b03d8295aa93`. |

## Remaining Risk

- The initial estimator cannot calculate sprinkler-head counts, complete configurations, or full FMDS compliance until later reviewed tables and figures extend the typed evaluator. Owner: ASRS corpus review workstream. Next action: promote each reviewed rule into the existing result contract without redesigning the UI.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning records the runtime blocker, confirmed cause, repair, and regression guardrail.
- [x] Deferred full-coverage work names its cause, owner, prevention, and next action.
