# Database readback

- Migration version: `20260724100000`
- Linked remote ledger: PASS
- Policies: `document_metadata_business_area_internal_guard` and
  `document_metadata_restricted_business_area_guard`
- Mode: `RESTRICTIVE`
- Command: `ALL`
- Role: `authenticated`
- Internal `USING` / `WITH CHECK`: require
  `current_is_active_internal_employee()` when `business_area_id` is non-null
- Restricted `USING` / `WITH CHECK`: require active Business Area membership
  or app-admin status for restricted rows

Observed rolled-back fixture:

```text
Alleato Brain document authorization passed: internal open-branch CRUD
succeeded; Finance nonmember and inactive-member access were denied;
active-member and app-admin Finance CRUD succeeded independently; the same
externalized identity was denied Business Area CRUD while unscoped legacy CRUD
remained available; all fixture mutations rolled back.
```
