# Alleato Brain document-read verification

Migration `20260724100000` adds an active-internal restrictive `ALL` policy and
upgrades the restricted-area guard from `SELECT` to `ALL`. A row with
`business_area_id` remains subject to every existing permissive policy,
additionally requires `current_is_active_internal_employee()`, and—when its
branch is restricted—requires membership or app-admin status for both `USING`
and `WITH CHECK`.

The exact migration compiled live and rolled back, was applied through the
guarded verifier, and appears in the linked remote ledger.

The live authorization fixture selected an actual authenticated internal
non-admin without Finance membership. That principal completed open-branch
CRUD and was denied Finance read, insert, re-scope, and delete. An inactive
membership remained denied; activating it enabled Finance CRUD. The membership
was then made inactive and rolled-back app-admin status independently enabled
Finance CRUD. The same identity was changed to `person_type='contact'` and was
denied every Business Area operation. Unscoped legacy read/insert/update/delete
remained available. Every fixture and identity mutation rolled back.
