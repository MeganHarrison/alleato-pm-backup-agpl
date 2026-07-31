# Negative-path proof

- Missing or malformed policy contracts raise
  `ALLEATO_BRAIN_DOCUMENT_POLICY_*`.
- The fixture refuses a missing internal non-admin prerequisite.
- The internal nonmember phase fails if Finance is readable, insertable,
  reachable by re-scope, or deletable.
- An inactive Finance membership must remain denied.
- A temporary active Finance membership must enable read, insert, update, and
  delete; otherwise the positive authorization path fails loudly.
- App-admin Finance CRUD is tested independently after the membership is made
  inactive, so either authorization alternative fails loudly on drift.
- The external phase fails if the identity can read, insert, update, or delete
  any Business Area document, even while its temporary Finance membership
  remains present inside the transaction.
- The unscoped regression phase fails unless the external identity can still
  read, insert, update, and delete rolled-back project-less legacy fixtures.
- The exact migration cannot be applied without
  `ALLEATO_BRAIN_APPLY=20260724100000`.
- All fixture rows and the temporary person-type change are inside
  `BEGIN`/`ROLLBACK`.
