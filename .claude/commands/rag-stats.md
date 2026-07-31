---
description: Print a concise RAG health/stat report for the last N days.
argument-hint: <days>
---

Run the concise RAG stats report.

Use this when the user types:
- `/rag-stats 7`
- `/rag-stats seven days`
- `rag stats 3 days`
- `rag sats 1 day`

## Steps

1. Run the report from the repo root:

```bash
cd /Users/meganharrison/Documents/alleato-pm && npm run rag:stats -- $ARGUMENTS
```

2. Return the report output directly. Keep the answer compact.

3. If the command fails, report only:
- the exact failing command
- the short error text
- which env var or table is likely missing

Do not add a long explanation unless the user asks for diagnosis.
