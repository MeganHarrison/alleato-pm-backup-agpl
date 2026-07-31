# Regression Test Evidence

Command:

```text
cd frontend && npm run test:unit -- --runInBand --runTestsByPath \
  src/lib/ai/__tests__/chat-attachment-capabilities.test.ts \
  src/app/api/ai-assistant/chat/__tests__/chat-attachment-seam.test.ts \
  src/lib/ai/retrieval/__tests__/planner.test.ts \
  src/lib/ai/tools/write/prime-contract-tools.unit.test.ts
```

Result:

```text
Test Suites: 4 passed, 4 total
Tests:       169 passed, 169 total
```

The suite includes the exact production follow-up:

```text
Are you not able to see the cost codes and amounts in the screen shot I uploaded?
```

It also includes the Nexcom-style `016500` / `$12,479` case where multiple
active cost types share a code but only the Expense project budget row matches
the exact amount, plus no-match and multi-match refusal cases.
