# CRM-native lead regression verification

Final focused checks:

- Jest: 6 suites passed; 17 tests passed.
- Linked production pgTAP: 38 assertions passed.
- Focused ESLint passed, including `react-hooks/exhaustive-deps` enforced as an error
  for the changed CRM and Tasks files.
- Scoped TypeScript verification reported no errors in changed files. The repository's
  full typecheck still contains unrelated pre-existing failures and is not represented
  as a full pass.
- `git diff --check` passed.
- The production route-budget guard passed at 654 dynamic files and 2042 generated
  routes after the lead detail screen was consolidated onto `/crm/leads?leadId=...`.
- Generated database types retain the authoritative scheduling cascade mutation and
  schedule-cost create, delete, and upsert RPC declarations.
