# Negative-path proof

The rolled-back live verifier establishes all of the following under an actual
authenticated JWT principal:

- The principal resolves to an active internal `people` record.
- The principal is not an app administrator.
- The principal has no active Finance Business Area membership.
- A temporary active Finance project membership is inserted and
  `current_is_project_member(finance_project_id)` must return true.
- Legacy unrestricted Meetings and Tasks are visible.
- Legacy Finance Meetings and Tasks are hidden.
- Rows carrying the Finance project plus an unrestricted direct Business Area
  are hidden.
- Changing the same active identity to `person_type='contact'` removes broad
  unrestricted legacy visibility.

Every fixture mutation runs inside `BEGIN`/`ROLLBACK`.
