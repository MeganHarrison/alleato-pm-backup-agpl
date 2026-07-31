# Business Area helper grant verification

Verified 2026-07-24 against PM APP `lgveqfnpkxvzbnnwuled`.

| Check | Result |
| --- | --- |
| Live types gate | Business Area tables and foreign keys present |
| Baseline effective privilege | `anon_execute=true` |
| Migration apply | `20260724052000_revoke_anon_business_area_helper.sql` applied successfully |
| Remote ledger | `20260724052000` present in Local and Remote verification |
| Effective privilege after apply | anon false; authenticated true; service role true |
| Complete exact-signature ACL | `authenticated`, `postgres`, `service_role` |
| Cross-database verifier | PASS at `2026-07-24T05:15:09.033Z` |

The exact drift repair preceding the final verifier changed one Outlook Finance
document in PM APP and its matching AI Database document/chunk. The PM APP row
now has Business Area `3` and `access_level='restricted'`.
