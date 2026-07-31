# Second independent high-risk review

Result: **Needs Rework**

Closed from the initial review:

- Anonymous file/Finance bypass
- Exact named typed-target rejection
- Operational index-definition verification
- Written dormant-schema rollback contract

Remaining findings:

- Ledger constraints and idempotency needed exact table, type, column,
  reference, delete-action, and expression contracts instead of name-only
  checks.
- Effective Finance and anonymous behavior needed rolled-back meeting and task
  fixtures in addition to files.
- The manifest overclaimed future Phase 2 run-scoped restoration and
  count-mismatch behavior.

Disposition:

- Migration and verifier now assert exact ledger columns and constraints.
- Meeting and task ACLs/policies are authenticated-only and tested with
  rolled-back Finance and unrestricted fixtures.
- Anonymous reads are tested across files, meetings, and tasks.
- The manifest now claims only transactional Phase 1B rollback behavior.

No revised migration had been applied when this review ran.
