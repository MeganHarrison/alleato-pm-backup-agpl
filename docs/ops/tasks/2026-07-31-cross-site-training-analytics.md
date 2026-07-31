# Task: Privacy-Safe Cross-Site Training Analytics

Status: Blocked/Deferred
Owner: SDOCS0731
Created: 2026-07-31
Task ID: DOCSANALYTICS0731
Linear Issue: Not requested; this is a delegated local implementation task.
Related Handoff: Coordinator task `019fb93d-9099-7313-8df7-f78c6a09ae55`

## Objective

Attribute Mintlify-hosted training-video engagement to the signed-in Alleato product user without exposing application cookies, passwords, raw PII, or a durable cross-site credential.

## Scope

- Product-owned short-lived assertion issuance, docs progress ingestion, and existing analytics integration.
- Mintlify-owned global video tracker and canonical video annotations.
- Explicit exclusion: sharing Supabase sessions/cookies with the docs origin, page-level browsing surveillance, or introducing a second analytics database.

## Source of Truth

- Canonical runtime/data owner: `learning_content_progress`, `learning_event`, and `record_video_learning_progress` in the Project Management Supabase schema.
- Existing shared primitives/services: `frontend/src/components/analytics/tracked-video-player.tsx`, `frontend/src/lib/analytics/video-tracking.ts`, and `frontend/src/app/api/admin/analytics/route.ts`.
- Public docs owner: `The-Alleato-Group/alleato-docs-site`, `apps/docs/`, hosted by Mintlify at `docs.alleatogroup.com`.
- Deprecated or parallel paths: direct anonymous docs video playback remains supported but is intentionally unattributed.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] A signed-in product user can open the docs through an attributed link without exposing an app session cookie to the docs origin.
- [x] The assertion is opaque, purpose-scoped, audience-bound, lesson-bound, expires within 30 minutes, and is rejected when malformed, expired, or issued for another audience.
- [x] The docs tracker removes the assertion from the URL immediately, retains it only in page memory, and sends only the canonical source ID plus bounded progress fields.
- [x] The product ingestion route accepts only the canonical docs origin and writes through the existing canonical progress RPC.
- [x] Existing admin analytics reads the resulting progress without a parallel reporting path.
- [x] Anonymous/direct docs visits remain functional and produce no attributable events.
- [x] Failure-loudly behavior is defined and covered by focused tests.
- [x] Relevant existing guardrails are identified before implementation.

## Implementation Checklist

- [x] Files/modules to change were listed and leased before edits.
- [x] Shared assertion and event-contract abstractions own cross-cutting behavior.
- [x] Errors are specific and actionable without leaking assertion contents.
- [x] Authentication, audience, expiry, origin, payload, catalog, and lesson-binding contracts are enforced.

## Integration and Verification

- [x] Focused assertion, route, and browser-script tests pass.
- [x] Route guardrails and targeted lint pass.
- [ ] Production end-to-end proof shows an attributed progress event reaches the existing reporting boundary.
- [ ] Mintlify deployment and rendered live routes are verified after publication.
- [x] Final local product/docs screenshots are captured after the last source change.
- [x] Independent security review is recorded.
- [ ] Task-owned files are published and each repository's local `HEAD` equals `origin/main` for the published revision.

## Failure-Loudly Contract

- Cause surfaced as: specific 401/403/422 API envelopes for missing, expired, wrong-audience, wrong-origin, malformed, or uncataloged events; docs console error includes the request ID but never the assertion.
- Detection path: focused unit/route tests, browser network response, product API telemetry, and admin analytics readback.
- Recovery path: reopen documentation from the authenticated product link for a fresh assertion; correct the catalog source ID or approved origin when those contracts fail.

## Incident Learning

- Failure fingerprint: `exact-file publication from a divergent shared-file base`
- Root cause: The first remote-main publication copied whole shared files from a locally older base. That would have removed the existing engagement-summary adapter and Procurement Log navigation entry even though the task diff against local `HEAD` looked scoped.
- Detection gap: Pre-publication checks compared against local `HEAD`, not the current remote parent, so concurrent remote edits inside task-owned shared files were invisible.
- Prevention: Diff every shared task-owned file against current `origin/main` before publication, preserve the remote implementation as the base, and generate inventory files from a clean remote worktree when the canonical checkout contains unrelated routes.
- Guardrail evidence: Post-publication `d122a5da9^..d122a5da9` readback found the collision; the correction restores both remote-owned features, preserves the existing UUID/slug guardrail, and regenerates project/system maps from the published remote tree.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | High-risk contract captured before implementation. |
| Supabase type refresh | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Blocked | Configured CLI token has legacy/invalid format; repository types were restored unchanged and contain the required tables/RPC. |
| Focused regression tests | `npm run test:unit -- --runInBand --runTestsByPath ...` | Pass | 5 suites and 16 tests passed, including assertion, CORS, catalog, cross-lesson rejection, and UUID/slug lookup coverage. |
| Targeted lint | `npx eslint <task-owned TypeScript files>` | Pass | No diagnostics. |
| Task-scope TypeScript | `node scripts/run-typecheck-bounded.mjs` filtered to task paths | Pass | Independent verifier found no task-scope diagnostics. The repository-wide command still fails on unrelated existing debt. |
| Route guardrails | Manual target-equivalent structured-route inspection | Pass | Both routes use the guardrail wrapper and no raw error responses. The official changed-route runner is Windows-broken and excludes untracked routes. |
| Docs script syntax | `node --check apps/docs/training-analytics.js` | Pass | Global tracker syntax is valid. |
| Docs link/nav | `npm run nav:check` | Unrelated failure | Existing `docs.json` drift predates this change; neither changed page owns navigation. |
| Docs broken links | `npx --yes mintlify@latest broken-links` | Unrelated failure | Existing 3,355-link debt across 58 files; neither changed page was reported. |
| Product route | `http://localhost:3037/training/content/docs-create-prime-contract-walkthrough` | Pass | Authenticated page rendered the canonical video and attributed docs link. |
| Product screenshot | `tests/agent-browser-runs/2026-07-31-cross-site-training-analytics/product-training-docs-link-desktop.png` | Pass | Authenticated final-route desktop proof. |
| Attributed-link screenshot | `tests/agent-browser-runs/2026-07-31-cross-site-training-analytics/product-training-attributed-link-desktop.png` | Pass | Shows the final documentation-source action under the training video. |
| Docs screenshots | `tests/agent-browser-runs/2026-07-31-cross-site-training-analytics/prime-contract-docs-desktop.png`, `owner-invoice-docs-desktop.png` | Pass | Mintlify local pages rendered one tagged video each; fake assertion fragments were removed immediately. |
| Independent privacy review | Reviewer `privacy_review` | Pass | Audience/origin/lesson-binding concerns cleared. Residual same-lesson replay risk is low severity. |
| Vercel assertion secret | `vercel env add` plus `vercel env ls` readback | Pass | Secure random sensitive value configured for Production; value was not printed. |
| Remote-parent reconciliation | `git diff d122a5da9^ d122a5da9 -- <shared files>` | Repaired | Detected and corrected concurrent-file overwrites before production activation; existing engagement analytics and Procurement Log remain owned by their remote implementation. |
| Local cross-site ingestion | Product-issued assertion plus `Origin: https://docs.alleatogroup.com` POST to `http://localhost:3037/api/engagement/docs/progress` | Pass | Returned `200`, `accepted: true`, checkpoint `0`, and the canonical CORS origin without sending app cookies. |
| Canonical analytics readback | Service-role read of the latest `learning_content_progress` row for `prime-contracts/create-a-prime-contract` | Pass | Row exists, checkpoint/position are `0`, watch seconds increased, and `last_viewed_at` is current; no learner PII was printed. |
| Docs repository publication | `The-Alleato-Group/alleato-docs-site@0a97e63` | Pass | GitHub main and its Vercel proxy status are current. |
| Mintlify rendered-copy readback | `https://docs.alleatogroup.com/prime-contracts/create-a-prime-contract#alleato_training_assertion=fake-opaque-token` | Blocked | Live Mintlify still retains the fragment and renders no `data-alleato-source-id`, proving Mintlify has not consumed commit `0a97e63`. |
| Product production deployment | Vercel deployment `dpl_FGy33pEbPTrY6zZgkHjEmPDWswZN` | Blocked | Corrected `origin/main` revision is queued with zero build duration; the production domain still routes OPTIONS to the old 404 surface. |

## Remaining Risk

- A stolen assertion can be replayed for the same learner and same lesson during its 30-minute validity window. It cannot cross users, lessons, origins, or audiences. Add per-event idempotency if stricter engagement-integrity guarantees become necessary.
- The official changed-route guardrail runner is not portable to PowerShell and misses untracked routes. Manual target-equivalent inspection passed; the shared runner remains unrelated guardrail debt.
- Mintlify activation is blocked outside the checked-out repositories. A Mintlify administrator must confirm the GitHub App is authorized for `The-Alleato-Group/alleato-docs-site`, branch `main`, monorepo path `apps/docs`, then trigger/resume the pending sync. The success condition is that the live fragment disappears and the video exposes the canonical `data-alleato-source-id`.
- Vercel activation is provider-queued rather than code-blocked. The smallest recovery action is to let or resume deployment `dpl_FGy33pEbPTrY6zZgkHjEmPDWswZN`; after it reaches Ready, verify the production OPTIONS CORS headers and one real attributed event.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.

Blocked cause: Mintlify has not pulled the published docs revision, and the corrected Vercel production deployment remains queued.

Detection gap: A successful GitHub push and Ready docs Vercel proxy status did not prove Mintlify content synchronization; a queued product deployment did not prove the production route existed.

Prevention step: keep the live fragment-removal/data-attribute readback and production OPTIONS/readback as mandatory release gates.

Next owner action: Mintlify admin reconnects or resumes the repository sync; Vercel team resumes the queued corrected deployment if it does not start automatically. Then rerun the two live readbacks and the production attributed event.
