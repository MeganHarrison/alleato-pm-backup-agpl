# CRM production negative-path evidence

- An unauthenticated request to the CRM workspace API returns HTTP 401 with `AUTH_EXPIRED`.
- CRM mutation handlers return permission, validation, concurrency, and dependency messages to the user instead of showing success.
- Conversion retries use a stable attempt identifier that is owner/deal validated and unique at the Projects table, preventing duplicate project creation.
- Communication candidates are inserted and prior pending versions are superseded in one database transaction.
