# Handoff: Matt Pocock Skills ReadMe Guide

1. Session ID: S152
2. Task ID: AAI-1083
3. Linear issue: https://linear.app/megankharrison/issue/AAI-1083/document-matt-pocock-skills-for-codex-use
4. Owner: Codex
5. Status: Blocked/Deferred
6. Scope: Publish a curated ReadMe how-to guide for the 22 Matt Pocock skills
   wired into Codex on 2026-07-16.
7. Owned paths:
   - `docs/ops/tasks/2026-07-16-matt-pocock-skills-readme-guide.md`
   - `docs/ops/handoffs/2026-07-16-S152-matt-pocock-skills-readme-guide.md`
   - `/Users/meganharrison/Documents/alleato-os/apps/docs/skills/matt-pocock-skills.mdx`
   - `/Users/meganharrison/Documents/alleato-os/apps/docs/navigation.config.mjs`
   - `/Users/meganharrison/Documents/alleato-os/apps/docs/docs.json` (generated)
8. Intake evidence: Codex global links for all 22 skills resolve to
   `~/.agents/skills`, the local headers validate, and upstream HEAD is
   `9603c1cc8118d08bc1b3bf34cf714f62178dea3b`.
9. Risk: the docs repo is already heavily dirty with unrelated deletions; do not
   stage, discard, or otherwise alter any non-owned paths.
10. Completed: published docs commit `3c0b580` to `MeganHarrison/alleato-os`
    `main` from a clean worktree; `bun --filter docs nav` and `nav:check` pass;
    the 22-skill coverage assertion passes.
11. Verification blocker: `bun --filter docs lint` reports 2,570 existing broken
    links across 35 unrelated files and excludes this page. More importantly,
    the canonical Mintlify route
    `https://meganharrisonconsulting.mintlify.site/skills/matt-pocock-skills`
    continues to return `Page Not Found` after push. Vercel is only a proxy and
    its `Ready` deployment does not publish Mintlify content.
12. Next action: restore or trigger the Mintlify Git deployment for
    `MeganHarrison/alleato-os` `main` with docs path `apps/docs`; then capture
    the exact route screenshot and attach it to AAI-1083 before accepting.
