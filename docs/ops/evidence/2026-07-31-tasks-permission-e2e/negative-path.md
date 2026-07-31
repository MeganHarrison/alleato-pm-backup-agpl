# Negative authorization paths

The focused route regression explicitly exercises both failure-loudly boundaries:

- An otherwise authenticated user without an email receives HTTP 401 with `AUTH_EXPIRED`; the task data owner is not called.
- A non-admin requesting `scope=all` receives HTTP 403 with `FORBIDDEN`.

These assertions prevent the service-owned repair from becoming a broad unscoped read.
