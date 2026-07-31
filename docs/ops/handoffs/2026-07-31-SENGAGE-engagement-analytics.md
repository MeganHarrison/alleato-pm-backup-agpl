# Engagement analytics handoff

- Session: SENGAGE
- Owner: Codex
- Delivery lane: High-risk
- Isolation reason: the canonical main checkout was 49 commits behind `origin/main` and had unrelated dirty files; the registered isolated-workspace provisioner also failed its dependency-install step. This clean worktree is based on `origin/main` without copied credentials.
- Owned paths: task-owned frontend analytics/training tracking paths, authenticated docs-video route, five migrations, generated types, and this task/handoff.
- Current state: the shared schema is applied; runtime and docs-site implementation remain pending.
- Migration ledger evidence: `20260731153000` created the privacy-limited session ledger. Forward correction `20260731153100` removed the unused parallel learning tables; `20260731153200` adds `learning_content_progress`, `20260731153300` establishes the documentation source boundary, and `20260731153400` seeds the two current docs videos. All five versions were directly read back from the remote ledger.
- Tooling note: `npm run db:migrations:verify-applied` is blocked before task verification by pre-existing duplicate local migration version `20260729190000`; direct exact-version ledger readback passed. The DB type generator was blocked by an unavailable local Docker daemon, so types were reconciled from live `\\d+` output and require app typecheck proof.
- Release evidence: pending.
- Focused checks: training embed/resource Jest tests passed (5 tests); frontend typecheck passed. Authenticated browser evidence: `/tmp/sengage-analytics-final.png`, `/tmp/sengage-analytics-mobile-final.png`, `/tmp/sengage-docs-video-final.png`. Browser-authenticated progress write persisted `25:30` (checkpoint: watched seconds) for the docs prime-contract lesson.
- External docs delivery: `The-Alleato-Group/alleato-docs-site` main commit `159a900` pushed; the production Vercel deployment is Ready and the tracking link is present at `docs.alleatogroup.com`.
- Independent review: initial review found missing iframe provider subscriptions, over-broad video-write authorization, and read/modify/write races. Remediation migration `20260731153500_record_video_learning_progress.sql` is applied and ledger-repaired: it validates supported cataloged videos and session ownership, serializes by learner/content advisory lock, and writes progress plus milestone atomically. YouTube uses its iframe API, Vimeo subscribes to player events, and Loom uses its Player.js-compatible ready/event channel for `play`, `timeupdate`, and `ended`.
