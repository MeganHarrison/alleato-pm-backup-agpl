# Task: Alleato Brain Search Authorization

Status: In Progress
Owner: Codex (session SBRAINSEARCH)
Created: 2026-07-24
Task ID: ALL-11
Linear Issue:
[ALL-11](https://linear.app/alleato-group/issue/ALL-11/alleato-brain-phase-3-rewire-routing-permissions-and-ai-retrieval)
Related Handoff:
`docs/ops/handoffs/2026-07-24-SBRAINSEARCH-alleato-brain-search-authorization.md`

## Objective

Extend the canonical AI tool scope and document-chunk retrieval paths so
Business Area content is authorized by branch access, restricted Finance
content fails closed, and project-scoped searches cannot treat a migrated
legacy project label as current authorization.

## Workflow and Contract Map

- User action: ask Alleato AI for company or project knowledge.
- Frontend owner: operational read tools.
- Shared scope owner: `frontend/src/lib/ai/tools/guardrails.ts`.
- Retrieval owners:
  `frontend/src/lib/ai/tools/read/shared-search-helpers.ts` and
  `frontend/src/lib/ai/tools/read/rag-search-tools.ts`.
- Database reads: `business_areas`, `business_area_memberships`,
  `document_metadata`, and RAG `document_chunks`.
- Live type assumptions: Business Area IDs are bigint/TypeScript number;
  membership person IDs are UUID/string; chunk labels are JSON numbers.
- Success: a non-admin sees unrestricted branches plus restricted branches
  where actively authorized; a branch label takes precedence over a retained
  legacy project label.
- Failure: scope-query errors surface explicitly; unknown, malformed, or
  unauthorized branch labels are filtered.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Tool scope includes `allowedBusinessAreaIds`.
- [x] Admins receive all branches.
- [x] Non-admins receive every unrestricted branch plus only actively
      authorized restricted branches.
- [x] Finance remains inaccessible while it has zero approved memberships.
- [x] A branch-labeled chunk is authorized by branch scope, not its retained
      legacy `project_id`.
- [x] A project-filtered search excludes company-branch chunks even during
      dual-label comparison mode.
- [x] Branch-scoped email and Teams chunks are usable by authorized users
      without widening project communication access.
- [x] Scope-load failures and malformed labels fail loudly.

## Failure-Loudly Contract

- Cause surfaced as: a named Business Area scope-load error or an empty,
  permission-specific retrieval response.
- Detection path: focused guardrail/retrieval regressions, source-specific RAG
  verifier, independent review, and verification contract.
- Recovery path: stop returning the affected branch rows; never infer branch
  permission from a legacy project stamp or the service-role client.

## Incident Learning

- Failure fingerprint: N/A
- Context: new authorization boundary.
- Detection gap: project-only scope tests did not model dual-labeled branch
  chunks.
- Prevention: a shared exact-scope predicate and regressions for unrestricted,
  restricted, dual-labeled, project-pinned, and malformed records.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Contract captured before edits. |
| Focused authorization tests | `business-area-retrieval.test.ts` and `source-specific-rag.test.ts` | Pass | 15 tests cover scope, Finance, dual labels, malformed labels, generic Graph source classification, indexed communications, live-Graph separation, and loud DB failures. |
| Caller reachability | `business-area-communication-reachability.test.ts` | Pass | 2 tests keep live recent email admin-only while allowing indexed search to reach exact scope. |
| Static boundary | targeted ESLint and `npm --prefix frontend run typecheck:changed` | Pass | No lint findings or new `any` debt. |
| RAG contracts | `npm run rag:verify:source-specific` and `npm run rag:verify:chat-architecture` | Pass | Both architecture contracts pass. |
| Patch hygiene | `git diff --check` | Pass | No whitespace errors. |
| Independent review | `docs/ops/evidence/2026-07-24-alleato-brain-search-authorization/independent-review.md` | Approved | Three reachability/security findings were corrected; final review found no blocking issues. |

## Final Status

- [x] Acceptance criteria complete.
- [x] Focused tests and source-specific verifier pass.
- [x] Independent review and verification contract pass.
- [ ] Exact paths published to `origin/main`.
