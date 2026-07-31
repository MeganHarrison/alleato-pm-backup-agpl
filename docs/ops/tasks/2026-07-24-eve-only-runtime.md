# Task: Make Eve the only AI Assistant runtime

Status: Complete
Owner: Codex S20260724-eve-only-runtime
Created: 2026-07-24
Task ID: EVE-ONLY-RUNTIME
Linear Issue: N/A
Related Handoff: isolated-session manifest

## Objective

Replace the production AI Assistant model loop with the checked-in Vercel Eve
runtime. The existing chat UI must talk directly to Eve's same-origin
`/eve/v1/*` routes. Remove the legacy chat handler, specialist agents, and
orchestrator rather than retaining a fallback.

Delivery lane: High-risk

## Acceptance Criteria

- [x] `withEve` mounts one unnamed Eve runtime in the frontend.
- [x] The existing AI Assistant UI sends turns with `useEveAgent`.
- [x] Production requests authenticate as the signed-in Supabase user.
- [x] The six executive procedures are loadable Eve skills.
- [x] The legacy chat handler and specialist runtime are deleted.
- [x] There is no fallback from Eve to the legacy runtime.
- [x] Focused auth, route-discovery, build, and UI seam checks prove the cutover.

## Failure-Loudly Contract

- Cause surfaced as: Eve route authentication, runtime, or stream error shown in
  the existing chat error surface.
- Detection path: Eve build/info, focused UI tests, and authenticated route smoke.
- Recovery path: fix the single Eve runtime; rollback through Git if the atomic
  cutover is rejected.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Task setup | Pass | Atomic replacement and deletion scope recorded. |
| Eve auth tests | Pass | Two tests prove missing bearer rejection and Supabase principal resolution. |
| Eve typecheck | Pass | `pnpm --dir agents/alleato-analyst typecheck`. |
| Eve production build | Pass | `pnpm --dir agents/alleato-analyst build`. |
| Eve route discovery | Pass | Local `/eve/v1/health` returned ready and `/eve/v1/info` reported 6 executive skills, 2 authored tools, and 0 subagents. |
| Frontend focused lint | Pass | Changed Eve UI, persistence, ASRS, and Teams delivery files passed ESLint. |
| Frontend focused tests | Pass | Eve widget seam, Ask Alleato seam, and Teams delivery tests passed. |
| Frontend typecheck | Scoped pass | No errors in changed Eve files; repository-wide typecheck remains red on unrelated existing debt. |
| Independent review | Pass after fixes | Eve parts and stable Eve message IDs now survive database history reload; repeated identical text is no longer deduplicated. |
| Eve eval | Blocked | Local skill eval requires Vercel Sandbox OIDC; production build and discovery pass, but no false eval pass is claimed. |

## Remaining Risk

- Eve currently has one authenticated, allowlisted Supabase read tool plus the
  isolated analysis tool. Legacy write-tool breadth was intentionally deleted
  instead of retained as a fallback; future capabilities must be added as Eve
  tools.

## Final Status

- [x] Required focused checks pass.
- [x] Legacy runtime deletion is verified by import search.
- [x] Published `HEAD` equals `origin/main`.
