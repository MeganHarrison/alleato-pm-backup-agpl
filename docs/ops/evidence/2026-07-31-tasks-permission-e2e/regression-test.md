# Focused route regression

Command:

```text
NODE_PATH=/Users/meganharrison/Documents/alleato-pm-backup/frontend/node_modules /Users/meganharrison/Documents/alleato-pm-backup/frontend/node_modules/.bin/jest --runInBand src/app/api/tasks/__tests__/route.test.ts
```

Result: PASS — 1 suite, 3 tests.

Covered assertions:

- `scope=mine` calls `serviceDb.from("tasks")` and applies the authenticated assignee-email filter.
- Missing authenticated email returns typed `AUTH_EXPIRED` before a task query.
- `scope=all` returns typed `FORBIDDEN` for a non-admin.
