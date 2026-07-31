# AAI-1150 independent review

Decision: BLOCKED — original approval superseded by the production forensic audit below
Reviewer: `ai_ownership_audit_review`
Reviewed at: 2026-07-22T20:52:00Z

The reviewer found no task-related blocker and verified:

- route-owned full and Ask Alleato capabilities and conversation namespaces;
- exact-input signed approval with fail-closed secret resolution;
- read-only MCP filtering and approval of runtime-discovered artifact writes on writable surfaces;
- removal of the direct confirmed-text bypass;
- runtime-version skew detection between the server and `@ai-sdk/react`;
- no silent approval or capability fallback in the changed path.

Reviewer checks passed:

- installed AI SDK roundtrip, 6/6;
- focused approval seam, policy, MCP, compact client, and surface tests, 5 suites / 20 tests.

## First production route-limit remediation re-review — superseded

Decision at review time: APPROVED
Reviewed at: 2026-07-22T21:25:00Z

The reviewer first rejected the remediation because the generated map, AI architecture
contract, and search source comment still claimed that `findAppPage` covered every
source route. After rework, the reviewer approved the complete slice and verified:

- all newly excluded pages are genuine demo, prototype, gallery, test, or reference surfaces;
- no canonical product or AI route is excluded;
- `findAppPage` now truthfully searches the production route subset and all AI tools;
- the generator derives that index from the same non-production manifest used by the build;
- the guard fails closed for manifest drift, duplicates, route-budget overflow, index leakage, and stale build state;
- `npm run verify:nonprod-routes` passed at 52 excluded files and 1,103 / 1,103 production source-route files.

Production deployment `dpl_56dekTjHfE2HQsJ1ZMgWXqVc3EhB` later falsified the route-count premise: it still produced 2,060 generated routes. The exclusions remain legitimate production hygiene, but this approval is not evidence that they solved the Vercel limit. A new independent review is required for the dynamic-boundary consolidation.

## Dynamic-boundary consolidation review

Decision: APPROVED
Reviewed at: 2026-07-22T22:07:29Z

The first review rejected the candidate because the focused schedule script still named deleted tests, the local route inventory still advertised deleted routes, and a lint-driven heading change removed semantic heading behavior. All three were repaired and re-reviewed:

- `test:schedule:focused` now owns the consolidated reports/resources suites and passes 10 suites / 42 tests;
- the regenerated route inventory contains only the canonical Schedule page plus consolidated `reports` and `resources` APIs;
- shared `SectionRuleHeading` has additive semantic heading support, and the risk summary's existing accessibility assertion passes;
- the canonical Schedule page retains resource availability, lookahead, risk, and trade activity, so the removed duplicate route drops no user capability;
- report/resource authorization and fail-loud validation are preserved;
- the route budget counts dynamic source boundaries and explicitly labels static exclusions as hygiene, not provider-limit relief.

No task-related blocker remains in the reviewed candidate. Production deployment remains the authoritative route-count proof.

## Production forensic ownership audit review

Audit package decision: APPROVED

Product/task decision: BLOCKED

Reviewed at: 2026-07-22T22:50:46Z

The reviewer verified the exact isolated worktree at production/source commit
`b9fd86668ed9a55f5a9f9e04752619e03c665da8` and found no remaining correctness
or overclaim issue in the ownership audit, production readback, or six browser
artifacts.

Verified current blockers:

- the direct CMO path writes product tables before the shared signed approval boundary;
- the delegated Microsoft catalog retains mutation/delivery tools outside that boundary;
- the deterministic RFI preview is not the immutable input to the later signed write;
- cancellation re-enters the RFI creation preview and approval auto-resume corrupts durable history state.

The first review rejected stale task language that still checked the broad
mutation-perimeter acceptance criterion, overstated the architecture verifier's
scope, and described pre-fix `needsApproval`/compact-client failures as current.
Those claims were corrected: the broad criterion is open, the verifier is a
scoped pass, and the old failures are labeled a superseded baseline.

The deletion and consolidation plan is approved as the correct direction. This
is approval of the audit's accuracy, not approval to mark AAI-1150 complete.
