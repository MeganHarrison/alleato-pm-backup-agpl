# Workflow client-boundary handoff

**Session:** S20260729-RAGCLIENT

**Task:** AAI-1280-RAG-CLIENT-BOUNDARY

**Delivery lane:** High-risk

**Status:** In progress

## Root cause

Vercel deployment `dpl_2efD5X4AJ4yoqGGYdCzAsmir4jDQ` reached Turbopack
and failed with 17 client-bundle errors for Node-only modules from
`@vercel/queue` and `@workflow/**`.

The first application boundary was the meeting agenda client route:

`agenda-item-row.tsx`
-> `pattern-c-attachments.ts`
-> `pipeline-trigger.ts`
-> `rag-pipeline/enqueue.ts`
-> `workflow`

The client needed only an entity type and predicate, but imported the combined
server attachment implementation.

## Implementation

- Added `pattern-c-attachment-types.ts` as the client-safe canonical entity
  type registry and predicate.
- Kept Pattern C database, storage, service-client, and pipeline-trigger
  behavior in the existing server implementation.
- Re-exported the shared type and predicate from the server module so existing
  server routes keep their public contract.
- Changed the meeting agenda client component to import only the client-safe
  module.
- Added a recursive source guard that rejects any `"use client"` module
  importing the server Pattern C implementation and asserts the shared module
  contains no Workflow, pipeline-trigger, or service-client dependency.

## Verification

- `npm run test:rag:workflow-ownership`: pass, 8/8.
- `node --test scripts/verify/__tests__/rag-pipeline-callers-auth-contract.test.mjs`:
  pass, 4/4.
- `git diff --check`: pass.
- Independent review: approved; no blocking correctness, security, or
  client/server boundary findings.
- Vercel production build: pending publication.

The reviewer also ran the broader existing
`npm run rag:verify:client-boundary` check. It still reports two unrelated
pre-existing violations in `email-search-tools.ts` and `admin-history.ts`;
neither is in this task's import chain or changed file set.

## Failure accounting

- **Cause:** client-safe configuration and server-only attachment orchestration
  shared one module boundary.
- **Detection gap:** ownership tests verified durable ordering and
  authentication but did not inspect client dependency graphs.
- **Prevention:** the focused recursive guard fails when a client module
  imports the server attachment implementation.

## Migration ledger evidence

No database migration was created or changed.
