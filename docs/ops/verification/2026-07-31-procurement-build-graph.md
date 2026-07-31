# Procurement Release Build-Graph Reduction Evidence

Date: 2026-07-31
Task: AAI-1297

## Observed failure

Vercel deployment `dpl_E5dMUKjzw7gCCLMpRL5U7tvuvepg` built commit
`380e74c606c89638984acf6dd4af677a94ef3736` with Webpack, reached the
optimized production compilation phase, and was terminated by the build
container with `SIGKILL` after 5.1 minutes. Vercel classified the failure as an
out-of-memory event.

## Removed input

`frontend/next.config.ts` previously force-included the 66 MB
`@sparticuz/chromium/bin` archive in 19 PDF/email route trace entries. The
archive is not required for correctness: the shared serverless PDF launcher
already catches a missing bundled binary and downloads a version-pinned remote
pack. The route-specific traces have therefore been removed; the one unrelated
site-map CSV trace remains.

## Regression evidence

`cd frontend && pnpm exec jest --runInBand src/lib/documents/__tests__/pdf.unit.test.ts`

Result: PASS — 1 suite, 5 tests. The test verifies the trace exclusion, the
installed Chromium version pin, architecture-specific URLs, the process-arch
default, and the explicit remote-pack override.

## Scope and remaining measurement

This change removes known deployment-output duplication. It does not claim that
the Vercel compiler-memory issue is fully resolved; the next Webpack production
deployment is the required measurement. No compiler-memory limit was raised as
part of this change.
