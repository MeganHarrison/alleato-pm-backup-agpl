# Durable AI chat canary handoff

Status: In progress

Delivery lane: High-risk

## Ownership

- Worktree: `/Users/meganharrison/Documents/github/project-management-worktrees/durable-ai-chat`
- Branch: `codex/durable-ai-chat-canary`
- Runtime namespace: `/ai-workflow`, `/api/durable-ai`, `frontend/src/workflows/durable-ai-chat`

## Summary

Implementing a separate Vercel Workflow-backed AI chat canary. It reuses the existing Alleato prompt, model, and tool registry and does not alter the current `/ai` runtime during validation.

## Acceptance contract

See `docs/ops/tasks/2026-07-22-durable-ai-chat-canary.md`.

## Verification

- Targeted tests: Jest 17/17 (12 contract plus 5 executable runtime), targeted ESLint pass, route-conflict pass, diff-check pass, and Workflow validation/build pass (12 steps, 1 workflow). Repo-wide TypeScript has existing failures but no diagnostic names a new canary file.
- Browser evidence: authenticated desktop/mobile tool proof passed for run `wrun_01KY5H0AVPDR65QZRYH660FGGT`; refresh reconnected to the same run, the reconnect marker cleared on completion, mobile had no horizontal overflow, and database readback showed one ledger turn plus one user and one assistant message. Normal response run `wrun_01KY5K8X534VM2B2DWAKSS3F2A` also passed, and completed-run reconnect returned 204 without replay.
- Independent review: PASS; no remaining findings and zero unresolved high-severity issues.
- Preview deployment: pending.

## Migration ledger evidence

Applied to linked project `lgveqfnpkxvzbnnwuled` as remote migration version `20260722175451`; generated TypeScript types include `durable_ai_turns`, and the remote table/index readback succeeded.

## Failure prevention

- Cause: a live POST run ID changed `useChat.resume` after mount and opened a second stream reader; the workflow also failed to close its writable stream explicitly.
- Detection gap: the first contract suite proved ownership/idempotency but did not pin client reader count or stream closure.
- Prevention: mount-fixed resume semantics, completed-run 204, explicit success/failure stream close steps, deterministic approval-continuation keys, a reclaimable start lease with workflow-run CAS ownership before tools, client/API conversation idempotency, and executable failure/race regression tests.

## Cutover constraint

The canary and current assistant may coexist only for validation. A user-approved cutover must delete the replaced runtime and leave one implementation; no permanent dual-stack assistant is acceptable.
