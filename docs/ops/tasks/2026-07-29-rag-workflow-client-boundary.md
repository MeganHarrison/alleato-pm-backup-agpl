# Task: Keep Vercel Workflow out of client bundles

Status: In Progress
Owner: S20260729-RAGCLIENT
Created: 2026-07-29
Task ID: AAI-1280-RAG-CLIENT-BOUNDARY
Parent: AAI-1280

Delivery lane: High-risk

Verification contract: Required

## Objective

Restore a deployable Eve/RAG frontend by preventing the server-only Vercel
Workflow package from entering client component dependency graphs.

## Runtime evidence and root cause

- Deployment `dpl_2efD5X4AJ4yoqGGYdCzAsmir4jDQ` reached the actual Vercel build
  after the Git-author block was corrected.
- Turbopack failed with 17 client-bundle errors for Node modules including
  `fs`, `net`, `node:module`, `node:async_hooks`, and `node:child_process`.
- The first application boundary named by the build was the client meeting
  agenda route.
- `agenda-item-row.tsx` imported two client-safe attachment helpers from
  `pattern-c-attachments.ts`; that module imported the server-only document
  pipeline trigger, which imported the Vercel Workflow enqueue client.

## Acceptance criteria

- [x] Client components import only a client-safe Pattern C type/config module.
- [x] Existing server routes keep their canonical Pattern C implementation.
- [x] No client module can transitively pull in the Workflow enqueue owner
      through the Pattern C attachment module.
- [x] A focused regression test fails if the server attachment module is
      reintroduced into a client component.
- [x] The focused RAG ownership suite passes.
- [ ] A Vercel production build reaches `READY`, or the next contradicted
      boundary is recorded exactly.
- [x] Independent review is recorded.

## Owned files

- `frontend/src/lib/documents/pattern-c-attachments.ts`
- `frontend/src/lib/documents/pattern-c-attachment-types.ts`
- `frontend/src/components/domain/meetings/agenda-item-row.tsx`
- `scripts/verify/__tests__/rag-workflow-ownership-contract.test.mjs`
- this task and its handoff

## Failure contract

- Cause surfaced as: an exact client file importing a server-only Workflow
  dependency chain.
- Detection path: focused ownership test plus Vercel production build logs.
- Recovery path: move the client-needed type/config surface into the shared
  client-safe module; keep enqueue and service clients server-only.

## Incident learning

- Failure fingerprint: `operations.provider-runtime-drift`
- Root cause: A shared attachment module combined client-safe configuration
  with server-only pipeline triggering.
- Detection gap: Workflow ownership tests checked ordering and authentication,
  but not the client/server bundling boundary.
- Prevention: Assert client components do not import the server attachment
  implementation and verify the actual Vercel production build.
- Guardrail evidence:
  `scripts/verify/__tests__/rag-workflow-ownership-contract.test.mjs`;
  focused suite passes 8/8.

## Final status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Task-owned files are published and `HEAD == origin/main` is verified.
