# Action Log

- Reproduced the authorization decision with Andrew Cannon's live authenticated identity.
- Confirmed Andrew is a non-admin active member of Avita project 1149.
- Confirmed `user_can_access_entity('subcontract', SC-001)` returned false while the supported `commitment` path returned true.
- Applied `20260729235959_fix_subcontract_documents_rls.sql` to the linked PM APP database.
- Registered migration version `20260729235959` as applied and confirmed local/remote ledger parity for that version.
- Read back all four policies and confirmed their role, command, `USING`, and `WITH CHECK` expressions.
- Inserted one junction link under Andrew's authenticated session to exercise the actual failing RLS boundary.
- Removed the verification link and confirmed zero matching rows remained.
