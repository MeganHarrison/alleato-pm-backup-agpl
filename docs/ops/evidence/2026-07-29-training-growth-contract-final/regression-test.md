# Training Growth Regression Tests

Date: 2026-07-29
Task ID: local-training-growth-contract-final

Focused suite:

`pnpm --dir frontend exec jest --runInBand --runTestsByPath src/features/training/__tests__/skill-growth.test.ts src/features/training/__tests__/skill-growth-server.test.ts src/features/training/__tests__/skill-growth-client.test.tsx 'src/app/api/training/growth/__tests__/route.test.ts' 'src/app/(main)/training/growth/__tests__/page.test.tsx'`

Result:

- PASS
- 25 / 25 tests

Key regression coverage:

- blank default scores
- core + role library composition
- explicit 2–4 focus validation
- structured evidence and phased plans
- preserving selected focus plans while scores are refined
- truncating long history instead of bricking the route
- authenticated route rendering and save API failures

End-to-end flow:

`pnpm --dir frontend exec playwright test tests/e2e/training-growth.spec.ts --config config/playwright/playwright.no-webserver.config.ts --project chromium`

Result:

- PASS
- desktop + mobile save/reload flow
