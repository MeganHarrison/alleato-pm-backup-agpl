# Initial independent high-risk review

Result: **Needs Rework**

The review ran before live migration application. Its critical finding was
valid: the draft's restrictive guards were `TO PUBLIC` but looked up restriction
through `business_areas`, whose rows are not visible to `anon`. The legacy
permissive files policy could therefore still expose Finance rows.

Other findings:

- The verifier asserted policy names but not roles, commands, `WITH CHECK`,
  table ACLs, unexpected permissive policies, or effective RLS behavior.
- Typed-target negative tests accepted any check violation instead of requiring
  `project_attribution_rules_active_typed_target`.
- Index definitions and ledger constraints were not verified.
- The rollback and evidence contracts did not explicitly gate authorization or
  run-scoped reversal.

Disposition:

- No draft migration was deployed.
- Anonymous file reads are removed instead of relying on anonymous policy
  composition.
- Exact ACL/policy/index/constraint assertions and rolled-back RLS personas are
  added.
- The typed-target test now names the rejecting constraint.
- A dormant-schema and run-scoped rollback contract is recorded.

The revised version requires a second independent review before application.
