# Regression-test evidence

Command:

`cd frontend && npm.cmd run test:unit -- --runInBand --runTestsByPath src/lib/documents/__tests__/record-documents.unit.test.ts`

Result: PASS

- Test suites: 1 passed, 1 total.
- Tests: 12 passed, 12 total.
- Covers template normalization, current amount and retainage, forbidden legacy values, canonical job-number query, exclusive Client-to-Owner mapping, blank legal Owner rendering when Client is unset, prime-contract-independent Contractor identity and linked override behavior, Contract Company-to-Subcontractor mapping, address handling, missing required financial inputs, and required marker failures.

Additional checks:

- Focused ESLint: zero errors; six pre-existing `no-explicit-any` warnings.
- `git diff --check` on task-owned files: pass.
- Independent final review: no remaining actionable findings.
