# Negative-Path Evidence

- Blank or shorter-than-10-character rejection feedback returns a structured
  invalid-payload response before state mutation.
- If corrective learning activation fails after rejection is saved, the API
  returns a specific 502 and the Rejected queue retains the notes and Retry
  teaching action.
- If activation succeeds but destination linking fails, the response says the
  learning was activated but the review record could not be linked.
- If audit-event recording fails after activation and linking succeed, the API
  returns 200 with `auditWarning`; the client displays a warning rather than a
  false “teaching failed” error.
- A missing creator directory link or Project Admin template fails project
  creation before leaving an inaccessible project.
- The original project-role RLS violation was reproduced before the migration;
  the same verifier passes after the remote migration.
- The full financial Playwright chain reports its repeatable dev-server
  `ERR_NETWORK_CHANGED` blocker and does not count skipped steps as passes.
