# Independent review: hidden project portfolio visibility

Reviewer: Codex independent reviewer (`/root/hidden_project_review`)

Reviewed: 2026-07-30

Decision: APPROVED

## Findings

- The portfolio API adds `phase.is.null,phase.neq.Hidden` for every caller except Megan's primary owner identity.
- Brandon remains an owner for ordinary portfolio access but does not bypass the Hidden-phase rule.
- Legacy `NULL` phases remain visible.
- The change is deliberately portfolio-only. Existing AI guardrails and scoped project tools retain their pre-existing membership/admin scope, so active linked data remains available.

## Residual risk

Direct-project and AI scope remain governed by their existing permission model. This task changes the employee-facing portfolio list, not those broader access boundaries.
