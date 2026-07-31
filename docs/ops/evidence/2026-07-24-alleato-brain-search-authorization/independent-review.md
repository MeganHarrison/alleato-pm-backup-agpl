# Independent review — Alleato Brain search authorization

Reviewer: `/root/brain_search_review`
Reviewed: 2026-07-24
Decision: APPROVED

## Review history

The reviewer found and required correction of three end-to-end authorization
gaps:

1. Dedicated indexed email and Teams callers still stopped non-admins before
   the new branch authorization boundary.
2. Removing those wrapper gates initially widened otherwise-authorized project
   communications.
3. Generic `microsoft_graph` source types could bypass communication
   classification when the authoritative document category was email or Teams.

The final implementation:

- lets authorized users reach indexed Business Area email and Teams content;
- keeps live Graph and project-only communications restricted;
- uses document category as the authoritative communication classifier;
- rejects Finance with zero memberships and malformed branch labels;
- makes scope-query errors explicit.

Independent result: APPROVED with no remaining blocking correctness, security,
or regression findings.

Reviewer verification:

- core focused tests: 15/15 passed;
- caller reachability tests: 2/2 passed.

Residual non-blocking risk: caller reachability is structurally tested, while
the underlying authorization behavior has runtime coverage in the focused
guardrail and source-specific suites.
