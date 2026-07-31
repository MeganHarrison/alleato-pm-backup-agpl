# Focused Regression Test

Command: `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/retrieval/__tests__/collection-planner.test.ts`

Result: PASS — 10 tests passed on 2026-07-22.

Coverage includes the production prompt, `what were the most important activities that occurred yesterday?`, which retains the executive route and does not call the meeting collection classifier. It also covers an explicit meeting-transcript lookup, which retains exhaustive collection analysis.
