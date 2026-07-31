# Negative-path evidence

Command:

`ALLEATO_ENV_FILE=/home/friday/code/project-management/.env node scripts/database/verify-alleato-brain-search-scope.mjs --negative-path`

Result: PASS

- A request with both project and Business Area scope raised SQLSTATE `22023`
  with the exact XOR error.
- A nonpositive Business Area ID raised SQLSTATE `22023` with the exact
  validation error.
- A live Business Area 3 vector returned five results; every returned
  `doc_business_area_id` was exactly `3`.
- The pinned-project frontend test returned before branch authorization,
  embedding generation, or either RPC.
