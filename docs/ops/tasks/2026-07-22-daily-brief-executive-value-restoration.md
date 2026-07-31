# Task: Restore Executive Value to the Daily Brief

Status: Complete
Owner: SROOT-DAILY-BRIEF
Created: 2026-07-22
Task ID: daily-brief-executive-value-restoration-20260722
Linear Issue: Not required for this single-session Standard change.
Related Handoff: N/A

## Objective

Make `/daily-brief` present the current packet's executive assessment, direct actions, project analysis, cross-portfolio intelligence, opportunities, and evidence gaps instead of reducing the report to a decision-only queue.

## Scope

- Daily Brief view-model narrative contract, landing-page composition, scoped editorial styles, and focused regression coverage.
- Daily Brief design-system evidence and running design-audit entry.
- Excludes packet generation, source ingestion, the durable `/daily-briefs/[briefId]` artifact reader, and executive-attention persistence behavior.

## Source of Truth

- Canonical runtime/data owner: `intelligence_packets.packet_json.briefMarkdown`, mapped by `frontend/src/lib/daily-briefs/canonical-packets.ts`.
- Existing shared primitives/services: `BriefMarkdown`, `Button`, `ExecutiveAttentionWorkflow`, `GovernedExecutiveArtifactStatus`, and `PageShell`.
- Deprecated or parallel paths: the decision-only composition introduced in `executive-brief-view.tsx`; the artifact detail route remains the complete durable reader.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The current brief's executive assessment is visible without opening a disclosure.
- [x] Direct recommended actions, commitments, project analysis, portfolio patterns, opportunities, risks, prevention systems, and evidence gaps remain visible and citation-aware.
- [x] Governed decisions retain evidence links and the working assign-follow-through action without repeating internal workflow copy on every item.
- [x] The complete persisted report remains one click away on `/daily-briefs/[briefId]`.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are not changed.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Authenticated desktop and mobile route proof shows the restored information hierarchy.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact check and likely owner boundary.
- [x] Task-owned files are published through the exact-file remote publisher; shared-checkout divergence is documented as unrelated.

## Failure-Loudly Contract

- Cause surfaced as: a focused contract test fails if the landing view stops rendering canonical narrative sections through `BriefMarkdown`.
- Detection path: targeted Daily Brief view-model and presentation-contract tests plus authenticated route screenshots.
- Recovery path: restore the `narrativeSections` view-model projection and the landing-page narrative renderer; do not substitute a truncated database summary.

## Incident Learning

- Failure fingerprint: `design.daily-brief-decision-only-value-loss`
- Root cause: the landing composition intentionally demoted the complete executive narrative and rendered only five decision questions, despite the canonical packet and view model retaining substantially richer analysis.
- Detection gap: tests verified decision extraction and route ownership but did not assert that the landing composition exposed the packet's canonical narrative sections.
- Prevention: project every persisted report section into a typed narrative contract and guard that the landing view renders it through the shared citation-aware Markdown renderer.
- Guardrail evidence: focused view-model and presentation-contract tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Production observation | Authenticated `/daily-brief` and `/daily-briefs/c1474a3d-d6cd-4741-b2e5-c24bfc061240` | Fail before change | Landing view showed five question cards while the packet artifact contained the full executive report. |
| Focused unit and contract tests | `npm run test:unit -- --runInBand --runTestsByPath 'src/app/(main)/executive/intelligence-brief/__tests__/executive-brief-view-contract.test.ts' src/lib/daily-briefs/brief-view-model.unit.test.ts` | Pass | 2 suites and 27 tests passed; the presentation contract requires canonical narrative sections and `BriefMarkdown`. |
| Targeted lint | `npm exec eslint -- <Daily Brief changed files>` | Pass | No lint findings in task-owned TypeScript files. |
| TypeScript | `npm run typecheck` | Pass | Full frontend typecheck passed in delegated verification. |
| Route and delivery guardrails | `npm run codex:finish -- --session SROOT-DAILY-BRIEF --delivery-lane standard --task-file docs/ops/tasks/2026-07-22-daily-brief-executive-value-restoration.md --quality-profile changed` | Pass | No new lint, `any`, unsafe-pattern, or route-ownership debt. |
| Auth preflight | `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm exec playwright -- test tests/auth.setup.ts --config=config/playwright/playwright.config.ts --project=setup` and `npm run verify:browser-auth -- --base-url http://localhost:3000 --route /daily-brief --session daily-brief-value` | Pass | Authenticated route access verified before production proof. |
| Production deployment | [Vercel deployment `54a8678`](https://project-management-agent-p4fxjm6ha-the-alleato-group.vercel.app) | Pass | Production deployment is Ready, contains guard commit `74133d6`, and owns the `projects.alleatogroup.com` alias. |
| Authenticated production desktop | `https://projects.alleatogroup.com/daily-brief` in signed-in Chrome | Pass | Executive read, 25 named actions, five governed decisions, all narrative sections, evidence links, and the complete-source link render on the canonical route. |
| Authenticated production mobile | Chrome viewport `390x844` on canonical route | Pass | No horizontal overflow; executive read, source link, actions, decision follow-through, and evidence gaps remain available. |
| Browser console | Production Chrome error log before and after deployment | Unrelated existing debt | React hydration warning `#418` was present on the old bundle before this release and remains in the shared application/browser-extension boundary; no Daily Brief render failure or task-owned stack was observed. |
| Publication | Commits `be16750b` and `74133d6` | Pass | Implementation and source-level regression guard were published to `main` with exact-file compare-and-swap. |

## Remaining Risk

- No remaining risk in the requested Daily Brief presentation boundary. Packet-generation quality remains owned by the existing intelligence pipeline; the pre-existing shared-shell hydration warning should be handled as separate platform debt.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
