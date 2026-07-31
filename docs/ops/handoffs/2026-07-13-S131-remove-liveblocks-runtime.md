# Handoff: Remove Liveblocks runtime and keep Velt canonical

## Intake Block

1) Session ID: S131
2) Task ID: LIVEBLOCKS-RETIRE-2026-07-13
3) Linear issue: Blocked - connector OAuth grant invalid
4) Linear URL: unavailable
5) Current status: Complete
6) Files changed (absolute paths): task/handoff/session control files; frontend package/lock/config; main/table/admin layouts; notification page, bell, mobile badge, hook, service, and tests; retired API/provider/overlay/helper/type files; repo-control guard; project map; test environment example
7) Commands run and outcome: focused runtime guard pass; targeted ESLint pass; Jest 4 suites/15 tests pass; route and build-contract gates pass; four surface audits pass; authenticated browser notifications and Velt checks pass; full typecheck fails on unrelated repo debt
8) Evidence artifacts: `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-13-remove-liveblocks-runtime/notifications.png`, `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-13-remove-liveblocks-runtime/velt-discussion-open.png`, `/Users/meganharrison/Documents/github/project-management/docs/ops/evidence/2026-07-13-remove-liveblocks-runtime/velt-add-comment-mode.png`
9) Top findings: Velt remains the canonical comment runtime; notifications now render directly from `collaboration_notifications`; the prior guard checked obsolete filenames but missed the active provider/routes/helpers and package drift
10) Recommended next action: reauthenticate Linear and attach this evidence; separately repair broad TypeScript/repo-control debt without reopening the collaboration architecture
11) Handoff file path: `/Users/meganharrison/Documents/github/project-management/docs/ops/handoffs/2026-07-13-S131-remove-liveblocks-runtime.md`
12) Migration ledger evidence: not applicable

## Failure Record: Linear kickoff

- Cause: Linear connector returned `oauth_token_invalid_grant`.
- Detection gap: connector health was not known before kickoff.
- Prevention: require a read-back at task start and record a blocked external-tracking state immediately.
- Owner: workspace integration administrator.
- Related to current task: process-only; it does not block repository implementation or verification.

## Summary

This session owns removal of all Liveblocks runtime, route, provider, notification, helper, type, and dependency paths while preserving Velt as the sole comment and annotation runtime.

## Current State

- Liveblocks routes, provider, overlay, helpers, types, packages, CSS, config, local keys, and Vercel variables are removed.
- Header/mobile/page notifications use the first-party notification API and expose visible retry behavior.
- Velt root/entity/drawing comment entry points remain in place and are browser-proven.
- Production Velt authentication was repaired by replacing the mismatched Production credential pair from the verified secure local source and redeploying commit `0d3a0e8`; `/api/velt/token` and `/api/comments/all` now return `200`, and the production sidebar renders existing comments.
- A focused repository-control mode blocks future active Liveblocks paths, imports, providers, keys, routes, selectors, and dependencies.

## Next Step

Reauthenticate the Linear connector and post the completed evidence; then address unrelated broad verification debt under its owning tasks.

## Verification Failure Record

- Exact command: `NODE_OPTIONS=--max_old_space_size=16384 ./node_modules/.bin/tsc --noEmit --pretty false`
- Cause: broad existing cross-feature TypeScript diagnostics after the default-heap run first OOMed.
- Detection gap: the default 4 GB heap hid the real diagnostic set.
- Prevention: use the documented high-heap fallback once, retain focused changed-file checks, and repair broad debt by owner surface.
- Likely owners: feedback inbox, training pages, drawing viewers/APIs, RAG source sync, AI communication tools, and progress reports.
- Relation: unrelated; no task-owned removal file appeared in the visible diagnostics.
