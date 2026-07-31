# RAG pipeline dashboard static checks

Passed on 2026-07-22:

```text
git diff --check -- <owned paths>
pnpm --dir frontend exec eslint src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx src/app/(main)/ai-dashboard/ai-os/ai-os-charts.tsx src/app/(main)/ai-dashboard/live-data.ts src/app/api/ai-dashboard/rag-pipeline/route.ts src/lib/ai-dashboard/rag-pipeline.server.ts
```

The source-read helper builds the canonical `/rag?tab=lifecycle` URL with `days`, `source`, and `stage=vectorized` parameters.
